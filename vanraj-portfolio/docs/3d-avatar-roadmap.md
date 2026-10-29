# 3D Avatar Roadmap

## What exists today

The Hero section (`client/src/components/three/`) renders a **procedural
placeholder avatar** built from primitive Three.js geometry (an icosahedron
head, a cone body, an orbiting torus ring and a handful of floating
particles), colored with the fixed brand palette and slowly rotated with
`@react-three/fiber`'s `useFrame`.

**This is not a rigged 3D character and should never be described as one.**
It exists so the Hero section has a real, lightweight, on-brand 3D
presence from day one, without waiting on final artwork or a modeled
character.

A separate, optional 2D image slot exists at
`client/public/images/avatar-concept.png` (see
`client/public/images/README.md`). It is shown as a small "concept art"
badge near the 3D scene. If the file isn't there, the app shows a dashed
placeholder instead of failing — it never fabricates a fake image.

## Fallback chain (in order)

1. **WebGL available** → `AvatarScene` (procedural 3D, lazy-loaded so it
   doesn't block the initial page render).
2. **WebGL unavailable** (`useWebGLSupport` returns `false`, or the Canvas
   throws and `CanvasErrorBoundary` catches it) → a CSS-only gradient
   "glow ring" fallback (`HeroAvatar.module.css`).
3. **`prefers-reduced-motion: reduce`** → the 3D scene still renders, but
   all rotation/animation is frozen (R3F's `frameloop="demand"` plus the
   `reducedMotion` check inside `Avatar3D`'s `useFrame`); the CSS fallback
   also disables its spin animation.

## Replacing the procedural avatar with a real rigged `.glb` model

When a real animated/rigged 3D avatar is ready (e.g. exported from
Blender, Mixamo, or a service like Ready Player Me):

1. Export it as a single optimized `.glb` (Draco/meshopt-compressed if
   possible — keep it under a few MB for mobile).
2. Place it at `client/public/models/avatar.glb`.
3. In `client/src/components/three/Avatar3D.jsx`, replace the primitive
   `<mesh>` elements with a loader, e.g.:

   ```jsx
   import { useGLTF } from '@react-three/drei';

   export default function Avatar3D({ reducedMotion }) {
     const { scene } = useGLTF('/models/avatar.glb');
     // apply the same reducedMotion-aware rotation to `scene` via useFrame
     return <primitive object={scene} />;
   }
   ```

4. If the model has animations (idle loop, wave, etc.), drive them with
   drei's `useAnimations` hook, and pause/skip them the same way rotation
   is currently paused when `reducedMotion` is true.
5. Keep `HeroAvatar.jsx`'s WebGL-detection and error-boundary fallback —
   a missing or failed-to-load `.glb` should still degrade to the CSS
   fallback rather than break the page. `useGLTF.preload('/models/avatar.glb')`
   combined with a try/catch around the loader (or an R3F `<Suspense>` +
   `ErrorBoundary`, already wired up) covers this.
6. Re-test on a low-end mobile device/profile — a rigged model with
   skinning is heavier than the current primitives, so you may need to
   lower `dpr`, shadow quality, or texture resolution further in
   `AvatarScene.jsx`.
