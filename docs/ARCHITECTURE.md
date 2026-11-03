# Architecture

CorpoWars has no framework or third-party runtime. Browser modules load directly
from relative paths so both a domain root and a GitHub Pages repository subpath
work. `scripts/build.mjs` packages a small allowlist of public game files.

| Module | Responsibility |
| --- | --- |
| `src/simulation.js` | Seeded world, agents, patrols, pathfinding, visibility, combat, abilities, mission transitions |
| `src/renderer.js` | Native WebGL2 shaders, static meshes, procedural geometry, depth buffer, camera and picking projection |
| `src/main.js` | DOM UI, pointer/keyboard input, minimap, animation loop, local record storage |
| `src/campaign.js` | Weapon/research/mission catalogues, difficulty, economy, save validation |
| `src/headquarters.js` | Armoury, research prerequisites and contract selection UI |
| `src/challenges.js` | Pure optional challenge evaluation and per-contract/difficulty badge union |
| `src/runtime.js` | Compare-before-write UI helpers and one current minimap background raster |
| `src/music.js` | Pure deterministic score and bounded Web Audio look-ahead scheduling |
| `src/audio.js` | Independent opt-in music/effects and Web Audio envelopes |

## Simulation

The 36 × 36 map uses blocked building cells and connected four-neighbour roads.
A* uses Manhattan distance; formation slots are distinct nearby walkable cells.
When an order changes mid-cell, the route returns through its current cell's
centre to avoid corner clipping. Agents can overlap in transit; crowd collision
and traffic physics are not implemented.

The simulation runs at 30 fixed updates per simulated second. Rendering
interpolates previous/current positions at the display refresh rate; pause uses
the current position. Camera focus uses exponential easing, while manual pan
responds immediately. Dynamic mesh arrays and GPU capacity are reused. The browser caps
wall-clock deltas at 100 ms so a stalled frame cannot produce an unbounded
catch-up loop. Slow machines may run below real time. Pause and hidden-tab
handling discard elapsed catch-up time. Floating point positions are used;
repeatability is tested in the same JS runtime, not claimed as a cross-engine
bit-exact replay guarantee.

Supercover grid traversal handles line of sight, including diagonal corners.
Walls block detection and bullets. Guards see nearby unobstructed agents,
approach, and fire. Friendly automatic targeting picks a nearby unobstructed
guard; explicit targets have priority. Target movement can be reacquired only
while visible. Killed agents cannot move, heal, shoot, or count as survivors.

Relay → ledger → extraction is an ordered state machine. Living, stationary
agents channel terminal progress. Reinforcements spawn once at ledger completion.
Extraction requires all living agents. Win/loss freezes the simulation.

The expansion keeps the original three layouts byte-for-byte and adds three
new building occupancy patterns. Mission `kind` selects a contested hold,
courier escort or lockdown variant. Hold waves have per-wave once flags;
contested/abandoned transmission decays rather than resetting those flags.
Courier movement needs living support within six tiles and line of sight;
automatic escort refreshes assigned agents' paths every 0.75 simulated seconds.
Manual orders cancel the escort mode. Guards can target a courier only after
release, and courier death is terminal. Lockdown starts on relay completion,
uses only simulation time and loses on expiration unless extraction completes
on that tick. All new state freezes during pause and terminal phases.

## Rendering

Two GLSL ES 3.00 shaders project original coloured triangle meshes to an
isometric view. Static ground/city buffers upload once. A small dynamic buffer
contains agents, traffic, routes, effects, and tactical markers. Depth testing
handles city geometry. Selected-unit markers intentionally render above roofs.
The minimap is a separate Canvas 2D interface element; the game renderer
requires WebGL2. Pixel ratio is capped at 2.

