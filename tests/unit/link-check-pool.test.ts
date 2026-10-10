import { describe, expect, it } from "vitest";

import { forEachByKey } from "@/server/link-check/pool";

const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

describe("forEachByKey", () => {
  const items = ["a1", "b1", "a2", "c1", "b2", "a3"];
  const keyOf = (item: string) => item[0];

  it("runs every item, one at a time per key and in order within a key", async () => {
    const running = new Set<string>();
    const finished: string[] = [];
    let peak = 0;

    const started = await forEachByKey(
      items,
      async (item) => {
        expect(running.has(keyOf(item))).toBe(false);
        running.add(keyOf(item));
        peak = Math.max(peak, running.size);
        await tick();
        running.delete(keyOf(item));
        finished.push(item);
      },
      { keyOf, concurrency: 2, deadline: Infinity },
    );

    expect(started).toBe(items.length);
    expect(peak).toBe(2);
    expect(finished.filter((item) => item.startsWith("a"))).toEqual(["a1", "a2", "a3"]);
    expect(finished.filter((item) => item.startsWith("b"))).toEqual(["b1", "b2"]);
  });

  it("starts nothing after the deadline and lets running items finish", async () => {
    let clock = 0;
    const finished: string[] = [];

    const started = await forEachByKey(
      items,
      async (item) => {
        clock += 10;
        await tick();
        finished.push(item);
      },
      { keyOf, concurrency: 1, deadline: 25, now: () => clock },
    );

    expect(started).toBe(3);
    expect(finished).toEqual(["a1", "a2", "a3"]);
  });

  it("handles an empty list", async () => {
    expect(await forEachByKey([], async () => {}, { keyOf, concurrency: 4, deadline: Infinity })).toBe(0);
  });
});
