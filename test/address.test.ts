import { describe, expect, test } from "bun:test";
import { extractAddress, ipStr2BigInt } from "../src/address";

describe("extractAddress", () => {
  test("extracts a valid alephium address from plain text", () => {
    const addr = "1DrDyTr9RpRsQnDnXo2YRiPzPW4ooHX5LLoqXrqfMrpQH";
    expect(extractAddress(addr)).toBe(addr);
  });

  test("extracts address from surrounding text", () => {
    const addr = "1DrDyTr9RpRsQnDnXo2YRiPzPW4ooHX5LLoqXrqfMrpQH";
    expect(extractAddress(`Send to ${addr} please`)).toBe(addr);
  });

  test("returns null for invalid input", () => {
    expect(extractAddress("not-an-address")).toBeNull();
  });

  test("returns null for empty string", () => {
    expect(extractAddress("")).toBeNull();
  });

  test("rejects addresses with invalid characters (0, O, I, l)", () => {
    // 'O' is not in base58 charset
    expect(extractAddress("OOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOO")).toBeNull();
  });

  test("extracts 43-character address", () => {
    // 43 characters of valid base58
    const addr = "1DrDyTr9RpRsQnDnXo2YRiPzPW4ooHX5LLoqXrqfMrp";
    expect(addr.length).toBe(43);
    expect(extractAddress(addr)).toBe(addr);
  });

  test("extracts 46-character address", () => {
    // 46 characters of valid base58
    const addr = "1DrDyTr9RpRsQnDnXo2YRiPzPW4ooHX5LLoqXrqfMrpQHa";
    expect(addr.length).toBe(46);
    expect(extractAddress(addr)).toBe(addr);
  });
});

describe("ipStr2BigInt", () => {
  test("converts IPv4 to bigint", () => {
    expect(ipStr2BigInt("127.0.0.1")).toBe(2130706433n);
  });

  test("converts IPv4 0.0.0.0", () => {
    expect(ipStr2BigInt("0.0.0.0")).toBe(0n);
  });

  test("converts IPv4 192.168.1.1", () => {
    // 192*2^24 + 168*2^16 + 1*2^8 + 1 = 3232235777
    expect(ipStr2BigInt("192.168.1.1")).toBe(3232235777n);
  });

  test("converts IPv6 loopback", () => {
    expect(ipStr2BigInt("::1")).toBe(1n);
  });

  test("converts full IPv6", () => {
    const result = ipStr2BigInt("2001:0db8:0000:0000:0000:0000:0000:0001");
    expect(result).toBe(42540766411282592856903984951653826561n);
  });
});
