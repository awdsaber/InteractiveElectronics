# Decisions

- 2026-11-06 — 3D ink outlines use drei `<Outlines>` in pixel mode (`screenspace={false}`, ~1.6 CSS px × dpr) on a cached crease-smoothed hull geometry, not the spec's 0.02 world-unit thickness, so line weight stays pen-like at every zoom and box corners close.
- 2026-11-06 — Ink wobble samples noise(worldPos·4 + time·0.5) per spec but applies it as a screen-plane offset of ≤1.25 px (time stepped at 8 fps); the spec's 0.01-unit displacement is sub-pixel, and a depth-free offset keeps decals and stacked faces from z-fighting. Decal materials get a wobble-scaled polygon offset.
- 2026-11-06 — Board/PCB/mat artwork (mask, traces, pads, silkscreen, grid) is one canvas texture on the extruded slab's top cap, not a separate decal plane.
- 2026-11-06 — Part coordinates: origin at the board centre, PCB top at y = 0, 1 unit = 10 mm; `pos` [x, z] or [x, y, z]; off-board parts default to the bench top (y = −0.18).
- 2026-11-06 — Connectors (USB-B/C, micro-USB, barrel jack, screw terminal) open toward +Z (the front edge the iso camera sees) at rot 0; the Uno-style module turns so its connector edge faces +Z. Electrolytic stripe/negative lead and diode cathode bands sit on +X for the same reason.
- 2026-11-06 — `PartRenderState` adds optional `rpm`, `value` and `reading` for live motor speed, servo angle / pot position / button state, and display text.
- 2026-11-07 — Part bodies stay authored as many small InkMeshes; `<Bake>` (in every part frame) merges a part's opaque untextured meshes into one vertex-coloured draw + one merged hull at mount, rebaking when the part's params/state key changes. Moving groups opt out with `userData.noBake`. 40-part lesson ≈ 170 draws.
- 2026-11-07 — Plates thinner than 0.05 units use 1 px EdgesGeometry lines instead of an outline hull; materials on per-instance (owner-disposed) textures bypass the shared material cache.
