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
  private pending = false;

  constructor(
    private readonly options: RetrySchedulerOptions,
    private readonly setTimeoutFn: typeof setTimeout = globalThis.setTimeout.bind(
      globalThis
    ),
    private readonly clearTimeoutFn: typeof clearTimeout = globalThis.clearTimeout.bind(
      globalThis
    )
  ) {
    this.delayMs = options.baseIntervalMs ?? 60_000;
  }

  /** Clears any pending timer. */
  private clearTimer(): void {
    if (this.timer) {
      this.clearTimeoutFn(this.timer);
      this.timer = undefined;
    }
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

  /** Update the base interval used for successful runs; next schedule uses new base. */
  updateBaseInterval(ms: number): void {
    const base = Math.max(1, ms);
    // If not backed off (delay equals current base), update immediately
    if (this.delayMs === (this.options.baseIntervalMs ?? 60_000)) {
      this.delayMs = base;
    }
    // Keep options.baseIntervalMs in sync for future resets
    // @ts-expect-error - update dynamic base for phase 2
    this.options.baseIntervalMs = base;
  }

  /** Runs the task immediately (manual sync trigger), then reschedules. */
  async trigger(): Promise<void> {
    this.clearTimer();
    await this.runOnce();
  }

  /**
   * Schedules a run after delayMs, cancelling any pending timer.
   * Repeated calls debounce the run (trailing edge).
   */
  scheduleSoon(delayMs: number): void {
    if (!this.started) {
      return;
    }
    this.clearTimer();
    this.timer = this.setTimeoutFn(() => {
      void this.runOnce();
    }, delayMs);
  }

  private schedule(delayMs: number): void {
    if (!this.started) {
      return;
    }
    this.clearTimer();
    this.timer = this.setTimeoutFn(() => {
      void this.runOnce();
    }, delayMs);
  }

  private async runOnce(): Promise<void> {
    if (this.running) {
      this.pending = true;
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
      if (this.pending) {
        this.pending = false;
        // Re-run shortly to handle changes that arrived during the run
        this.schedule(0);
      } else {
        this.schedule(this.delayMs);
      }
    }
  }
}
