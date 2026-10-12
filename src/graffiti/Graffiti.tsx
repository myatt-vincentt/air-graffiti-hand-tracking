// Air Graffiti: draw glowing neon strokes in the air with your index finger.
// Composed the SDK's way for portrait segmentation — one ScreenSpaceUI:
//
//   renderOrder 0    background    — the camera, dimmed (ScreenImage)
//   renderOrder 50   strokes back  — strokes drawn at your usual distance: behind you
//   renderOrder 100  you           — PersonCutout
//   renderOrder 150  strokes front — strokes drawn reaching toward the camera
//   renderOrder 160  sparks        — from the fingertip while drawing
//   renderOrder 170  cursor        — a dot (pen down) or ring (pen up) at the tip
//
// Strokes are painted into two 2D canvases (neon: a blurred colour stroke, then
// a white-hot core) shown as full-screen textures. Those layers, the sparks and
// the cursor draw straight to clip space, outside any ScreenTransform: its group
// carries renderOrder 1000, and three sorts by the group's order first, which
// would lift "behind" strokes above PersonCutout.
//
// Coordinates are design px (the 1280-tall design screen, x right, y down);
// tracker points (centre origin, y up, already mirrored by the SDK) map
// straight onto it because the feed fills the screen.
import { Suspense, useEffect, useMemo, useRef } from "react";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  ShaderMaterial,
  SRGBColorSpace,
} from "three";
import { useFrame, useThree } from "@react-three/fiber";
import {
  FULL_SCREEN_ANCHORS,
  PersonCutout,
  ScreenImage,
  ScreenSpaceUI,
  XRModel,
} from "@vincentt-xr/sdk";
import {
  useXRCameraTexture,
  useXRModelNode,
  type XRModelNodeHandTracking,
} from "@vincentt-xr/sdk/low-level";
import { HandTracker } from "@vincentt-xr/sdk/tracking";

import { BACKGROUND, CANVAS, NEON, PALETTE, SPARKS, WIPE } from "./config";
import { createDepth, updateDepth } from "./depth";
import { createPen, type Segment, stepPen } from "./pen";
import { graffiti } from "./state";

const DESIGN_H = 1280;
// Hand landmarks (MediaPipe).
const WRIST = 0;
const INDEX_TIP = 8;
const MIDDLE_BASE = 9;

/** A full-screen quad straight to clip space, showing a stroke canvas. */
const layerVert = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy * 2.0, 0.0, 1.0); }
`;
const layerFrag = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    vec4 c = texture2D(uMap, vUv);
    gl_FragColor = vec4(c.rgb, c.a * uOpacity);
    #include <colorspace_fragment>
  }
`;

/** Points in design px, straight to clip space (sparks and the cursor). */
const pointsVert = /* glsl */ `
  attribute vec3 color;
  attribute float size;
  attribute float alpha;
  uniform vec2 uDesign;
  uniform float uPxScale;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vColor = color;
    vAlpha = alpha;
    gl_PointSize = size * uPxScale;
    gl_Position = vec4(position.x / uDesign.x * 2.0 - 1.0, 1.0 - position.y / uDesign.y * 2.0, 0.0, 1.0);
  }
`;
const sparkFrag = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float core = smoothstep(0.5, 0.0, length(p));
    float cross = max(smoothstep(0.08, 0.0, abs(p.x)) * smoothstep(0.5, 0.1, abs(p.y)),
                      smoothstep(0.08, 0.0, abs(p.y)) * smoothstep(0.5, 0.1, abs(p.x)));
    float a = max(core * core, cross * 0.7) * vAlpha;
    gl_FragColor = vec4(mix(vColor, vec3(1.0), core * 0.5) * a, a);
  }
