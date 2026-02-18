import { NodeProvider } from "@alephium/web3";
import type pino from "pino";
import type { FaucetStorage } from "./storage";
import type { FaucetMetrics } from "./metrics";
import type { TokenListService } from "./token-list";
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
  private tokenListService: TokenListService;
  private alphAmountForTokenTransfer: string;
  private faucetTokenMultiplier: number;

  constructor(
    nodeProvider: NodeProvider,
    walletName: string,
    walletPassword: string,
    walletMnemonicPassphrase: string,
    txAmount: string,
    storage: FaucetStorage,
    metrics: FaucetMetrics,
    log: pino.Logger,
    tokenListService: TokenListService,
    alphAmountForTokenTransfer: string,
    faucetTokenMultiplier: number
  ) {
    this.nodeProvider = nodeProvider;
    this.walletName = walletName;
    this.walletPassword = walletPassword;
    this.walletMnemonicPassphrase = walletMnemonicPassphrase;
    this.txAmount = txAmount;
    this.storage = storage;
    this.metrics = metrics;
    this.log = log;
    this.tokenListService = tokenListService;
    this.alphAmountForTokenTransfer = alphAmountForTokenTransfer;
    this.faucetTokenMultiplier = faucetTokenMultiplier;
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
    const { address, ip, token, resolve } = request;
    const description = token
      ? `token ${token}`
      : `${this.txAmount} ALPH`;
    this.log.info(`Got a new request to send ${description} to ${address}`);

    try {
      const throttleKey = token?.toLowerCase() ?? "ALPH";
      const allowed = this.storage.isRequestAllowed(ip, address, throttleKey);
      if (!allowed) {
        this.log.debug("Request is not allowed (throttled)");
        resolve({ error: new ThrottleError("request throttled") });
        return;
      }

      this.storage.addNewRequest(ip, address, throttleKey);

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

      let destination: {
        address: string;
        attoAlphAmount: string;
        tokens?: { id: string; amount: string }[];
      };

      if (token) {
        const tokenInfo = this.tokenListService.getTokenBySymbol(token);
        if (!tokenInfo) {
          resolve({ error: new Error(`Unknown token: ${token}`) });
          return;
        }
        const tokenAmount = (
          BigInt(this.faucetTokenMultiplier) *
          10n ** BigInt(tokenInfo.decimals)
        ).toString();
        destination = {
          address,
          attoAlphAmount: this.alphAmountForTokenTransfer,
          tokens: [{ id: tokenInfo.id, amount: tokenAmount }],
        };
        this.log.info(
          `Sending ${tokenAmount} of ${tokenInfo.symbol} (${tokenInfo.id}) to ${address}`
        );
      } else {
        destination = {
          address,
          attoAlphAmount: this.txAmount,
        };
      }

      const tx = await this.nodeProvider.wallets.postWalletsWalletNameTransfer(
        this.walletName,
        { destinations: [destination] }
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
        `Got an error while transferring ${description} from ${this.walletName} to ${address}: ${error.message}`
      );
      resolve({ error });
    }
  }
}
