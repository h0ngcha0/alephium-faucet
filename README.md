# Alephium Faucet

Testnet faucet for the Alephium blockchain. Distributes ALPH and other testnet tokens with IP and address-based rate limiting.

## Setup

```bash
bun install
```

## Running

```bash
WALLET_NAME=my-wallet WALLET_PASSWORD=secret bun run src/index.ts
```

Or with Docker:

```bash
docker build -t alephium-faucet .
docker run -p 8080:8080 \
  -e WALLET_NAME=my-wallet \
  -e WALLET_PASSWORD=secret \
  -e ALEPHIUM_ENDPOINT=http://localhost:12973 \
  alephium-faucet
```

## API

### Request ALPH

```bash
curl -X POST http://localhost:8080/send \
  -d 'tgx3vvjr8e4aejkq0w9n2e2pdgqf5khu48dapgm87hhdqyhrvmwg5x9fg3t0v'
```

### Request a specific token

```bash
curl -X POST http://localhost:8080/send \
  -H 'Content-Type: application/json' \
  -d '{"address": "tgx3vvjr8e4aejkq0w9n2e2pdgqf5khu48dapgm87hhdqyhrvmwg5x9fg3t0v", "token": "USDT"}'
```

### List available tokens

```bash
curl http://localhost:8080/tokens
```

### Health check

```bash
curl http://localhost:8080/health
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | Server port |
| `WALLET_NAME` | — | **Required.** Faucet wallet name |
| `WALLET_PASSWORD` | — | **Required.** Faucet wallet password |
| `WALLET_MNEMONIC` | — | Seed phrase (required if wallet doesn't exist) |
| `ALEPHIUM_ENDPOINT` | `http://alephium:12973` | Node RPC endpoint |
| `TX_AMOUNT` | `1200000000000000000` | ALPH per request (in attoALPH) |
| `IP_THROTTLING` | `1h` | Rate limit per IP |
| `ADDRESS_THROTTLING` | `24h` | Rate limit per address |
| `TOKEN_LIST_URL` | — | URL to fetch available token metadata |
| `DB_PATH` | `/data/state/faucet.db` | SQLite database path |
| `EXPLORER_TX_URI` | `https://testnet.alephium.org/transactions` | Explorer base URL |
