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
    expect(storage.isRequestAllowed("1.2.3.4", "addr1")).toBe(true);
  });

  test("throttles by IP after adding request", () => {
    storage.addNewRequest("1.2.3.4", "addr1");
    expect(storage.isRequestAllowed("1.2.3.4", "addr2")).toBe(false);
  });

  test("throttles by address after adding request", () => {
    storage.addNewRequest("1.2.3.4", "addr1");
    expect(storage.isRequestAllowed("5.6.7.8", "addr1")).toBe(false);
  });

  test("allows different IP and address", () => {
    storage.addNewRequest("1.2.3.4", "addr1");
    expect(storage.isRequestAllowed("5.6.7.8", "addr2")).toBe(true);
  });

  test("skips IP throttle check when IP is empty", () => {
    storage.addNewRequest("", "addr1");
    expect(storage.isRequestAllowed("", "addr2")).toBe(true);
  });

  test("lists addresses", () => {
    storage.addNewRequest("1.2.3.4", "addr1");
    storage.addNewRequest("5.6.7.8", "addr2");
    const addrs = storage.listAddresses();
    expect(addrs).toContain("addr1");
    expect(addrs).toContain("addr2");
  });
});
