# VANILLAJS performance upgrade

This changes execution and rendering work, with no additional game content.
The campaign catalogue, balance, map generator, shaders, audio, HTML and CSS
retain their v0.3.0 content. The 30 Hz simulation and interpolation remain intact.

Donor: [QSOLKCB/VANILLAJS](https://github.com/QSOLKCB/VANILLAJS/tree/1f965f4e5b6669de0f954e3a39b11aa679e56720),
commit `1f965f4e5b6669de0f954e3a39b11aa679e56720`, especially its
`modules/render-webgl`, `modules/navigation` and `docs/OPTIMIZATION.md`.
The adaptations preserve CorpoWars's own WebGL2 projection and route tie order.
No engine, package install, CDN or downloaded asset is added to the game runtime.

## Contract and stopping rule

| Field | Contract |
| --- | --- |
| Target | Reduce geometry preparation, repeated uploads, frontier scans and unchanged UI work |
| Constraints | Identical live Float32 geometry, primitive order, depth state, camera uniforms and complete route waypoints; unchanged game content |
| Baseline | CorpoWars `54a4b1bc1d24195092be2c1e8f056a2eb3730057` |
| Measurement | Two warm-up pairs, then seven alternating measured pairs per fixed workload; include cold renderer/world construction |
| Gates | Exact draw-stream/route equality, invalidation/failure regressions and deterministic reductions in repeated renderer work; native browser pixels and existing campaign playthrough in CI |
| Stop | Retain the measured implementation after these checks; no timing threshold or open-ended tuning loop |

The frozen renderer and path search in `scripts/*reference.mjs` come from that
baseline; only their import paths change. They are test tools, excluded from the
public build. Timing includes the work-count model's CPU buffer copies, not a
physical GPU or browser frame. No FPS, battery, driver-memory, heap/RSS or
cross-device speedup claim follows from these observations.

## Renderer

Ring trigonometry and the finite colour palette are evaluated once. Boxes,
rings, lines and floors write directly into retained typed arrays, avoiding
temporary per-vertex arrays and full-unit object copies. Static city geometry,
the main dynamic scene and the always-visible overlay retain separate buffers;
WebGL2 vertex array objects retain their attribute bindings. Shader code, every
ring segment, geometry detail, colour and primitive order remain the same.

The dynamic scene and overlay share one exact current-generation signature.
It includes time, interpolation, phase, objective coordinates/states, selection,
unit positions/previous positions, IDs, teams, health, fear/stun, paths, visible
guard membership, effects and hover tile. Guard visibility is recomputed before
the signature, so terrain/agent changes cannot retain a hidden guard. Camera,
zoom, density, viewport and cutaway still update projection/static draws while
unchanged geometry can reuse its existing uploads. Non-finite inputs are
rejected, signed zero is distinguished, and there is no lossy hash key.

There is one current generation, with no historical mesh cache. A rebuild
invalidates the prior key before mutation and publishes only after both uploads
complete. Failed builds/uploads retry fresh, including A → B(failure) → A.
New renderer instances/context restoration start fresh. Growth retains capacity;
shrink/empty draws use only current live lengths. Disposal deletes buffers and
vertex arrays. The browser receives a high-performance GPU preference hint;
the existing Eco density control still applies.

## Navigation and UI

A stable indexed binary heap replaces the A* frontier's linear scan. Equal
scores retain the original first-insertion tie order and east/south/west/north
expansion, rather than importing VANILLAJS's different tie preference. Typed
scratch arrays are reused per weakly owned live world, with generation stamps
and an explicit wrap reset. Search still reads current terrain each time; no
route result is cached. Returned point arrays belong to each caller. A 36 × 36
world retains 51,840 bytes of typed scratch while reachable.

The HUD compares live properties, attributes and classes before writing and
retains its stable DOM handles. Styles remember the browser's normalized
serialization of the exact requested value; this avoids rewriting fractional
CSS on every frame and still repairs external changes. The radar retains one
background raster keyed by every building rectangle and objective coordinate.
Units and camera overlays continue to update normally. Hidden frames skip
render work; focus loss/manual opening clears pending input and timing debt.

## Local observations

Node v24.22.1, Linux x64, AMD EPYC 9V74. All seven samples are retained in
[renderer evidence](PERFORMANCE_RENDER_LOCAL.json) and
[navigation evidence](PERFORMANCE_NAVIGATION_LOCAL.json).

| Renderer workload, 120 frames | Baseline median ms | Upgraded median ms | Dynamic uploads, old → new |
| --- | ---: | ---: | ---: |
| Briefing with camera/cutaway/resize | 24.38 | 3.43 | 240 → 2 |
| Paused with orders and visual state changes | 20.40 | 3.94 | 240 → 20 |
| Active patrol with interpolation | 27.03 | 14.66 | 240 → 240 |
| Rapidly changing Hostile combat | 49.84 | 19.83 | 240 → 240 |

Route preparation for 1,200 searches across three freshly created worlds has a
92.37 ms baseline median and 17.99 ms upgraded median, with identical complete
waypoint arrays. This includes world/workspace construction. More than 2,200
independent route comparisons also cover all districts, edited/disconnected
terrain, mid-cell starts and invalid endpoints.

For 241 unchanged radar updates, background raster operations fall from 8,676
to 36, with 241 image blits. Repeated unchanged HUD helper calls perform zero
assignments. These are deterministic workload counts, not browser latency claims.

Separate scene and overlay buffers increase retained modeled GPU capacity by
262,144 bytes in the measured fixtures (for example, briefing 1,089,208 →
1,351,352 bytes including the static city). The additional allocation enables
reuse without overwriting one group with the other. The signature, cached DOM
handles and radar raster also retain bounded current data; their heap and real
driver allocations have not been measured. Active scenes still rebuild when
effective inputs change; no simulation or visual detail is skipped.

## Reproduce and validate

```sh
node scripts/check.mjs
node --test tests/*.test.js
node scripts/performance-render.mjs
node scripts/navigation-performance.mjs
node scripts/build.mjs
# Test-only Playwright/Chromium; not needed to run the game:
node scripts/browser-renderer.cjs
node scripts/browser-check.cjs
```

CI retains raw performance JSON, native renderer/minimap pixel comparisons and
campaign screenshots. Browser conformance covers 480 frames across four
workloads, all three maps, both density caps, camera/zoom/cutaway/resize, paused
orders, terminal transitions, injury/death/visibility, effects and interpolated
movement. Browser tests also exercise CSS normalization/external repair, the
existing full campaign and graphics-context restoration. Timing is observational;
correctness and repeated-work checks gate publication. Physical GPUs, Firefox,
Safari and mobile-device performance remain unmeasured.

If parity fails after future rendering changes, disable geometry reuse by
invalidating `geometryKey` each frame until the signature/build contract is fixed.
Keep the independent references and assertions when changing the optimization.
