import type { Server } from "bun";
type BunServer = Server<unknown>;
import type pino from "pino";
import type { AppConfig, FaucetResult } from "./types";
import type { FaucetStorage } from "./storage";
import type { FaucetMetrics } from "./metrics";
import type { WalletService } from "./wallet";
import { extractAddress, ipStr2BigInt } from "./address";

export function startServer(
  config: AppConfig,
  storage: FaucetStorage,
  metrics: FaucetMetrics,
  wallet: WalletService,
  log: pino.Logger
): BunServer {
  return Bun.serve({
    port: parseInt(config.port, 10),
    async fetch(req) {
      const url = new URL(req.url);
      const path = url.pathname;

      if (path === "/send" && req.method === "POST") {
        return handleSend(req, config, storage, wallet, log);
      }

      if (path === "/send" && req.method !== "POST") {
        return textResponse(
          `Method ${req.method} not allowed, expecting POST\n`,
          405
        );
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

      if (path === "/debug/users") {
        return debugEndpoint(req, () => storage.listUserIds());
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
  log: pino.Logger
): Promise<Response> {
  const body = await req.text();
  const address = extractAddress(body);
  if (!address) {
    return textResponse(
      `Address ${body} is not a valid Alephium address.\n`,
      400
    );
  }

  const ip = req.headers.get("X-Forwarded-For");
  if (!ip) {
    return textResponse(
      "Unknown remote ip, can't throttle properly....\n",
      400
    );
  }

  log.info(`Got a faucet request for ${address} from ${ip}`);

  const userId = ipStr2BigInt(ip);

  const resultPromise = new Promise<FaucetResult>((resolve) => {
    wallet.handleRequest({ address, userId, resolve });
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
