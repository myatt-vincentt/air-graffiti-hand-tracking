import { describe, expect, it } from "vitest";

import { PEN } from "./config";
import { createPen, stepPen, widthForSpeed } from "./pen";

/** Move the pen in a straight line at `speed` px/s for `seconds`. */
const sweep = (speed: number, seconds: number, down = true) => {
  const pen = createPen();
  const out = [];
  for (let t = 0; t <= seconds; t += 1 / 60)
    out.push(...stepPen(pen, { x: 100 + speed * t, y: 600 }, down, 1 / 60));
  return { pen, segments: out };
};

describe("pen", () => {
  it("is thick when slow and thin when fast", () => {
    expect(widthForSpeed(0)).toBe(PEN.widthSlow);
    expect(widthForSpeed(1e5)).toBe(PEN.widthFast);
    const slow = sweep(150, 1).pen.width;
    const fast = sweep(3000, 0.25).pen.width;
    expect(slow).toBeGreaterThan(fast + 8);
  });

  it("draws a continuous stroke: each piece starts where the last ended", () => {
    const { segments } = sweep(600, 0.5);
    expect(segments.length).toBeGreaterThan(10);
    const [dot, ...rest] = segments;
    expect(dot.from).toEqual(dot.to); // a stroke starts with a dot
    for (let i = 1; i < rest.length; i++)
      expect(rest[i].from).toEqual(rest[i - 1].to);
  });

  it("draws nothing with the pen up, and starts fresh when it comes down", () => {
    const pen = createPen();
    expect(stepPen(pen, { x: 0, y: 0 }, false, 1 / 60)).toEqual([]);
    expect(pen.drawing).toBe(false);
    const segs = stepPen(pen, { x: 0, y: 0 }, true, 1 / 60);
    expect(segs).toHaveLength(1);
    expect(segs[0].from).toEqual(segs[0].to);
  });

  it("breaks the stroke on a jump instead of drawing across it", () => {
    const pen = createPen();
    stepPen(pen, { x: 0, y: 0 }, true, 1 / 60);
    stepPen(pen, { x: 10, y: 0 }, true, 1 / 60);
    // The fingertip reappears far away: a fresh dot there, no line across.
    const segs = stepPen(pen, { x: 600, y: 0 }, true, 1 / 60);
    expect(segs).toHaveLength(1);
    expect(segs[0].from).toEqual(segs[0].to);
    expect(segs[0].from.x).toBe(600);
    expect(stepPen(pen, null, true, 1 / 60)).toEqual([]);
    expect(pen.tip).toBeNull();
  });
});
