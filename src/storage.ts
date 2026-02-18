import { Database } from "bun:sqlite";
import type pino from "pino";

const SUFFIX_USERIDS = "-userids";
const SUFFIX_ADDRESSES = "-addresses";

export class FaucetStorage {
  private db: Database;
  private prefix: string;
  private userThrottling: number; // ms
  private addressThrottling: number; // ms
  private log: pino.Logger;

  constructor(
    dbPath: string,
    prefix: string,
    userThrottling: number,
    addressThrottling: number,
    log: pino.Logger
  ) {
    this.db = new Database(dbPath, { create: true });
    this.prefix = prefix;
    this.userThrottling = userThrottling;
    this.addressThrottling = addressThrottling;
    this.log = log;

    // Enable WAL mode for better concurrent read performance
    this.db.run("PRAGMA journal_mode=WAL");

    for (const suffix of [
      SUFFIX_USERIDS,
      SUFFIX_ADDRESSES,
    ]) {
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

  isRequestAllowed(userId: bigint, address: string): boolean {
    const nowSec = Math.floor(Date.now() / 1000);

    if (userId !== 0n) {
      const ts = this.getTimestamp(userId.toString(), SUFFIX_USERIDS);
      if (ts > 0 && nowSec - ts < this.userThrottling / 1000) {
        return false;
      }
    }

    const ts = this.getTimestamp(address, SUFFIX_ADDRESSES);
    if (ts > 0 && nowSec - ts < this.addressThrottling / 1000) {
      return false;
    }

    return true;
  }

  addNewRequest(userId: bigint, address: string): void {
    const nowSec = Math.floor(Date.now() / 1000);

    if (userId !== 0n) {
      this.upsert(SUFFIX_USERIDS, userId.toString(), nowSec);
    }

    this.upsert(SUFFIX_ADDRESSES, address, nowSec);
  }

  private upsert(suffix: string, key: string, timestamp: number): void {
    this.db.run(
      `INSERT INTO "${this.tableName(suffix)}" (key, timestamp) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET timestamp = excluded.timestamp`,
      [key, timestamp]
    );
  }

  listUserIds(): string[] {
    return this.listKeys(SUFFIX_USERIDS);
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
