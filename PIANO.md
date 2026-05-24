# Piano

Notes on the grand piano in `src/components/ElysiumScene.tsx` (`RealisticPiano`, around line 1338).

## What the source asset actually is

Inspecting `assets/grand-piano.glb` (the original Meshy export, kept out of `public/` so it is not
deployed) revealed the real situation — which is different from earlier assumptions:

- It is a **single mesh** ("Mesh1") with **0 materials, 0 textures, 0 images** — just raw geometry.
- The mesh has **no UV coordinates** (`POSITION` + indices only). The five sidecar PBR PNGs that used to
  sit next to it (`grand-piano_base_color/normal/roughness/metallic/emission.png`, ~12.8 MB) **could not
  be mapped onto it** — there was no UV layout. They were orphaned dead weight and have been deleted.
- The mesh has **no normals**. `GLTFLoader` does not generate them, so they must be computed at runtime.
- The 20.9 MB was **all geometry**: 580,806 vertices / 1,162,444 triangles — absurdly heavy for a
  background prop.

So "re-enable the PBR textures" was never possible without re-UV-unwrapping the mesh. The realistic win
is to make the polished-black (ebony) look read photo-real cheaply, and to slash the payload.

## What shipped

1. **Optimized geometry** — `npm run optimize:piano` runs `gltf-transform optimize` (weld → simplify →
   meshopt + quantization) on `assets/grand-piano.glb`, producing
   `public/models/grand-piano-optimized.glb`:
   - **20.9 MB → ~574 KB**, **1.16M → ~174k triangles** (`--simplify-ratio 0.15 --simplify-error 0.001`).
   - Compression is **meshopt** (`EXT_meshopt_compression` + `KHR_mesh_quantization`), chosen over Draco
     because drei's `useGLTF` bundles the meshopt decoder inline — no runtime CDN fetch, no extra files.
   - Re-run the script (tune the ratio) and re-commit the optimized GLB if quality/size needs adjusting.
2. **Runtime normals** — `RealisticPiano` calls `geometry.computeVertexNormals()` in its clone traverse
   so the metal shades and reflects correctly (smooth normals; slight edge-rounding is acceptable here).
3. **Procedural reflections** — a PMREM environment baked once from three's bundled `RoomEnvironment` is
   assigned to **only the piano material's** `.envMap` (see `getPianoEnvMap`). This is scoped — it does
   **not** set `scene.environment`, so the chess pieces, orbs, and water are untouched and Bloom is not
   disturbed. No HDRI download. `envMapIntensity` is tuned low (~0.6) so the ebony stays dark with a
   reflective sheen. (Previously `envMapIntensity: 1.2` was set with no envMap in the scene, so it did
   nothing.)
4. ACES tone mapping + bloom (already in the postprocessing pipeline) finish the look.

## If we revisit

- **Quality/size tuning**: adjust `--simplify-ratio` in the `optimize:piano` script; raise it if the
  lid/case silhouette degrades, lower it for a smaller file.
- **Reflection look**: tune `envMapIntensity`, or replace `RoomEnvironment` with a custom procedural env
  (e.g. drei `<Lightformer>`s rendered offscreen and PMREM'd) if a colored/ethereal reflection is wanted.
- **Real textures** would require re-UV-unwrapping the mesh (Blender/xatlas) or regenerating a UV'd,
  textured model (e.g. via the Meshy MCP `retexture` flow) — substantial work, only worth it to move away
  from polished black.

## What NOT to do

- Don't try to load the old sidecar PBR PNGs onto this mesh — there are no UVs to map them to.
- Don't set a global `<Environment>` just for the piano — it changes every other PBR material in the
  scene and feeds Bloom. Keep reflections scoped to the piano material's `.envMap`.
