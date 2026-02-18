import { describe, expect, test, afterEach, mock } from "bun:test";
import { TokenListService } from "../src/token-list";
import pino from "pino";

const log = pino({ level: "silent" });

const sampleTokens = [
  {
    id: "token-abc-123",
    name: "Test USDT",
    symbol: "USDTeth",
    decimals: 6,
    description: "Test USDT token",
    logoURI: "https://example.com/usdt.png",
  },
  {
    id: "token-def-456",
    name: "Test WBTC",
    symbol: "WBTC",
    decimals: 8,
    description: "Test WBTC token",
    logoURI: "https://example.com/wbtc.png",
  },
];

function mockFetch(data: unknown) {
  const original = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(JSON.stringify(data), { status: 200 })) as typeof fetch;
  return () => {
    globalThis.fetch = original;
  };
}

describe("TokenListService", () => {
  let service: TokenListService;

  afterEach(() => {
    service?.stop();
    mock.restore();
  });

  test("holds empty map when URL is empty", async () => {
    service = new TokenListService("", 60_000, log);
    await service.initialize();
    expect(service.getAllTokens()).toEqual([]);
    expect(service.getTokenBySymbol("USDT")).toBeUndefined();
  });

  test("fetches and stores tokens, lookup by symbol", async () => {
    const restore = mockFetch(sampleTokens);
    try {
      service = new TokenListService(
        "https://example.com/tokens.json",
        600_000,
        log
      );
      await service.initialize();

      expect(service.getAllTokens()).toHaveLength(2);
      expect(service.getTokenBySymbol("USDTeth")).toEqual(sampleTokens[0]);
      expect(service.getTokenBySymbol("WBTC")).toEqual(sampleTokens[1]);
      expect(service.getTokenBySymbol("nonexistent")).toBeUndefined();
    } finally {
      restore();
    }
  });

  test("symbol lookup is case insensitive", async () => {
    const restore = mockFetch(sampleTokens);
    try {
      service = new TokenListService(
        "https://example.com/tokens.json",
        600_000,
        log
      );
      await service.initialize();

      expect(service.getTokenBySymbol("usdteth")).toEqual(sampleTokens[0]);
      expect(service.getTokenBySymbol("USDTETH")).toEqual(sampleTokens[0]);
      expect(service.getTokenBySymbol("wbtc")).toEqual(sampleTokens[1]);
      expect(service.getTokenBySymbol("Wbtc")).toEqual(sampleTokens[1]);
    } finally {
      restore();
    }
  });

  test("getAllTokens returns all loaded tokens", async () => {
    const restore = mockFetch(sampleTokens);
    try {
      service = new TokenListService(
        "https://example.com/tokens.json",
        600_000,
        log
      );
      await service.initialize();

      const all = service.getAllTokens();
      expect(all).toHaveLength(2);
      const symbols = all.map((t) => t.symbol);
      expect(symbols).toContain("USDTeth");
      expect(symbols).toContain("WBTC");
    } finally {
      restore();
    }
  });

  test("throws on fetch failure during initialize", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response("Not Found", { status: 404 })) as typeof fetch;

    try {
      service = new TokenListService(
        "https://example.com/tokens.json",
        600_000,
        log
      );
      await expect(service.initialize()).rejects.toThrow(
        "Failed to fetch token list"
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("stop clears the refresh timer", async () => {
    const restore = mockFetch(sampleTokens);
    try {
      service = new TokenListService(
        "https://example.com/tokens.json",
        100,
        log
      );
      await service.initialize();
      service.stop();
    } finally {
      restore();
    }
  });
});
