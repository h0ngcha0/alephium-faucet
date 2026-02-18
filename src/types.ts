export interface AppConfig {
  port: string;
  logLevel: string;
  walletName: string;
  walletPassword: string;
  walletMnemonic: string;
  walletMnemonicPassphrase: string;
  txAmount: string;
  alephiumEndpoint: string;
  explorerTxUri: string;
  dbPath: string;
  dbName: string;
  ipThrottling: number; // milliseconds
  addressThrottling: number; // milliseconds
  txWaitTime: number; // milliseconds
  metricsNamespace: string;
  metricsSubsystem: string;
  metricsPath: string;
  tokenListUrl: string;
  tokenListRefreshInterval: number; // milliseconds
  alphAmountForTokenTransfer: string;
  faucetTokenMultiplier: number;
}

export interface FaucetRequest {
  address: string;
  ip: string;
  token?: string;
  resolve: (result: FaucetResult) => void;
}

export interface FaucetResult {
  txid?: string;
  error?: Error;
}

export class ThrottleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ThrottleError";
  }
}
