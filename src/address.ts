import { isValidAddress } from "@alephium/web3";

export function extractAddress(msg: string): string | null {
  const trimmed = msg.trim();
  if (isValidAddress(trimmed)) {
    return trimmed;
  }
  return null;
}
