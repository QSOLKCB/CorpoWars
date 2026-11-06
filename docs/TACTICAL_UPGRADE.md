# Tactical control and campaign pressure

Based on CorpoWars `815b609cd6c2eb5c789a78ebe3e91d0438807b79`.

## Play

- Left-click commands movement, selects agents, or orders a visible hostile attack.
- Hold right-click for direct fire by the controlled selected agent. Select 1–4
  or a squad card to choose that agent. Q selects everyone and makes VEX the shooter.
  Only the shooter stops moving. The rest of the squad retains autonomous behaviour.
- Direct fire consumes real magazines and cooldowns, automatically reloads, respects
  range/cover, can miss, and stops at friendly bodies without friendly damage. It
  overrides Hold Fire for that agent only. Pause, blur, context loss, cancellation,
  release and selection changes cancel held input.
- WASD, arrows, middle-drag, the camera pad and minimap pan the battlefield. [ / ]
  and the rotation buttons choose four quarter-turn views. Projection, inverse
  picking, camera pan directions, depth and minimap viewport use the same rotation.
- Buildings gain retained rear faces for alternate angles. Compact actor models
  remain camera-facing dioramas, preserving their silhouettes and animation.

## Progression

| Map | Captures | Extraction zones |
| --- | ---: | ---: |
| Breakwater | 2 | 1 |
| Blackglass Foundry | 3 | 1 |
| Meridian Spire | 4 | 1 |
| Copperline Grid | 5 | 1 |
| Cold Storage | 6 | 1 |
| Obsidian Exchange | 7 | 1 |

All nodes must be captured in displayed order. Extra nodes have four-second
channels, distinct connected street coordinates, and a defending guard (later
nodes use bulwarks). Existing hold waves, courier and lockdown rules remain.
Cold Storage puts control captures before courier release so the escort can be
protected throughout. Pars gain 30 seconds per additional node. The existing
180/120-second lockdown budgets remain; real-combat tests cover completion.

Reserve patches cost 250 CR and share the finite campaign budget. Stock is capped
at 12. Two issued patches (four after Field Surgery) remain available each mission;
reserves are consumed only after those, persist unused, and stay spent on retries.
Existing saves default to zero purchases/consumption. Save validation checks both
counters, inventory bounds, and the complete credit ledger. Rewards remain once-only.
Upgraded veteran squads can still win without abilities: supply pressure depends
on equipment, difficulty and player decisions, rather than a mandatory purchase gate.

## Performance and provenance

- VANILLAJS `93ace342c11e2427ad82920c8965f16e91518fb7`,
  `modules/render-webgl/index.js`: adapt `updateRange` to the changed vertex span
  of each dynamic stream. Compare exact Float32 bit patterns, retain GPU capacity,
  skip the known unchanged objective prefix, and recover from upload failure.
- CorpoWars3d `8e86066686a575402ee2818378f1ec9323fb9ee6`,
  `src/renderer.js`: adapt retained static/dynamic batches to objective geometry.
  Rings/terminals rebuild only on changed positions, capture state or side mode.
- No runtime dependencies or remote calls are introduced. Existing A* heap,
  cached minimap, actor templates, VAOs and unchanged-frame reuse are preserved.

`TACTICAL_PERFORMANCE_LOCAL.json` records source hashes, exact output digests,
work counts, paired timings and environment. The reference is the **same new
renderer with objective retention and partial uploads disabled**, not a claim
that extra objectives cost less than the old two-objective game. Across 90 frames:

| Workload | Full uploads | Changed-range uploads | Reduction | Objective builds |
| --- | ---: | ---: | ---: | ---: |
| Map 1 | 11,653,152 B | 1,874,880 B | 83.9% | 91 → 3 |
| Map 6 | 13,978,608 B | 1,949,808 B | 86.1% | 91 → 3 |

The candidate retains 524,288 bytes of CPU upload snapshots in these scenes,
plus a bounded objective batch and static rear-side geometry. GPU capacity is
identical between the compared implementations. Snapshots grow with the largest
live stream, not with frame count. Timings cover CPU geometry and test-model
buffer copies, including the first rotated-side upload; they exclude GPU time,
driver memory and end-to-end frame rate. No RTX or hardware-FPS claim is made.

## Validation

Local execution: syntax/offline/HTML checks, static packaging, and 99 tests pass.
Coverage includes all six full combat routes, Hostile expansion routes, save
migration/accounting, direct-fire cover/range/friendlies/reloads, extraction gates,
all four inverse projections, upload failures, and exact complete submitted
geometry across every map/angle in the bounded workloads.

Historical render comparisons retain their original two-capture fixtures and
original guard membership. New full-objective scenes have separate exact-output
tests; new features are not hidden from their own performance measurements.

Local Chromium could not launch because this workspace denied its process socket.
CI runs packaged browser gameplay plus direct fire/cancellation, mobile objective
scrolling, supply purchase persistence and 24 native pixel/picking comparisons.
Screenshots and browser receipts are retained as workflow artifacts. CI status
and exact head are reported in the PR; local model tests are not browser evidence.
