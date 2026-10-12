// "By depth" — pure, unit-tested (depth.test.ts). A camera can't measure
// distance, but a hand reaching toward it looks bigger. The hand's usual size is
// tracked slowly; clearly bigger than usual means "in front of you".
import { DEPTH } from "./config";

export type Depth = {
  /** The hand's usual size (0 before the first sighting). */
  usual: number;
  /** Current size ÷ usual size. */
  ratio: number;
  front: boolean;
};

export const createDepth = (): Depth => ({ usual: 0, ratio: 1, front: false });

/** Feed this frame's hand size (any unit; null without a hand). Mutates `d`. */
export const updateDepth = (d: Depth, size: number | null, dt: number) => {
  if (size === null || size <= 0) return;
  if (d.usual <= 0) {
    d.usual = size;
    d.ratio = 1;
    d.front = false;
    return;
  }
  d.ratio = size / d.usual;
  d.front = d.front ? d.ratio > DEPTH.exit : d.ratio > DEPTH.enter;
  // Grow slowly (and not at all while in front, so a reach isn't absorbed into
  // "usual"); shrink faster, so stepping back is picked up.
  const step = Math.max(0, Math.min(dt, 0.25));
  let rate = DEPTH.grow;
  if (size < d.usual) rate = DEPTH.shrink;
  else if (d.front) rate = 0;
  d.usual += (size - d.usual) * (1 - Math.exp(-rate * step));
};
