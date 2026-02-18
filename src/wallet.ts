import { NodeProvider } from "@alephium/web3";
import type pino from "pino";
import type { FaucetStorage } from "./storage";
import type { FaucetMetrics } from "./metrics";
import { ThrottleError, type FaucetRequest, type FaucetResult } from "./types";

export class WalletService {
  private nodeProvider: NodeProvider;
  private walletName: string;
  private walletPassword: string;
  private walletMnemonicPassphrase: string;
  private txAmount: string;
  private storage: FaucetStorage;
  private metrics: FaucetMetrics;
  private log: pino.Logger;
  private queue: Promise<void> = Promise.resolve();

  constructor(
    nodeProvider: NodeProvider,
    walletName: string,
    walletPassword: string,
    walletMnemonicPassphrase: string,
    txAmount: string,
    storage: FaucetStorage,
    metrics: FaucetMetrics,
    log: pino.Logger
  ) {
    this.nodeProvider = nodeProvider;
    this.walletName = walletName;
    this.walletPassword = walletPassword;
    this.walletMnemonicPassphrase = walletMnemonicPassphrase;
    this.txAmount = txAmount;
    this.storage = storage;
    this.metrics = metrics;
    this.log = log;
  }

  async initialize(walletMnemonic: string): Promise<void> {
    try {
      await this.nodeProvider.wallets.getWalletsWalletName(this.walletName);
    } catch (err: unknown) {
      const is404 =
        err instanceof Error && err.message.includes("404");
      if (!is404) {
        throw err;
      }
      if (!walletMnemonic) {
        throw new Error(
          `Wallet ${this.walletName} not found and mnemonic not provided. Please provide wallet mnemonic to create/restore the wallet.`
        );
      }
      this.log.info("Wallet not found, restoring from mnemonic...");
      await this.nodeProvider.wallets.putWallets({
        password: this.walletPassword,
        mnemonic: walletMnemonic,
        walletName: this.walletName,
        isMiner: false,
        mnemonicPassphrase: this.walletMnemonicPassphrase || undefined,
      });
    }

    await this.nodeProvider.wallets.postWalletsWalletNameUnlock(
      this.walletName,
      {
        password: this.walletPassword,
        mnemonicPassphrase: this.walletMnemonicPassphrase || undefined,
      }
    );
    this.log.info(`Wallet ${this.walletName} unlocked successfully`);
  }

  handleRequest(request: FaucetRequest): void {
    this.queue = this.queue.then(() => this.processRequest(request));
  }

  private async processRequest(request: FaucetRequest): Promise<void> {
    const { address, userId, resolve } = request;
    this.log.info(
      `Got a new request to send ${this.txAmount} to ${address} (user ${userId})`
    );

    try {
      const allowed = this.storage.isRequestAllowed(userId, address);
      if (!allowed) {
        this.log.debug("Request is not allowed (throttled)");
        resolve({ error: new ThrottleError("request throttled") });
        return;
      }

      this.storage.addNewRequest(userId, address);

      const wallet = await this.nodeProvider.wallets.getWalletsWalletName(
        this.walletName
      );
      if (wallet.locked) {
        await this.nodeProvider.wallets.postWalletsWalletNameUnlock(
          this.walletName,
          {
            password: this.walletPassword,
            mnemonicPassphrase: this.walletMnemonicPassphrase || undefined,
          }
        );
      }

      const tx = await this.nodeProvider.wallets.postWalletsWalletNameTransfer(
        this.walletName,
        {
          destinations: [
            {
              address,
              attoAlphAmount: this.txAmount,
            },
          ],
        }
      );

      this.metrics.successfulTx.inc();
      this.log.info(
        `TX is ${tx.txId}, (${tx.fromGroup} -> ${tx.toGroup})`
      );
      resolve({ txid: tx.txId });
    } catch (err: unknown) {
      this.metrics.failedTx.inc();
      const error = err instanceof Error ? err : new Error(String(err));
      this.log.warn(
        `Got an error while transferring ${this.txAmount} from ${this.walletName} to ${address}: ${error.message}`
      );
      resolve({ error });
    }
  }
}
