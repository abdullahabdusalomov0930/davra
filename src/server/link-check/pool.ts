import "server-only";

export type PoolOptions<T> = {
  /** Items with the same key run one after another (one request at a time per site). */
  keyOf: (item: T) => string;
  /** How many keys run at once. */
  concurrency: number;
  /** No new item starts after this time (ms since the epoch); items already running finish. */
  deadline: number;
  now?: () => number;
};

/**
 * Runs `work` for each item: different keys in parallel (up to `concurrency`), the same key in order.
 * Items keep their order within a key. Returns how many items were started before the deadline.
 * `work` must not throw; errors are the caller's to record.
 */
export async function forEachByKey<T>(
  items: readonly T[],
  work: (item: T) => Promise<void>,
  { keyOf, concurrency, deadline, now = Date.now }: PoolOptions<T>,
): Promise<number> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }

  const queue = [...groups.values()];
  let started = 0;

  async function worker() {
    for (let group = queue.shift(); group; group = queue.shift()) {
      for (const item of group) {
        if (now() >= deadline) return;
        started++;
        await work(item);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, worker));
  return started;
}
