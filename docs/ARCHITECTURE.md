# Architecture

CorpoWars has no framework or third-party runtime. Browser modules load directly
from relative paths so both a domain root and a GitHub Pages repository subpath
work. `scripts/build.mjs` packages a small allowlist of public game files.

| Module | Responsibility |
| --- | --- |
| `src/simulation.js` | Seeded world, agents, patrols, pathfinding, visibility, combat, abilities, mission transitions |
| `src/renderer.js` | Native WebGL2 shaders, static meshes, procedural geometry, depth buffer, camera and picking projection |
| `src/main.js` | DOM UI, pointer/keyboard input, minimap, animation loop, local record storage |
| `src/audio.js` | Opt-in Web Audio oscillators and envelopes |

## Simulation

The 36 × 36 map uses blocked building cells and connected four-neighbour roads.
A* uses Manhattan distance; formation slots are distinct nearby walkable cells.
When an order changes mid-cell, the route returns through its current cell's
centre to avoid corner clipping. Agents can overlap in transit; crowd collision
and traffic physics are not implemented.

The simulation runs at 30 fixed updates per simulated second. The browser caps
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

## Rendering

Two GLSL ES 3.00 shaders project original coloured triangle meshes to an
isometric view. Static ground/city buffers upload once. A small dynamic buffer
contains agents, traffic, routes, effects, and tactical markers. Depth testing
handles city geometry. Selected-unit markers intentionally render above roofs.
The minimap is a separate Canvas 2D interface element; the game renderer
requires WebGL2. Pixel ratio is capped at 2.

No textures, downloaded fonts, sprite sheets, model files, image generation,
sampled audio, or original-game data are used. Traffic is decorative. No fog
texture is used; undiscovered hostiles are omitted from the scene and minimap.

## Storage and access

There is no backend, authentication, telemetry, remote API, or account data.
Only the shortest successful completion time is optionally stored under
`corpowars-best-v1` in localStorage. Storage failures do not interrupt play.
No save state is imported or executed.

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
