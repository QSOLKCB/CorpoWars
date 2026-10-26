# CorpoWars v0.1.0 — Hostile Takeover

Initial playable browser-native foundation. Release notes are prepared here;
this implementation PR does not create a tag or publish a GitHub release.

## Playable mission

Deploy VEX, NULL, ECHO, and IRON into the original Breakwater district. Sever a
relay, acquire a corporate debt ledger, then extract every survivor while
security patrols respond. Winning and losing produce a debrief with replay.

## Engine and controls

- Native WebGL2 isometric rendering, procedural city geometry, ambient traffic,
  depth-tested buildings, selection silhouettes, and cutaway mode.
- Independent fixed-step simulation with A* navigation, formation destinations,
  wall-aware sightlines, patrol combat, automatic reloading, and reinforcements.
- Individual/box/squad selection, target orders, tactical pause, camera controls,
  minimap, trauma patches, EMP, and hold-fire mode.
- Responsive HTML/CSS interface, optional synthesised sound, field manual,
  local best completion time, and graceful graphics/storage error handling.

## Open-source delivery

Preserves the Apache 2.0 licence. All code, map geometry, game visuals, fiction,
and sound generation are original to this project. Includes provenance,
architecture, controls, local setup, development roadmap, 14 simulation tests,
a complete-mission Chromium test, retained CI screenshots, and Pages deployment.

## Scope

One mission; no campaign, research, controllable vehicles, multiplayer, save
games, or original-game file compatibility. WebGL2 is required. Browser/GPU
coverage beyond the automated Chromium environment remains future work.
