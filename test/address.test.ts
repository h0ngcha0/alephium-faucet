import { describe, expect, test } from "bun:test";
import { extractAddress } from "../src/address";

describe("extractAddress", () => {
  test("extracts a valid alephium address", () => {
    const addr = "1DrDyTr9RpRsQnDnXo2YRiPzPW4ooHX5LLoqXrqfMrpQH";
    expect(extractAddress(addr)).toBe(addr);
  });

  test("extracts address with leading/trailing whitespace", () => {
    const addr = "1DrDyTr9RpRsQnDnXo2YRiPzPW4ooHX5LLoqXrqfMrpQH";
    expect(extractAddress(`  ${addr}  `)).toBe(addr);
  });

  test("returns null for invalid input", () => {
    expect(extractAddress("not-an-address")).toBeNull();
  });

  test("returns null for empty string", () => {
    expect(extractAddress("")).toBeNull();
  });

  test("returns null for random base58 string", () => {
    expect(extractAddress("abcdefghijkmnopqrstuvwxyz")).toBeNull();
  });
});
