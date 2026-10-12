import { describe, expect, it } from "vitest";

import { DEPTH } from "./config";
import { createDepth, updateDepth } from "./depth";

const hold = (
  d: ReturnType<typeof createDepth>,
  size: number,
  seconds: number,
) => {
  for (let t = 0; t < seconds; t += 1 / 30) updateDepth(d, size, 1 / 30);
};

describe("depth", () => {
  it("learns the usual size and stays behind at it", () => {
    const d = createDepth();
    hold(d, 100, 2);
    expect(d.usual).toBeCloseTo(100);
    expect(d.front).toBe(false);
  });

  it("goes in front on a reach, stays there while reaching, and comes back", () => {
    const d = createDepth();
    hold(d, 100, 2);
    hold(d, 100 * (DEPTH.enter + 0.1), 3);
    expect(d.front).toBe(true);
    expect(d.usual).toBeCloseTo(100, 0); // the reach isn't absorbed
    hold(d, 100, 0.2);
    expect(d.front).toBe(false);
  });

  it("has hysteresis between enter and exit", () => {
    const d = createDepth();
    hold(d, 100, 2);
    hold(d, 100 * ((DEPTH.enter + DEPTH.exit) / 2), 1);
    expect(d.front).toBe(false); // not far enough to enter
    hold(d, 100 * (DEPTH.enter + 0.05), 0.2);
    hold(d, 100 * ((DEPTH.enter + DEPTH.exit) / 2), 1);
    expect(d.front).toBe(true); // not far enough back to leave
  });

  it("follows someone stepping back (smaller hand) quickly", () => {
    const d = createDepth();
    hold(d, 100, 2);
    hold(d, 60, 3);
    expect(d.usual).toBeLessThan(65);
    expect(d.front).toBe(false);
  });
});
