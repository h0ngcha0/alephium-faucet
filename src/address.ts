const alphAddressRegex =
  /[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]{43,46}/;

export function extractAddress(msg: string): string | null {
  const match = msg.match(alphAddressRegex);
  return match ? match[0] : null;
}

export function ipStr2BigInt(ipStr: string): bigint {
  const parts = ipStr.trim().split(".");
  if (parts.length === 4) {
    // IPv4
    let result = 0n;
    for (const part of parts) {
      result = (result << 8n) | BigInt(parseInt(part, 10));
    }
    return result;
  }

  // IPv6 — expand and convert
  const expanded = expandIPv6(ipStr.trim());
  let result = 0n;
  for (const group of expanded.split(":")) {
    result = (result << 16n) | BigInt(parseInt(group, 16));
  }
  return result;
}

function expandIPv6(ip: string): string {
  // Handle ::
  const halves = ip.split("::");
  let groups: string[];
  if (halves.length === 2) {
    const left = halves[0] ? halves[0].split(":") : [];
    const right = halves[1] ? halves[1].split(":") : [];
    const missing = 8 - left.length - right.length;
    groups = [...left, ...Array(missing).fill("0"), ...right];
  } else {
    groups = ip.split(":");
  }
  return groups.map((g) => g.padStart(4, "0")).join(":");
}
