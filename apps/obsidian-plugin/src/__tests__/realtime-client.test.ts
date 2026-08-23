import { describe, expect, it } from 'vitest';
import { connectRealtime } from '../realtime-client.js';

describe('realtime-client', () => {
  it('module loads', () => {
    expect(typeof connectRealtime).toBe('function');
  });
});
