import { describe, it, expect } from 'vitest';
import { randomUUID } from './id';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('randomUUID', () => {
  it('produces a valid v4 UUID', () => {
    expect(randomUUID()).toMatch(UUID_V4);
  });

  it('produces unique values', () => {
    const set = new Set(Array.from({ length: 1000 }, () => randomUUID()));
    expect(set.size).toBe(1000);
  });

  it('falls back to getRandomValues when crypto.randomUUID is unavailable', () => {
    const original = crypto.randomUUID;
    // Simulate a non-secure context where randomUUID throws / is absent
    (crypto as { randomUUID?: unknown }).randomUUID = undefined;
    try {
      expect(randomUUID()).toMatch(UUID_V4);
    } finally {
      (crypto as { randomUUID: typeof original }).randomUUID = original;
    }
  });
});
