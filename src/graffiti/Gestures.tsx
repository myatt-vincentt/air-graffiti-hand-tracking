// The controls, from the SDK's gesture engine (one shared hand model):
//   ☝️ point (index only)  → pen down     🤏 pinch  → pen up
//   ✋ open palm (held)     → wipe         ✌️ peace → next colour
// `onBegin` fires once per gesture, so holding a sign doesn't repeat it.
import { useGesture } from "@vincentt-xr/sdk/tracking";

import { GESTURES } from "./config";
import { graffiti, nextColor, requestWipe } from "./state";

export const Gestures = () => {
  const base = { targetFps: GESTURES.fps };
  useGesture("oneFinger", {
    ...base,
    onBegin: () => {
      graffiti.pointing = true;
    },
    onEnd: () => {
      graffiti.pointing = false;
    },
  });
  useGesture("pinch", {
    ...base,
    onBegin: () => {
      graffiti.pinching = true;
      graffiti.pinches++;
    },
    onEnd: () => {
      graffiti.pinching = false;
    },
  });
  useGesture("openPalm", {
    ...base,
    holdMs: GESTURES.wipeHoldMs,
    onBegin: requestWipe,
  });
  useGesture("peaceSign", {
    ...base,
    holdMs: GESTURES.peaceHoldMs,
    cooldownMs: GESTURES.peaceCooldownMs,
    onBegin: nextColor,
  });
  return null;
};