The VANILLAJS performance adaptation writes primitives directly into retained
typed arrays, uses per-buffer WebGL2 vertex arrays, and keeps scene/overlay
capacity separately. Complete effective-input signatures reuse unchanged
geometry/uploads; camera uniforms and cutaway still update. The HUD compares
live DOM state and the minimap retains one background raster. A stable binary
heap with weakly owned typed scratch preserves the original A* tie order.
See [PERFORMANCE.md](PERFORMANCE.md) for invalidation, failure handling, exact
baseline comparisons, raw measurements and the additional buffer-memory cost.
New district palettes/rooftop equipment are static meshes. Specialist identity,
courier effective inputs and hold-zone state are included in dynamic geometry
signatures. Hidden guards still use the same visibility filter. The original
four rendering workloads remain exact comparisons against the frozen baseline.

No textures, downloaded fonts, sprite sheets, model files, image generation,
sampled audio, or original-game data are used. Traffic is decorative. No fog
texture is used; undiscovered hostiles are omitted from the scene and minimap.

## Storage and access

There is no backend, authentication, telemetry, remote API, or account data.
Campaign economy/loadout/research/progression is stored under
`corpowars-campaign-v1`. Reads validate version, integer balances, catalogue IDs,
ownership, prerequisites, completion order and the complete budget equation.
Unknown/invalid saves fall back to a new campaign. Best times use separate keys
for each mission and difficulty. No in-mission positions are saved, no arbitrary
save object is spread into simulation state, and storage failures do not interrupt play.
The optional `challenges` field extends the existing v1 save. Missing fields
default to empty badges; old three-contract saves keep their previous selection
and unlock the fourth contract. Badge keys, difficulty, IDs and completed
contract membership are validated. The cash ceiling and exact budget equation
cover all six rewards. Challenges never mint credits or unlock missions.

The HTML controls have accessible labels, focus indicators, and status text.
Canvas gameplay still requires visual/spatial interaction; full screen-reader
playability is not claimed. Native dialogs contain keyboard focus. UI colour
choices have corresponding text and numbers. Audio is opt-in.

## Validation

Node tests cover map connectivity, routing, LOS/corners, formation orders,
mid-route changes, pause, selection, abilities, reloading, objective gates,
all-survivor extraction, terminal states, and repeatable complete missions.
The Chromium integration test checks actual WebGL2 colour output and plays a
full mission through DOM controls, then checks restart, mobile layout, help,
and the unsupported-GPU message. CI installs its test-only packages outside
the checkout on a pinned Ubuntu 24.04 runner.

## New mechanics

Campaign missions supply their layout variant, seed, spawn, terminal locations,
extraction and security deployment. Contract settlement checks ordered unlocks
and pays each contract once. Research/weapon mutations operate only on the
headquarters profile; deployed missions receive a snapshot. The UI prohibits
purchases or difficulty changes during an operation.

Panic checks range and line of sight from selected living agents. A bounded
flood fill picks a reachable retreat that increases minimum distance from the
emitters. Fear suspends firing, then expires; cooldown counts only simulated
time. Hostile guards have explicit HP/damage/speed/fire-interval overrides and
shorter fear, with no changes to Relaxed defaults.

AUG mode changes set ammo to zero and require the complete new reload interval,
including when requested while paused. Medical research cannot revive agents.

The original chip score emits bounded note descriptors from integer step/bar
indices. Web Audio schedules 120 ms ahead from a 25 ms timer. Suspended tabs
discard missed beats; there is no backlog playback. Voice nodes disconnect on
completion. The timer stops when music is muted or the tab loses focus. The
score contains no samples, downloaded music, or quoted melodies.

## Delivery

Pull requests run `check.yml`. Main-branch Pages publication calls the same
reusable validation workflow, including real Chromium WebGL2 gameplay and an
offline audio render, before packaging the public-file allowlist and deploying.
A failed gameplay check blocks deployment. Tests exercise the repository subpath,
all six contracts, persistence, budget, research, camera and HUD layout. A
separate packaged expansion playthrough starts from a valid old v1 save, plays
hold/escort/lockdown through DOM controls and verifies medals, replay payouts and
mobile layout. Browser execution uses Chromium/SwiftShader; physical GPU and
other-browser performance remain outside this automated coverage.
