import { describe, expect, test, afterEach, mock } from "bun:test";
import { TokenListService } from "../src/token-list";
import pino from "pino";

const log = pino({ level: "silent" });

const sampleTokens = [
  {
    id: "token-abc-123",
    name: "Test USDT",
    symbol: "USDT",
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
    expect(service.getToken("any-id")).toBeUndefined();
  });

  test("fetches and stores tokens from URL", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(JSON.stringify(sampleTokens), {
        status: 200,
      })) as typeof fetch;

    try {
      service = new TokenListService(
        "https://example.com/tokens.json",
        600_000,
        log
      );
      await service.initialize();

      expect(service.getAllTokens()).toHaveLength(2);
      expect(service.getToken("token-abc-123")).toEqual(sampleTokens[0]);
      expect(service.getToken("token-def-456")).toEqual(sampleTokens[1]);
      expect(service.getToken("nonexistent")).toBeUndefined();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("getAllTokens returns all loaded tokens", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(JSON.stringify(sampleTokens), {
        status: 200,
      })) as typeof fetch;

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
      expect(symbols).toContain("USDT");
      expect(symbols).toContain("WBTC");
    } finally {
      globalThis.fetch = originalFetch;
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
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(JSON.stringify(sampleTokens), {
        status: 200,
      })) as typeof fetch;

    try {
      service = new TokenListService(
        "https://example.com/tokens.json",
        100,
        log
      );
      await service.initialize();
      service.stop();
      // No error means timer was cleared successfully
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
