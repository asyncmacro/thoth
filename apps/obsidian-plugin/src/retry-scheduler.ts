import { nextBackoffDelay, resetBackoffDelay } from './backoff.js';

export interface RetrySchedulerOptions {
  /** Work to run on every tick (e.g. the Phase 9 sync engine). */
  task: () => Promise<void>;
  /** Delay between successful ticks. */
  baseIntervalMs?: number;
  /** Upper bound for the backoff delay. */
  maxDelayMs?: number;
}

/**
 * Runs an injected task periodically. After a failure the next run is
 * delayed exponentially (base, 2x, 4x, ...) up to maxDelayMs; a success
 * resets the delay. Exposed for tests that need to inject overrides.
 */
export class RetryScheduler {
  private timer?: ReturnType<typeof setTimeout>;
  private delayMs: number;
  private started = false;
  private running = false;

  constructor(
    private readonly options: RetrySchedulerOptions,
    private readonly setTimeoutFn: typeof setTimeout = setTimeout,
    private readonly clearTimeoutFn: typeof clearTimeout = clearTimeout
  ) {
    this.delayMs = options.baseIntervalMs ?? 60_000;
  }

  /** Starts the periodic loop. Safe to call multiple times. */
  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;
    this.schedule(this.delayMs);
  }

  /** Stops the periodic loop. Safe to call multiple times. */
  stop(): void {
    this.started = false;
    if (this.timer) {
      this.clearTimeoutFn(this.timer);
      this.timer = undefined;
    }
  }

  /** Runs the task immediately (manual sync trigger), then reschedules. */
  async trigger(): Promise<void> {
    await this.runOnce();
  }

  private schedule(delayMs: number): void {
    if (!this.started) {
      return;
    }
    this.timer = this.setTimeoutFn(() => {
      void this.runOnce();
    }, delayMs);
  }

  private async runOnce(): Promise<void> {
    if (this.running) {
      // A manual trigger already in flight; the periodic loop will run.
      return;
    }
    this.running = true;
    try {
      await this.options.task();
      this.delayMs = resetBackoffDelay(this.options.baseIntervalMs ?? 60_000);
    } catch (error) {
      console.warn('Thoth: retry task failed', error);
      this.delayMs = nextBackoffDelay(
        this.delayMs,
        this.options.baseIntervalMs ?? 60_000,
        this.options.maxDelayMs ?? 600_000
      );
    } finally {
      this.running = false;
      this.schedule(this.delayMs);
    }
  }
}
