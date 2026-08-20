import { describe, expect, it, vi } from 'vitest';

import { RetryScheduler } from '../retry-scheduler.js';

interface FakeTimer {
  id: number;
  fn: () => void;
  delay: number;
}

function createScheduler(
  task: () => Promise<void>,
  options: { baseIntervalMs?: number; maxDelayMs?: number } = {}
) {
  const timers: FakeTimer[] = [];
  let nextId = 1;

  const setFake = (fn: () => void, delay: number): number => {
    const id = nextId++;
    timers.push({ id, fn, delay });
    return id;
  };
  const clearFake = (id: number): void => {
    const index = timers.findIndex((timer) => timer.id === id);
    if (index >= 0) {
      timers.splice(index, 1);
    }
  };

  const scheduler = new RetryScheduler(
    { task, baseIntervalMs: 1000, maxDelayMs: 60_000, ...options },
    setFake as typeof setTimeout,
    clearFake as typeof clearTimeout
  );
  return { scheduler, timers };
}

function fire(timers: FakeTimer[]): void {
  const timer = timers.shift();
  if (timer) {
    timer.fn();
  }
}

const flush = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 0));

describe('RetryScheduler', () => {
  it('schedules the first tick with the base delay on start', () => {
    const { scheduler, timers } = createScheduler(() => Promise.resolve());
    scheduler.start();

    expect(timers).toHaveLength(1);
    expect(timers[0].delay).toBe(1000);

    scheduler.stop();
  });

  it('doubles the delay after a failure and resets after success', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    let fail = true;
    const { scheduler, timers } = createScheduler(() => {
      if (fail) {
        return Promise.reject(new Error('offline'));
      }
      return Promise.resolve();
    });

    scheduler.start();
    fire(timers);
    await flush();
    expect(timers[0].delay).toBe(2000);

    fail = false;
    fire(timers);
    await flush();
    expect(timers[0].delay).toBe(1000);

    scheduler.stop();
    warn.mockRestore();
  });

  it('caps the delay at maxDelayMs', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { scheduler, timers } = createScheduler(
      () => Promise.reject(new Error('x')),
      { baseIntervalMs: 1000, maxDelayMs: 5000 }
    );

    scheduler.start();
    for (let i = 0; i < 4; i += 1) {
      fire(timers);
      await flush();
    }
    expect(timers[0].delay).toBe(5000);

    scheduler.stop();
    warn.mockRestore();
  });

  it('trigger runs the task immediately', async () => {
    let ran = 0;
    const { scheduler } = createScheduler(() => {
      ran += 1;
      return Promise.resolve();
    });

    scheduler.start();
    await scheduler.trigger();
    expect(ran).toBe(1);

    scheduler.stop();
  });

  it('stop cancels pending timers', () => {
    const { scheduler, timers } = createScheduler(async () => {});
    scheduler.start();
    scheduler.stop();

    expect(timers).toHaveLength(0);
  });

  it('start is idempotent', () => {
    const { scheduler, timers } = createScheduler(async () => {});
    scheduler.start();
    scheduler.start();

    expect(timers).toHaveLength(1);

    scheduler.stop();
  });
});
