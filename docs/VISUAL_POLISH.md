# Character polish · v0.4.1

Baseline: CorpoWars `677c998c2dded6d962bec3afdd091a81ae4884db` (merged v0.4.0).
`scripts/visual-polish-reference.mjs` preserves that renderer, with only its
simulation import path changed. It is excluded from the public build.

## Appearance and rendering budget

Eight-sided helmets, faceted visors, tapered armour, sloping shoulders and
articulated limbs replace the box figures. Specialist equipment keeps distinct
silhouettes. A twelve-triangle contact shadow replaces the dense old ground
ring, paying for the increased body detail. Agent visor accents identify the
four squad members; existing selection, health and fear indicators stay exact.

| Living actor, including ground shadow/ring | v0.4.0 vertices | v0.4.1 vertices |
| --- | ---: | ---: |
| Agent / ordinary guard | 300 | 288 |
| Bulwark | 354 | 336 |
| Marksman | 336 | 312 |
| Courier | 300 | 276 |

Corpses keep their original 18 vertices. Character vertices stream into the
existing scene buffer with the original shaders, draw order and depth/blend
state. There are no extra draw passes, GPU buffers, runtime module requests,
textures, post-processing or simulation updates. The gait affects mesh vertices
only. The renderer retains its complete-signature reuse and capacity management.

Four geometry shapes and fifteen colour variants are built lazily. Their typed
arrays retain at most **191,424 additional CPU bytes** after all variants are
seen (plus small JS objects/array metadata, not measured). This is a finite
palette, not a cache of poses, actors or frames. Bulk typed copies, translated
idle poses and grouped limb transforms avoid reconstructing primitives on each
frame. Buffer disposal and renderer recreation retain their regression checks.

## Local observations

Node v24.22.1, Linux x64, AMD EPYC 9V74. Two warm-up pairs followed by seven
alternating measured pairs; each sample creates a fresh renderer and runs 120
frames. It includes fixture preparation, city construction, signature work,
geometry and modeled Float32 GPU copies. Modules and finite templates may be
warm. All samples, source hash and deterministic counts are in
[VISUAL_POLISH_LOCAL.json](VISUAL_POLISH_LOCAL.json).

| Workload, 120 frames | Baseline median ms | Polished median ms | Dynamic vertices, old → new |
| --- | ---: | ---: | ---: |
| Briefing / camera | 3.22 | 3.24 | 541,440 → 532,800 |
| Paused / orders | 3.30 | 3.20 | 465,228 → 458,604 |
| Active patrol | 14.20 | 13.02 | 611,736 → 603,456 |
| Spire combat | 23.41 | 18.24 | 1,249,548 → 1,220,820 |
| Copperline siege | 17.16 | 13.46 | 836,364 → 818,436 |
| Cold Storage courier | 17.57 | 15.32 | 972,075 → 947,727 |
| Exchange lockdown | 20.77 | 14.84 | 1,013,172 → 986,604 |
| 32-specialist stress | 36.37 | 27.94 | 2,148,312 → 2,070,744 |

Every workload keeps the same draw calls, geometry build/reuse schedule, upload
calls, storage calls and retained modeled GPU capacity. Uploaded bytes and live
vertices decrease. For example, stress uploads fall from 60,152,736 to
57,980,832 bytes while retained GPU capacity remains 1,906,152 bytes.

Separate fresh-process observations start the clock **before dynamic imports**
and include renderer construction, lazy templates and the first frame. They
also use two warm-up pairs and seven alternating measured pairs. Initial
briefing medians are **14.56 → 15.46 ms**; mixed-role stress is **17.26 →
20.71 ms**. These expose the small first-use template/import cost rather than
hiding it in warm-up. Process creation, network loading and OS cache coldness
are excluded. The renderer source grows; it still ships in the existing module.

Timing is observational, with no noisy elapsed-time CI gate. These CPU/model
measurements are not full-game FPS, physical GPU time, battery or driver-memory
measurements. Fewer vertices do not prove identical fragment cost: silhouettes,
coverage and alpha change. Native Chromium/SwiftShader checks collect separate
CPU submission observations, but other browsers and physical devices remain
unmeasured. No universal zero-performance-impact claim is made.

## Correctness and native visual checks

Eight paired 120-frame fixtures cover all six maps, pause/camera/resize/cutaway,
movement, role/state changes, injuries/deaths, courier activation, selections,
routes, hover and effects. On every frame they assert:

- No simulation mutation, increased live dynamic vertices or extra draw.
- Exact static ground/city and complete overlay streams.
- Exact objectives, selected-unit rings/routes, traffic, shots and hover.
- Exact uniforms, depth state, camera projection and ground picking.
- Equal geometry build/reuse counts and no increase in aggregate GPU work or
  retained capacity, followed by complete buffer/VAO disposal.

The older v0.3 stream tests keep exact comparisons of the same unchanged layers.
Their 480 native pixel comparisons now use actorless scenes, because character
pixels intentionally differ. No frozen renderer is regenerated from new code.

`browser-polish.cjs` adds actual WebGL2 before/after galleries for idle, walking,
contact and casualty poses. It checks changed living actors, confines pixel
changes to actor bounds, compares six actorless districts exactly, checks hidden
enemy omission, and instruments native work/capacity across eight fixtures.
Galleries include the application's maximum zoom of 2.1 and a clearly labelled
test-only zoom of 5 for model inspection. Neither changes the game's zoom range.
The CI `actor-polish-galleries` artifact retains images and raw native results.
The existing six-contract browser campaign, migration, replay, graphics recovery,
mobile and audio checks still run against the packaged game.

```sh
node scripts/check.mjs
node --test tests/*.test.js
node scripts/visual-polish-performance.mjs
node scripts/build.mjs
# Test-only Playwright and Chromium, installed outside the runtime:
node scripts/browser-renderer.cjs
node scripts/browser-polish.cjs
node scripts/browser-check.cjs
node scripts/browser-expansion.cjs
```

CI stores measurements as `performance-evidence`, character images as
`actor-polish-galleries`, and campaign evidence as `browser-screenshots`.