`;
/** Cursor: a glowing dot with the pen down, a ring with it up. */
const cursorFrag = /* glsl */ `
  uniform float uDown;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float dot = smoothstep(0.55, 0.15, d);
    float ring = smoothstep(0.12, 0.0, abs(d - 0.7)) + smoothstep(1.0, 0.6, d) * 0.25;
    float a = mix(ring, dot, uDown) * vAlpha;
    gl_FragColor = vec4(mix(vColor, vec3(1.0), dot * uDown * 0.6) * a, a);
  }
`;

type Layer = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  texture: CanvasTexture;
  material: ShaderMaterial;
  dirty: boolean;
};

const makeLayer = (w: number, h: number): Layer => {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  const material = new ShaderMaterial({
    uniforms: { uMap: { value: texture }, uOpacity: { value: 1 } },
    vertexShader: layerVert,
    fragmentShader: layerFrag,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    // Light adds up: neon over a dim room.
    blending: AdditiveBlending,
  });
  return { canvas, ctx, texture, material, dirty: false };
};

/** Paint one stroke piece as neon: coloured glow, then a white-hot core. */
const paint = (layer: Layer, seg: Segment, color: string, scale: number) => {
  const { ctx } = layer;
  const s = (p: { x: number; y: number }) =>
    [p.x * scale, p.y * scale] as const;
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(...s(seg.from));
    ctx.quadraticCurveTo(...s(seg.ctrl), ...s(seg.to));
  };
  const w = seg.width * scale;
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = NEON.glow * scale;
  ctx.globalAlpha = NEON.glowAlpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  path();
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.globalAlpha = NEON.coreAlpha;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = Math.max(1, w * NEON.core);
  path();
  ctx.stroke();
  ctx.restore();
  layer.dirty = true;
};

const makePoints = (n: number, fragmentShader: string) => {
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new BufferAttribute(new Float32Array(n * 3), 3),
  );
  geometry.setAttribute(
    "color",
    new BufferAttribute(new Float32Array(n * 3), 3),
  );
  geometry.setAttribute("size", new BufferAttribute(new Float32Array(n), 1));
  geometry.setAttribute("alpha", new BufferAttribute(new Float32Array(n), 1));
  const material = new ShaderMaterial({
    uniforms: {
      uDesign: { value: [DESIGN_H, DESIGN_H] },
      uPxScale: { value: 1 },
      uDown: { value: 0 },
    },
    vertexShader: pointsVert,
    fragmentShader,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  return { geometry, material };
};

const rand = ([a, b]: readonly [number, number]) => a + Math.random() * (b - a);

const GraffitiLayers = () => {
  const { gl, size } = useThree();
  const cameraTexture = useXRCameraTexture();
  const hands = useXRModelNode<XRModelNodeHandTracking>(XRModel.HAND_TRACKER);

  const aspect = size.width / Math.max(1, size.height);
  const designW = DESIGN_H * aspect;
  const layers = useMemo(() => {
    const h = CANVAS.height;
    const w = Math.max(2, Math.round(h * aspect));
    return {
      back: makeLayer(w, h),
      front: makeLayer(w, h),
      scale: h / DESIGN_H,
    };
    // Rebuilt only when the aspect changes noticeably (a rotation); strokes reset.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Math.round(aspect * 20)]);

  const sparks = useMemo(() => {
    const p = makePoints(SPARKS.max, sparkFrag);
    return {
      ...p,
      vel: new Float32Array(SPARKS.max * 2),
      life: new Float32Array(SPARKS.max),
      maxLife: new Float32Array(SPARKS.max),
      base: new Float32Array(SPARKS.max),
      cursor: 0,
      debt: 0,
    };
  }, []);
  const cursor = useMemo(() => makePoints(1, cursorFrag), []);
  const pen = useMemo(createPen, []);
  const depth = useMemo(createDepth, []);
  const color = useMemo(() => new Color(), []);
  const wipe = useRef(-1); // seconds into a wipe, −1 when none
  const strokeLayer = useRef<"back" | "front">("back");

  useEffect(
    () => () => {
      for (const l of [layers.back, layers.front]) {
        l.texture.dispose();
        l.material.dispose();
      }
    },
    [layers],
  );
  useEffect(
    () => () => {
      for (const p of [sparks, cursor]) {
        p.geometry.dispose();
        p.material.dispose();
      }
    },
    [sparks, cursor],
  );

  // Dev hook for inspecting the painter live.
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      (window as unknown as { __graffiti?: unknown }).__graffiti = {
        state: graffiti,
        pen,
        depth,
        layers,
        gl,
      };
    }
  }, [pen, depth, layers, gl]);

  useFrame((_s, dt) => {
    graffiti.sinceColor += dt;
    const paletteColor = PALETTE[graffiti.colorIndex].color;

    // Input: the dev pen while set, otherwise the first hand's index fingertip.
    let tip: { x: number; y: number } | null = null;
    let down = false;
    let handSize: number | null = null;
    const { dev } = graffiti;
    if (dev) {
      tip = { x: dev.x, y: dev.y };
      down = dev.down;
    } else {
      const pts = hands?.coordinates;
      if (pts && pts.length > MIDDLE_BASE) {
        const at = (i: number) => ({
          x: (pts[i].x * 0.5 + 0.5) * designW,
          y: (0.5 - pts[i].y * 0.5) * DESIGN_H,
        });
        tip = at(INDEX_TIP);
        const w = at(WRIST);
        const m = at(MIDDLE_BASE);
        handSize = Math.hypot(w.x - m.x, w.y - m.y);
        down = graffiti.pointing && !graffiti.pinching;
      }
    }
    graffiti.tracked = tip !== null;
    updateDepth(depth, handSize, dt);
    const front = dev ? dev.front : depth.front;
    graffiti.front = front;

    // No drawing during a wipe.
    const segments = stepPen(pen, tip, down && wipe.current < 0, dt);
    for (const seg of segments) {
      const fresh = seg.from.x === seg.to.x && seg.from.y === seg.to.y;
      if (fresh) {
        // A stroke keeps the layer it started on.
        strokeLayer.current = front ? "front" : "back";
        graffiti.strokes++;
        if (front) graffiti.frontStrokes++;
      }
      paint(layers[strokeLayer.current], seg, paletteColor, layers.scale);
    }
    for (const l of [layers.back, layers.front]) {
      if (l.dirty) {
        l.texture.needsUpdate = true;
        l.dirty = false;
      }
    }

    // Wipe: fade both layers out, then clear them.
    if (graffiti.wipeRequested) {
      graffiti.wipeRequested = false;
      if (wipe.current < 0) wipe.current = 0;
    }
    if (wipe.current >= 0) {
      wipe.current += dt;
      const o = Math.max(0, 1 - wipe.current / WIPE.fade);
      layers.back.material.uniforms.uOpacity.value = o;
      layers.front.material.uniforms.uOpacity.value = o;
      if (o === 0) {
        for (const l of [layers.back, layers.front]) {
          l.ctx.clearRect(0, 0, l.canvas.width, l.canvas.height);
          l.texture.needsUpdate = true;
          l.material.uniforms.uOpacity.value = 1;
        }
        wipe.current = -1;
        graffiti.wipes++;
      }
    }

    // Sparks from the tip while drawing, more when fast.
    const pxScale = (size.height * gl.getPixelRatio()) / DESIGN_H;
    for (const p of [sparks, cursor]) {
      p.material.uniforms.uDesign.value = [designW, DESIGN_H];
      p.material.uniforms.uPxScale.value = pxScale;
    }
    color.set(paletteColor);
    const pos = sparks.geometry.getAttribute("position") as BufferAttribute;
    const col = sparks.geometry.getAttribute("color") as BufferAttribute;
    const sz = sparks.geometry.getAttribute("size") as BufferAttribute;
    const al = sparks.geometry.getAttribute("alpha") as BufferAttribute;
    if (pen.drawing && pen.tip) {
      const fast = Math.min(1, pen.speed / 2400);
      sparks.debt +=
        dt * (SPARKS.rate + (SPARKS.rateFast - SPARKS.rate) * fast);
      while (sparks.debt >= 1) {
        sparks.debt -= 1;
        const i = sparks.cursor;
        sparks.cursor = (i + 1) % SPARKS.max;
        const a = Math.random() * Math.PI * 2;
        const v = rand(SPARKS.speed);
        pos.setXYZ(i, pen.tip.x, pen.tip.y, 0);
        sparks.vel[i * 2] = Math.cos(a) * v;
        sparks.vel[i * 2 + 1] = Math.sin(a) * v - 80;
        col.setXYZ(i, color.r, color.g, color.b);
        const life = rand(SPARKS.life);
        sparks.life[i] = life;
        sparks.maxLife[i] = life;
        sparks.base[i] = rand(SPARKS.size);
      }
    } else {
      sparks.debt = 0;
    }
    for (let i = 0; i < SPARKS.max; i++) {
      if (sparks.life[i] <= 0) {
        al.setX(i, 0);
        continue;
      }
      sparks.life[i] -= dt;
      sparks.vel[i * 2 + 1] += SPARKS.gravity * dt;
      pos.setXYZ(
        i,
        pos.getX(i) + sparks.vel[i * 2] * dt,
        pos.getY(i) + sparks.vel[i * 2 + 1] * dt,
        0,
      );
      const k = Math.max(0, sparks.life[i] / sparks.maxLife[i]);
      al.setX(i, k);
      sz.setX(i, sparks.base[i] * (0.4 + 0.6 * k));
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
    sz.needsUpdate = true;
    al.needsUpdate = true;

    // Cursor at the tip: bigger when painting in front.
    const cp = cursor.geometry.getAttribute("position") as BufferAttribute;
    const cc = cursor.geometry.getAttribute("color") as BufferAttribute;
    const cs = cursor.geometry.getAttribute("size") as BufferAttribute;
    const ca = cursor.geometry.getAttribute("alpha") as BufferAttribute;
    if (pen.tip) {
      cp.setXYZ(0, pen.tip.x, pen.tip.y, 0);
      cc.setXYZ(0, color.r, color.g, color.b);
      const base = pen.drawing ? pen.width * 1.4 : 34;
      cs.setX(0, base * (front ? 1.35 : 1));
      ca.setX(0, 0.95);
    } else {
      ca.setX(0, 0);
    }
    cursor.material.uniforms.uDown.value = pen.drawing ? 1 : 0;
    for (const a of [cp, cc, cs, ca]) a.needsUpdate = true;
  }, -0.5);

  return (
    <>
      <ScreenSpaceUI>
        {cameraTexture ? (
          <ScreenImage
            name="graffitiBackground"
            source={{ kind: "texture", texture: cameraTexture }}
            anchors={FULL_SCREEN_ANCHORS}
            fit="stretch"
            color={BACKGROUND.tint}
            renderOrder={0}
          />
        ) : null}
        <PersonCutout name="graffitiPerson" renderOrder={100} />
      </ScreenSpaceUI>
      <mesh
        name="strokesBack"
        material={layers.back.material}
        renderOrder={50}
        frustumCulled={false}
      >
        <planeGeometry args={[1, 1]} />
      </mesh>
      <mesh
        name="strokesFront"
        material={layers.front.material}
        renderOrder={150}
        frustumCulled={false}
      >
        <planeGeometry args={[1, 1]} />
      </mesh>
      <points
        name="sparks"
        geometry={sparks.geometry}
        material={sparks.material}
        renderOrder={160}
        frustumCulled={false}
      />
      <points
        name="cursor"
        geometry={cursor.geometry}
        material={cursor.material}
        renderOrder={170}
        frustumCulled={false}
      />
    </>
  );
};

export const Graffiti = () => (
  <>
    <HandTracker />
    {/* ScreenImage / PersonCutout load a default image through a suspending
        loader; mounted mid-session they need their own boundary. */}
    <Suspense fallback={null}>
      <GraffitiLayers />
    </Suspense>
  </>
);
