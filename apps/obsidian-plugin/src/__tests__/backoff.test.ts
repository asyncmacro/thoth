import { describe, expect, it } from 'vitest';

import { nextBackoffDelay, resetBackoffDelay } from '../backoff.js';

describe('nextBackoffDelay', () => {
  it('starts at the base delay after the first failure', () => {
    expect(nextBackoffDelay(0, 1000, 60_000)).toBe(1000);
  });

  it('doubles after each subsequent failure', () => {
    let delay = nextBackoffDelay(0, 1000, 60_000);
    delay = nextBackoffDelay(delay, 1000, 60_000);
    delay = nextBackoffDelay(delay, 1000, 60_000);

    expect(delay).toBe(4000);
  });

  it('caps the delay at maxDelayMs', () => {
    expect(nextBackoffDelay(40_000, 1000, 60_000)).toBe(60_000);
  });

  it('treats negative delays as never-before-failed', () => {
    expect(nextBackoffDelay(-1, 1000, 60_000)).toBe(1000);
  });
});

describe('resetBackoffDelay', () => {
  it('returns to the base interval after a success', () => {
    expect(resetBackoffDelay(1000)).toBe(1000);
  });
});
