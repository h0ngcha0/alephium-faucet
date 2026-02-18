import type { AppConfig } from "./types";

export function parseDuration(s: string): number {
  const match = s.match(/^(\d+(?:\.\d+)?)(ms|s|m|h)$/);
  if (!match) {
    throw new Error(`Invalid duration string: "${s}"`);
  }
  const value = parseFloat(match[1]);
  const unit = match[2];
  switch (unit) {
    case "ms":
      return value;
    case "s":
      return value * 1000;
    case "m":
      return value * 60 * 1000;
    case "h":
      return value * 60 * 60 * 1000;
    default:
      throw new Error(`Unknown duration unit: "${unit}"`);
  }
}

function env(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue;
}

function envDuration(key: string, defaultValue: string): number {
  return parseDuration(env(key, defaultValue));
}

export function loadConfig(): AppConfig {
  const config: AppConfig = {
    port: env("PORT", "8080"),
    logLevel: env("LOG_LEVEL", "info"),
    walletName: env("WALLET_NAME", ""),
    walletPassword: env("WALLET_PASSWORD", ""),
    walletMnemonic: env("WALLET_MNEMONIC", ""),
    walletMnemonicPassphrase: env("WALLET_MNEMONIC_PASSPHRASE", ""),
    txAmount: env("TX_AMOUNT", "1200000000000000000"),
    alephiumEndpoint: env("ALEPHIUM_ENDPOINT", "http://alephium:12973"),
    explorerTxUri: env("EXPLORER_TX_URI", "https://testnet.alephium.org/transactions"),
    dbPath: env("DB_PATH", "/data/state/faucet.db"),
    dbName: env("DB_NAME", "faucet"),
    ipThrottling: envDuration("IP_THROTTLING", "1h"),
    addressThrottling: envDuration("ADDRESS_THROTTLING", "24h"),
    txWaitTime: envDuration("TX_WAIT_TIME", "60s"),
    metricsNamespace: env("METRICS_NAMESPACE", "alephium"),
    metricsSubsystem: env("METRICS_SUBSYSTEM", "faucet"),
    metricsPath: env("METRICS_PATH", "/metrics"),
  };

  if (!config.walletName || !config.walletPassword) {
    throw new Error(
      "Some mandatory configuration parameters are missing (WALLET_NAME, WALLET_PASSWORD). Please correct the config and retry."
    );
  }

  return config;
}
