import { Database } from "bun:sqlite";
import type pino from "pino";

const SUFFIX_IPS = "-ips";
const SUFFIX_ADDRESSES = "-addresses";

export class FaucetStorage {
  private db: Database;
  private prefix: string;
  private ipThrottling: number; // ms
  private addressThrottling: number; // ms
  private log: pino.Logger;

  constructor(
    dbPath: string,
    prefix: string,
    ipThrottling: number,
    addressThrottling: number,
    log: pino.Logger
  ) {
    this.db = new Database(dbPath, { create: true });
    this.prefix = prefix;
    this.ipThrottling = ipThrottling;
    this.addressThrottling = addressThrottling;
    this.log = log;

    // Enable WAL mode for better concurrent read performance
    this.db.run("PRAGMA journal_mode=WAL");

    for (const suffix of [SUFFIX_IPS, SUFFIX_ADDRESSES]) {
      this.db.run(
        `CREATE TABLE IF NOT EXISTS "${this.tableName(suffix)}" (key TEXT PRIMARY KEY, timestamp INTEGER NOT NULL)`
      );
    }
  }

  private tableName(suffix: string): string {
    return `${this.prefix}${suffix}`;
  }

  private getTimestamp(key: string, suffix: string): number {
    const row = this.db
      .query<{ timestamp: number }, [string]>(
        `SELECT timestamp FROM "${this.tableName(suffix)}" WHERE key = ?`
      )
      .get(key);
    return row ? row.timestamp : 0;
  }

  isRequestAllowed(ip: string, address: string, token: string = "ALPH"): boolean {
    const nowSec = Math.floor(Date.now() / 1000);

    if (ip) {
      const ipKey = `${ip}:${token}`;
      const ts = this.getTimestamp(ipKey, SUFFIX_IPS);
      if (ts > 0 && nowSec - ts < this.ipThrottling / 1000) {
        return false;
      }
    }

    const addrKey = `${address}:${token}`;
    const ts = this.getTimestamp(addrKey, SUFFIX_ADDRESSES);
    if (ts > 0 && nowSec - ts < this.addressThrottling / 1000) {
      return false;
    }

    return true;
  }

  addNewRequest(ip: string, address: string, token: string = "ALPH"): void {
    const nowSec = Math.floor(Date.now() / 1000);

    if (ip) {
      this.upsert(SUFFIX_IPS, `${ip}:${token}`, nowSec);
    }

    this.upsert(SUFFIX_ADDRESSES, `${address}:${token}`, nowSec);
  }

  private upsert(suffix: string, key: string, timestamp: number): void {
    this.db.run(
      `INSERT INTO "${this.tableName(suffix)}" (key, timestamp) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET timestamp = excluded.timestamp`,
      [key, timestamp]
    );
  }

  listAddresses(): string[] {
    return this.listKeys(SUFFIX_ADDRESSES);
  }

  private listKeys(suffix: string): string[] {
    const rows = this.db
      .query<{ key: string }, []>(
        `SELECT key FROM "${this.tableName(suffix)}"`
      )
      .all();
    return rows.map((r) => r.key);
  }

  close(): void {
    this.db.close();
  }
}
