import type { Server } from "bun";
type BunServer = Server<unknown>;
import type pino from "pino";
import type { AppConfig, FaucetResult } from "./types";
import type { FaucetStorage } from "./storage";
import type { FaucetMetrics } from "./metrics";
import type { WalletService } from "./wallet";
import type { TokenListService } from "./token-list";
import { extractAddress } from "./address";

export function startServer(
  config: AppConfig,
  storage: FaucetStorage,
  metrics: FaucetMetrics,
  wallet: WalletService,
  tokenListService: TokenListService,
  log: pino.Logger
): BunServer {
  return Bun.serve({
    port: parseInt(config.port, 10),
    async fetch(req) {
      const url = new URL(req.url);
      const path = url.pathname;

      if (path === "/send" && req.method === "POST") {
        return handleSend(req, config, storage, wallet, tokenListService, log);
      }

      if (path === "/send" && req.method !== "POST") {
        return textResponse(
          `Method ${req.method} not allowed, expecting POST\n`,
          405
        );
      }

      if (path === "/tokens" && req.method === "GET") {
        return Response.json(tokenListService.getAllTokens());
      }

      if (path === "/health") {
        return new Response("OK", { status: 200 });
      }

      if (path === config.metricsPath) {
        const body = await metrics.getMetrics();
        return new Response(body, {
          status: 200,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      }

      if (path === "/debug/addresses") {
        return debugEndpoint(req, () => storage.listAddresses());
      }

      return textResponse("Not Found\n", 404);
    },
  });
}

function debugEndpoint(
  req: Request,
  listFn: () => string[]
): Response {
  if (req.method !== "GET") {
    return textResponse(
      `Ignoring request. Required method is "GET", but got "${req.method}".\n`,
      405
    );
  }
  const data = listFn();
  return Response.json(data);
}

async function handleSend(
  req: Request,
  config: AppConfig,
  storage: FaucetStorage,
  wallet: WalletService,
  tokenListService: TokenListService,
  log: pino.Logger
): Promise<Response> {
  const body = await req.text();

  let addressStr: string;
  let token: string | undefined;

  const trimmed = body.trim();
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      addressStr = parsed.address ?? "";
      token = parsed.token;
    } catch {
      return textResponse("Invalid JSON in request body.\n", 400);
    }
  } else {
    addressStr = trimmed;
  }

  const address = extractAddress(addressStr);
  if (!address) {
    return textResponse(
      `Address ${addressStr} is not a valid Alephium address.\n`,
      400
    );
  }

  if (token !== undefined) {
    const tokenInfo = tokenListService.getTokenBySymbol(token);
    if (!tokenInfo) {
      return textResponse(
        `Unknown token: ${token}\n`,
        400
      );
    }
  }

  const ip = req.headers.get("X-Forwarded-For") ?? "";

  log.info(
    `Got a faucet request for ${address}${token ? ` (token: ${token})` : ""} from ${ip || "unknown"}`
  );

  const resultPromise = new Promise<FaucetResult>((resolve) => {
    wallet.handleRequest({ address, ip, token, resolve });
  });

  const timeoutPromise = new Promise<FaucetResult>((resolve) => {
    setTimeout(
      () => resolve({ error: new Error("timeout") }),
      config.txWaitTime
    );
  });

  const result = await Promise.race([resultPromise, timeoutPromise]);

  if (result.error) {
    if (result.error.name === "ThrottleError") {
      return textResponse(
        `Transaction on ${address} did not complete, reason = ${result.error.message}\n`,
        429
      );
    }
    if (result.error.message === "timeout") {
      return textResponse(`Transaction on ${address} failed\n`, 500);
    }
    return textResponse(
      `Transaction on ${address} did not complete, reason = ${result.error.message}\n`,
      400
    );
  }

  if (result.txid) {
    return textResponse(
      `${config.explorerTxUri}/${result.txid}\n`,
      202
    );
  }

  return textResponse(`Transaction on ${address} failed\n`, 500);
}

function textResponse(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
