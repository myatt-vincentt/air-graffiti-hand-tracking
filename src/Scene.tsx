// Scene.tsx — Air Graffiti: draw glowing neon strokes in the air with your
// index finger; pinch to lift the pen, peace sign for a new colour, open palm to
// wipe; reach toward the camera to paint in front of you. See PLAN.md.
import { lazy, Suspense } from "react";

import { ExperienceStatus } from "./graffiti/ExperienceStatus";
import { Gestures } from "./graffiti/Gestures";
import { Graffiti } from "./graffiti/Graffiti";
import { Prompt } from "./graffiti/Prompt";

// Dev-only tools (media switcher; mouse pen) for previewing without a camera.
// Lazy and behind a constant esbuild folds to false in production. Two rules:
// `process.env.NODE_ENV`, not `import.meta.env.DEV` (vincentt-xr/v2-template#112);
// and write the check INSIDE each ternary — hoisted into a `const`, esbuild
// keeps the dead branch.
const DevMediaSwitcher =
  process.env.NODE_ENV !== "production"
    ? lazy(() => import("./DevMediaSwitcher"))
    : null;
const DevPen =
  process.env.NODE_ENV !== "production" ? lazy(() => import("./DevPen")) : null;

export const Scene = () => (
  <>
    <ExperienceStatus />
    <Gestures />
    <Graffiti />
    <Prompt />
    {DevMediaSwitcher ? (
      <Suspense fallback={null}>
        <DevMediaSwitcher />
      </Suspense>
    ) : null}
    {DevPen ? (
      <Suspense fallback={null}>
        <DevPen />
      </Suspense>
    ) : null}
  </>
);
