import { Counter, Registry } from "prom-client";

export class FaucetMetrics {
  readonly registry: Registry;
  readonly successfulTx: Counter;
  readonly failedTx: Counter;

  constructor(namespace: string, subsystem: string) {
    this.registry = new Registry();

    this.successfulTx = new Counter({
      name: `${namespace}_${subsystem}_successful_tx_count`,
      help: "Number of successful transactions",
      registers: [this.registry],
    });

    this.failedTx = new Counter({
      name: `${namespace}_${subsystem}_failed_tx_count`,
      help: "Number of failed transactions",
      registers: [this.registry],
    });
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }
}
