// The pen — pure, unit-tested (pen.test.ts). Smooths the fingertip, sets the
// width from speed, and turns movement into stroke segments for the painter.
// Units are design px (the 1280-tall design screen), x right, y down.
import { PEN } from "./config";

export type Pt = { x: number; y: number };

/** One piece of a stroke: a quadratic curve from `from` via `ctrl` to `to`. */
export type Segment = {
  from: Pt;
  ctrl: Pt;
  to: Pt;
  /** Width (design px) at the end of the piece. */
  width: number;
};

export type Pen = {
  /** Smoothed fingertip, or null with no hand; and last frame's raw fingertip. */
  tip: Pt | null;
  raw: Pt | null;
  /** Last point added to the stroke, and the midpoint the next curve starts from. */
  last: Pt | null;
  mid: Pt | null;
  width: number;
  /** Smoothed speed (design px / s). */
  speed: number;
  /** True while a stroke is in progress. */
  drawing: boolean;
};

export const createPen = (): Pen => ({
  tip: null,
  raw: null,
  last: null,
  mid: null,
  width: PEN.widthSlow,
  speed: 0,
  drawing: false,
});

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

/** Width for a speed: thick when slow, thin when fast. */
export const widthForSpeed = (speed: number) => {
  const t = clamp01((speed - PEN.speedSlow) / (PEN.speedFast - PEN.speedSlow));
  return PEN.widthSlow + (PEN.widthFast - PEN.widthSlow) * t;
};

/**
 * Advance the pen one frame. `raw` is the fingertip (null without a hand),
 * `down` whether the pen touches (pointing, not pinching). Returns the stroke
 * pieces to paint this frame. Mutates `pen`.
 */
export const stepPen = (
  pen: Pen,
  raw: Pt | null,
  down: boolean,
  dt: number,
): Segment[] => {
  if (!raw) {
    pen.tip = null;
    pen.raw = null;
    pen.drawing = false;
    pen.last = null;
    pen.mid = null;
    pen.speed = 0;
    return [];
  }
  const step = Math.max(1e-3, Math.min(dt, 0.1));
  const prev = pen.tip;
  // A jump in the raw fingertip (a tracking glitch, or the pen put down
  // somewhere new) snaps the pen there and ends the stroke, rather than the
  // smoothing gliding across and drawing a line.
  const jumped = !!pen.raw && dist(raw, pen.raw) > PEN.breakAt;
  pen.raw = { ...raw };
  if (!prev || jumped) {
    pen.tip = { ...raw };
    pen.speed = 0;
    pen.drawing = false;
  } else {
    const k = 1 - Math.exp(-PEN.smoothing * step);
    pen.tip = {
      x: prev.x + (raw.x - prev.x) * k,
      y: prev.y + (raw.y - prev.y) * k,
    };
    const v = dist(pen.tip, prev) / step;
    pen.speed += (v - pen.speed) * (1 - Math.exp(-PEN.widthRate * step));
  }
  const { tip } = pen;

  if (!down) {
    pen.drawing = false;
    pen.last = null;
    pen.mid = null;
    return [];
  }

  const targetWidth = widthForSpeed(pen.speed);
  pen.width +=
    (targetWidth - pen.width) * (1 - Math.exp(-PEN.widthRate * step));

  // A fresh stroke starts with a dot.
  if (!pen.drawing || !pen.last) {
    pen.drawing = true;
    pen.last = { ...tip };
    pen.mid = { ...tip };
    pen.width = targetWidth;
    return [
      { from: { ...tip }, ctrl: { ...tip }, to: { ...tip }, width: pen.width },
    ];
  }
  if (dist(tip, pen.last) < PEN.minStep) return [];

  // Smooth curve: midpoint to midpoint, through the last point.
  const mid = { x: (pen.last.x + tip.x) / 2, y: (pen.last.y + tip.y) / 2 };
  const seg: Segment = {
    from: pen.mid ?? { ...pen.last },
    ctrl: { ...pen.last },
    to: mid,
    width: pen.width,
  };
  pen.last = { ...tip };
  pen.mid = mid;
  return [seg];
};
