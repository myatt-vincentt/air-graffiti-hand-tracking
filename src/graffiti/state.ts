// Shared live state: gestures and the dev pen write it, the painter and the
// prompt read it. Plain mutable fields, read every frame (no React state).
import { PALETTE } from "./config";

export type DevInput = {
  /** Design px (x right, y down on the 1280-tall design screen). */
  x: number;
  y: number;
  down: boolean;
  front: boolean;
};

export const graffiti = {
  /** Index into PALETTE, and seconds since the last change (Infinity: never). */
  colorIndex: 0,
  sinceColor: Infinity,
  /** Live gestures (SDK gesture engine). */
  pointing: false,
  pinching: false,
  /** A wipe waiting to start, and wipes so far. */
  wipeRequested: false,
  wipes: 0,
  /** Counters for the prompt's walkthrough. */
  pinches: 0,
  strokes: 0,
  frontStrokes: 0,
  /** A hand (or the dev pen) is in view; the current stroke layer. */
  tracked: false,
  front: false,
  /** Dev-only mouse pen; overrides the hand while set. */
  dev: null as DevInput | null,
};

export const nextColor = () => {
  graffiti.colorIndex = (graffiti.colorIndex + 1) % PALETTE.length;
  graffiti.sinceColor = 0;
};

export const requestWipe = () => {
  graffiti.wipeRequested = true;
};
