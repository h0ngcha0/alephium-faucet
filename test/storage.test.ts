import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { FaucetStorage } from "../src/storage";
import pino from "pino";
import { unlinkSync } from "fs";

const TEST_DB = "/tmp/faucet-test.db";
const log = pino({ level: "silent" });

let storage: FaucetStorage;

beforeEach(() => {
  try {
    unlinkSync(TEST_DB);
  } catch {}
  storage = new FaucetStorage(TEST_DB, "test", 3600_000, 86400_000, log);
});

afterEach(() => {
  storage.close();
  try {
    unlinkSync(TEST_DB);
  } catch {}
});

describe("FaucetStorage", () => {
  test("allows first request", () => {
    expect(storage.isRequestAllowed(1n, "addr1")).toBe(true);
  });

  test("throttles by userId after adding request", () => {
    storage.addNewRequest(100n, "addr1");
    expect(storage.isRequestAllowed(100n, "addr2")).toBe(false);
  });

  test("throttles by address after adding request", () => {
    storage.addNewRequest(100n, "addr1");
    expect(storage.isRequestAllowed(200n, "addr1")).toBe(false);
  });

  test("allows different user and address", () => {
    storage.addNewRequest(100n, "addr1");
    expect(storage.isRequestAllowed(200n, "addr2")).toBe(true);
  });

  test("skips userId throttle check when userId is 0", () => {
    storage.addNewRequest(0n, "addr1");
    // userId 0 should not be checked for throttling
    expect(storage.isRequestAllowed(0n, "addr2")).toBe(true);
  });

  test("lists user ids", () => {
    storage.addNewRequest(100n, "addr1");
    storage.addNewRequest(200n, "addr2");
    expect(storage.listUserIds()).toEqual(["100", "200"]);
  });

  test("lists addresses", () => {
    storage.addNewRequest(100n, "addr1");
    storage.addNewRequest(200n, "addr2");
    const addrs = storage.listAddresses();
    expect(addrs).toContain("addr1");
    expect(addrs).toContain("addr2");
  });
});
