// One quiet line at the bottom. While loading and with no hand in view it says
// so; otherwise it walks through the controls one at a time, each until it has
// been tried: point → peace sign → pinch → reach forward → open palm. A colour
// change shows the colour's name briefly.
import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import {
  ScreenSpaceUI,
  ScreenText,
  usePersonMaskTexture,
} from "@vincentt-xr/sdk";
import { useXRReady } from "@vincentt-xr/sdk/low-level";

import { PALETTE } from "./config";
import { graffiti } from "./state";

/** No hand for this long → "Raise your hand". */
const NO_HAND_AFTER = 1.5;
/** The colour name shows this long after a change (s). */
const COLOR_LABEL = 1.4;

/** The walkthrough: each step shows until its test passes. */
const STEPS: { text: string; done: () => boolean }[] = [
  { text: "☝️ Point your finger to draw", done: () => graffiti.strokes >= 2 },
  {
    text: "✌️ Peace sign for a new colour",
    done: () => graffiti.sinceColor !== Infinity,
  },
  { text: "🤏 Pinch to lift the pen", done: () => graffiti.pinches > 0 },
  {
    text: "Reach toward the camera to draw in front of you",
    done: () => graffiti.frontStrokes > 0,
  },
  { text: "✋ Open palm to wipe", done: () => graffiti.wipes > 0 },
];

export const Prompt = () => {
  const cameraReady = useXRReady();
  const { status } = usePersonMaskTexture();
  const [text, setText] = useState("");
  const noHand = useRef(0);

  useFrame((_s, dt) => {
    noHand.current = graffiti.tracked ? 0 : noHand.current + dt;
    let next = "";
    if (cameraReady && status === "loading") next = "Getting ready…";
    else if (graffiti.sinceColor < COLOR_LABEL)
      next = PALETTE[graffiti.colorIndex].name;
    else if (cameraReady && noHand.current > NO_HAND_AFTER)
      next = "Raise your hand";
    else if (graffiti.tracked) next = STEPS.find((s) => !s.done())?.text ?? "";
    if (next !== text) setText(next);
  });

  if (!text) return null;
  return (
    <ScreenSpaceUI>
      <ScreenText
        name="graffitiPrompt"
        text={text}
        screenTransform={{
          position: { x: 0, y: -560 },
          size: { width: 680, height: 70 },
          renderOrder: 200,
          overlay: true,
        }}
        textAlign="center"
        verticalAlign="center"
        fontFamily='system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
        fontWeight={600}
        fontSize={30}
        resolution={150}
        letterSpacing={0.04}
        color="rgba(240,242,248,0.85)"
        bgColor="transparent"
      />
    </ScreenSpaceUI>
  );
};
