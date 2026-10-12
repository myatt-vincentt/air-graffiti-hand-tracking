// Tuning for Air Graffiti. Lengths in design px are on the 1280-tall design
// screen, so strokes keep their look at any resolution.

/** Neon colours, cycled by the peace sign. */
export const PALETTE = [
  { name: "Pink", color: "#ff3fa4" },
  { name: "Cyan", color: "#2ee6ff" },
  { name: "Lime", color: "#9dff3a" },
  { name: "Yellow", color: "#ffe23a" },
  { name: "Violet", color: "#a35bff" },
  { name: "Orange", color: "#ff8a2a" },
] as const;

/** The pen: the index fingertip, smoothed; width follows speed. */
export const PEN = {
  /** Fingertip smoothing rate (1/s): higher follows faster, lower is steadier. */
  smoothing: 22,
  /** Stroke width (design px): slow strokes are thick, fast ones thin. */
  widthSlow: 22,
  widthFast: 7,
  /** Speed (design px / s) from which a stroke counts as slow / fast. */
  speedSlow: 250,
  speedFast: 2400,
  /** Width smoothing rate (1/s), so it swells and thins gradually. */
  widthRate: 10,
  /** A fingertip jump longer than this (design px) in one frame starts a new stroke. */
  breakAt: 160,
  /** Points closer than this (design px) are skipped. */
  minStep: 2.5,
};

/** Neon tube: a coloured glow around a white-hot core. */
export const NEON = {
  /** Glow blur (design px) and the colour stroke's opacity (keep 1: with less,
   *  the round caps where pieces overlap show as beads). */
  glow: 18,
  glowAlpha: 1,
  /** Core width as a share of the stroke, and its opacity. */
  core: 0.38,
  coreAlpha: 1,
};

/** "By depth": reaching toward the camera paints in front of you. */
export const DEPTH = {
  /** Hand size vs its usual size: enter "front" above this, leave below `exit`. */
  enter: 1.22,
  exit: 1.12,
  /** Usual-size tracking (1/s): slow to grow (so a reach isn't absorbed), quicker to shrink. */
  grow: 0.25,
  shrink: 1.5,
};

/** Sparks from the fingertip while drawing. */
export const SPARKS = {
  max: 160,
  /** Per second while drawing: at rest and at full speed. */
  rate: 18,
  rateFast: 70,
  /** Speed (design px / s), life (s) and size (design px). */
  speed: [60, 260] as const,
  life: [0.25, 0.6] as const,
  size: [3, 7] as const,
  /** Downward pull (design px / s²). */
  gravity: 420,
};

/** Wipe: the strokes fade out over this long (s), then the canvas is cleared. */
export const WIPE = { fade: 0.35 };

/** Gestures (SDK gesture engine): hand model rate and holds. */
export const GESTURES = {
  fps: 30,
  /** Open palm must be held this long to wipe (ms). */
  wipeHoldMs: 450,
  /** Peace sign hold and the gap before the next colour change (ms). */
  peaceHoldMs: 200,
  peaceCooldownMs: 700,
};

/** The dimmed room behind everything (multiplies the feed). */
export const BACKGROUND = { tint: "#55555e" };

/** Stroke canvases: height in px (the width follows the screen's aspect). */
export const CANVAS = { height: 1280 };
