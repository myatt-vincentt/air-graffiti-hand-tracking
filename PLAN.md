# Plan — Air Graffiti

The user's request (2026-10-12), from my suggestion list: draw glowing neon strokes in the air with
your index finger; pinch lifts the pen, peace sign changes colour, open palm wipes; strokes can sit
behind or in front of you. Preview with their hand video. There is no Brief.md.

## Decisions (the user's answers)

- **Gestures:** as written — **point (index only) to draw**, **pinch** to lift the pen, **open palm**
  to wipe, **peace sign** for a new colour. The preview clip is an open palm throughout, so it
  demos the wipe; a dev-only mouse pen tests drawing.
- **Layering:** **by depth** — reach toward the camera to paint in front of you.
- **Persistence:** strokes **stay until wiped**.
- **Look:** **neon glow tube**, **width by speed**, **dimmed camera**, **sparks at the tip**.
- **Preview:** the user's `palm_hand_preview_vertical.mov` (1080×1920, 11 s) was moved out of
  `public/` into `dev-media/` and repackaged without audio as `dev-media/hand.mp4` (stream copy).
  Both are git-ignored and never ship. Without the clip, the switcher starts on the SDK's "Person
  ThumbUp" video.

## Composition

| renderOrder | Layer         | What                                                    |
| ----------- | ------------- | ------------------------------------------------------- |
| 0           | background    | camera `ScreenImage`, tinted `#55555e`                  |
| 50          | strokes back  | stroke canvas: strokes drawn at your usual distance     |
| 100         | you           | `PersonCutout`                                          |
| 150         | strokes front | stroke canvas: strokes drawn reaching toward the camera |
| 160         | sparks        | points from the fingertip while drawing                 |
| 170         | cursor        | dot (pen down) / ring (pen up) at the fingertip         |

The stroke layers, sparks and cursor draw straight to clip space, outside any `ScreenTransform`:
its group carries renderOrder 1000 and three sorts by the group's order first, which would lift
the "behind" strokes above `PersonCutout` (found in Time Clone).

## Pipeline

1. **Hand**: `<HandTracker />` + `useXRModelNode(XRModel.HAND_TRACKER).coordinates` (first hand);
   index tip (8) is the pen, wrist (0) → middle base (9) the hand size. Tracker points (centre
   origin, y up, mirrored by the SDK) map onto design px (1280 tall, x right, y down).
2. **Gestures** (`Gestures.tsx`, SDK gesture engine, 30 fps): `oneFinger` → pen down while held,
   `pinch` → pen up while held, `openPalm` held 450 ms → wipe, `peaceSign` (200 ms hold, 700 ms
   cooldown) → next colour. `onBegin` fires once per gesture.
3. **Pen** (`pen.ts`, pure, tested): the fingertip smoothed (rate 22/s); width eases from 22 px
   (slow) to 7 px (fast, ≥ 2400 px/s); strokes are quadratic curves midpoint-to-midpoint. A raw
   fingertip jump > 160 px (a tracking glitch, or putting the pen down somewhere new) snaps the
   pen and starts a new stroke rather than drawing across.
4. **Depth** (`depth.ts`, pure, tested): a camera can't measure distance, but a reaching hand
   looks bigger. The hand's usual size is tracked slowly (not at all while in front, faster when
   it shrinks); size ÷ usual > 1.22 → front, < 1.12 → back again. A stroke keeps the layer it
   started on.
5. **Paint**: each piece goes into the back or front 2D canvas (720 × 1280 on a 9:16 screen) as
   neon — the colour stroke with an 18 px blur glow, then a white-hot core at 38 % width; both
   opaque (with less, overlapping round caps show as beads). Canvases upload only when changed and
   are drawn additively.
6. **Wipe**: both layers fade out over 0.35 s, then the canvases are cleared. No drawing meanwhile.
7. **Sparks**: 18–70 per second from the tip while drawing (more when fast), falling with gravity.
8. **Prompt**: "Raise your hand" without a hand; otherwise a walkthrough, each step until tried:
   point → peace sign → pinch → reach forward → open palm; the colour's name after a change.

## Notes

- Verified in the built-in preview: the clip's open palm wipes (canvas fully cleared); the dev pen
  draws neon with width by speed; back strokes pass behind the hand, front strokes over it; the
  SDK "Person Peace Sign" photo changes the colour. Pointing and pinching need a real hand (no
  sample shows them), so check on a phone.
- The depth estimate is a heuristic: strong head/body movement toward the camera can also read as
  a reach.

## Production

- The dev media switcher, the dev mouse pen and the `window.__graffiti` hook are dev-only (inline
  `NODE_ENV` guards).
