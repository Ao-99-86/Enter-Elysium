# Piano

Notes on the grand piano in `src/components/ElysiumScene.tsx` (`RealisticPiano`, around line 1338) and what we could try next.

## Current state

- `public/models/grand-piano.glb` — 20 MB mesh, untextured.
- PBR textures sit alongside it but are **not currently loaded**:
  - `grand-piano_base_color.png` (5.6 MB)
  - `grand-piano_normal.png` (6.1 MB)
  - `grand-piano_roughness.png` (1.1 MB)
  - `grand-piano_metallic.png` (48 KB)
  - `grand-piano_emission.png` (12 KB)
- `RealisticPiano` clones the GLB scene and overrides **every** mesh material with a single `MeshStandardMaterial` (`color #08090c`, `metalness 0.78`, `roughness 0.18`, `envMapIntensity 1.2`). One cyan `pointLight` provides the body uplight.
- An earlier attempt to ship the fully textured GLB (~62 MB) exhausted browser GPU memory, hence the polished-black override.
- With the new postprocessing pipeline (ACES tone mapping + bloom), the metallic highlights now read much closer to "photo-real" without textures — this is the cheapest improvement that already shipped.

## Options to push further (cheapest → most invasive)

1. **Re-enable the PBR textures, but only on the body** — traverse the cloned scene, match the polished-black body mesh by name, and assign `map`/`normalMap`/`roughnessMap`/`metalnessMap` only there. Keep the override on smaller meshes. Risk: still ~13 MB of PNGs to download.
2. **KTX2 / Basis-compressed textures** — convert the five PNGs to `.ktx2` (via `toktx` or `gltf-transform`). Typically 3–6× smaller and uploaded to the GPU compressed, so VRAM also drops. drei's `useKTX2` covers loading. Likely the biggest realism-per-byte win.
3. **Draco-compress the mesh** — `gltf-transform draco public/models/grand-piano.glb` usually shrinks geometry 5–10×. Pair with KTX2 and the textured piano could land under 10 MB total.
4. **Pre-bake the environment / lighting** — wrap the piano in a small `<Environment>` from drei with a custom HDRI (or use a tiny baked cubemap). Bloom + a good envmap reads more "photo" than any single material tweak.
5. **LOD swap** — load the cheap polished-black version by default; only fetch the textured GLB when the camera is close. drei `Detailed` handles the distance check. Defers the cost until the user opts in by moving in.
6. **Quality toggle in the UI** — add a "Cinematic" switch that lazy-loads the textured/KTX2 piano + maybe `DepthOfField`. Lets us keep the default lightweight and still offer the upgrade.
7. **Replace the GLB with a hand-tuned low-poly piano** — fewer triangles, custom shader for the polished lid. Reads cleanly with bloom, no texture download at all. Most work, but smallest payload.
8. **Hide on mobile** — current `MobileChrome` already runs the scene at reduced cost; the piano could be skipped entirely below the `size.width < 700` breakpoint if perf becomes the bottleneck.

## Recommended path if we revisit

KTX2 + Draco (options 2 + 3) together, then re-enable textures on the body mesh only (option 1). That keeps the polished-black fallback for the rest of the mesh, ships under ~10 MB, and avoids the GPU-memory blowup that killed the original textured version.

## What NOT to do

- Don't load the original 62 MB textured GLB as-is — same OOM crash as before.
- Don't enable all five PBR maps at full resolution without compression; the bloom pass already covers most of what specular highlights would buy.
