import { describe, expect, it, vi } from 'vitest';
import { withRetry } from '@/services/gemini.service.js';

const transient = Object.assign(new Error('Service Unavailable'), { status: 503 });

describe('withRetry', () => {
  it('retries transient errors with exponential backoff', async () => {
    const fn = vi.fn().mockRejectedValueOnce(transient).mockRejectedValueOnce(transient).mockResolvedValue('ok');
    const sleep = vi.fn().mockResolvedValue();
    await expect(withRetry(fn, { sleep })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([500, 1000]);
  });

  it('does not retry permanent errors', async () => {
    const fn = vi.fn().mockRejectedValue(Object.assign(new Error('bad request'), { status: 400 }));
    await expect(withRetry(fn, { sleep: vi.fn() })).rejects.toThrow('bad request');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('gives up after the retry limit', async () => {
    const fn = vi.fn().mockRejectedValue(transient);
    await expect(withRetry(fn, { retries: 2, sleep: vi.fn() })).rejects.toThrow('Service Unavailable');
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
