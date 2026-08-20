/**
 * Pure exponential backoff computation.
 *
 * Delays grow by a fixed factor on each failure and reset to the base
 * interval on success. Deterministic (no jitter) so tests are stable.
 */

/** Computes the next retry delay after a failure. */
export function nextBackoffDelay(
  current: number,
  base: number,
  max: number
): number {
  if (current <= 0) {
    return Math.min(base, max);
  }
  return Math.min(current * 2, max);
}

/** Delay to use after a successful run: back to the base interval. */
export function resetBackoffDelay(base: number): number {
  return base;
}
