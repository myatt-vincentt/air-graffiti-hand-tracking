// DevPen.tsx — dev-only: draw with the mouse in a browser without a camera (the
// built-in preview), since the preview clip only shows an open palm.
//   drag            draw (shift-drag: in front of you)
//   C               next colour (like a peace sign)
//   W               wipe (like an open palm)
// While the mouse is over the scene it stands in for the hand; leaving it
// hands control back. Never reaches production: Scene.tsx lazy-imports this
// behind an inline `process.env.NODE_ENV` check, which esbuild folds.
import { useEffect } from "react";
import { useThree } from "@react-three/fiber";

import { graffiti, nextColor, requestWipe } from "./graffiti/state";

const DESIGN_H = 1280;

const DevPen = () => {
  const source = useThree((s) => s.events.connected) as HTMLElement | undefined;

  useEffect(() => {
    const el = source;
    if (!el) return undefined;
    const toDesign = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const scale = DESIGN_H / Math.max(1, r.height);
      return {
        x: (e.clientX - r.left) * scale,
        y: (e.clientY - r.top) * scale,
      };
    };
    const move = (e: PointerEvent) => {
      const p = toDesign(e);
      graffiti.dev = {
        ...p,
        down: e.buttons % 2 === 1,
        front: e.shiftKey,
      };
    };
    const leave = () => {
      graffiti.dev = null;
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "c" || e.key === "C") nextColor();
      if (e.key === "w" || e.key === "W") requestWipe();
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerdown", move);
    el.addEventListener("pointerup", move);
    el.addEventListener("pointerleave", leave);
    window.addEventListener("keydown", key);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerdown", move);
      el.removeEventListener("pointerup", move);
      el.removeEventListener("pointerleave", leave);
      window.removeEventListener("keydown", key);
    };
  }, [source]);

  return null;
};

export default DevPen;
