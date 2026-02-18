import { NodeProvider } from "@alephium/web3";
import { mkdirSync } from "fs";
import { dirname } from "path";
import { loadConfig } from "./config";
import { createLogger } from "./logger";
import { FaucetStorage } from "./storage";
import { FaucetMetrics } from "./metrics";
import { WalletService } from "./wallet";
import { startServer } from "./server";

const config = loadConfig();
const log = createLogger(config.logLevel);

log.info("alephium-faucet-ts is initializing...");

// Ensure DB directory exists
mkdirSync(dirname(config.dbPath), { recursive: true });

const storage = new FaucetStorage(
  config.dbPath,
  config.dbName,
  config.userThrottling,
  config.addressThrottling,
  log
);

const metrics = new FaucetMetrics(
  config.metricsNamespace,
  config.metricsSubsystem
);

const nodeProvider = new NodeProvider(config.alephiumEndpoint);

const walletService = new WalletService(
  nodeProvider,
  config.walletName,
  config.walletPassword,
  config.walletMnemonicPassphrase,
  config.txAmount,
  storage,
  metrics,
  log
);

await walletService.initialize(config.walletMnemonic);

const server = startServer(config, storage, metrics, walletService, log);
log.info(`Server listening on port ${config.port}`);

function shutdown() {
  log.info("Shutdown signal received, exiting...");
  server.stop();
  storage.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
