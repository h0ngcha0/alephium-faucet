import type pino from "pino";

export interface TokenInfo {
  id: string;
  name: string;
  symbol: string;
  decimals: number;
  description: string;
  logoURI: string;
}

export class TokenListService {
  private tokensBySymbol: Map<string, TokenInfo> = new Map();
  private url: string;
  private refreshInterval: number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private log: pino.Logger;

  constructor(url: string, refreshInterval: number, log: pino.Logger) {
    this.url = url;
    this.refreshInterval = refreshInterval;
    this.log = log;
  }

  async initialize(): Promise<void> {
    if (!this.url) {
      this.log.info("Token list URL not configured, token support disabled");
      return;
    }

    await this.fetchTokenList();

    this.timer = setInterval(() => {
      this.fetchTokenList().catch((err) => {
        this.log.warn(`Failed to refresh token list: ${err}`);
      });
    }, this.refreshInterval);
  }

  private async fetchTokenList(): Promise<void> {
    this.log.info(`Fetching token list from ${this.url}`);
    const response = await fetch(this.url);
    if (!response.ok) {
      throw new Error(`Failed to fetch token list: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as TokenInfo[];
    const newTokens = new Map<string, TokenInfo>();
    for (const token of data) {
      newTokens.set(token.symbol.toLowerCase(), token);
    }
    this.tokensBySymbol = newTokens;
    this.log.info(`Loaded ${newTokens.size} tokens from token list`);
  }

  getTokenBySymbol(symbol: string): TokenInfo | undefined {
    return this.tokensBySymbol.get(symbol.toLowerCase());
  }

  getAllTokens(): TokenInfo[] {
    return Array.from(this.tokensBySymbol.values());
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
