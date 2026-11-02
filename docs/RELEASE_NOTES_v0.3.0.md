# v0.3.0 — Corporate Dissolution

Two new development slices build an arsenal/research layer and a three-contract
campaign on the original v0.1.0 tactical game.

- Start with 6,000 credits; buy weapons per agent and research squad upgrades.
- Owen Gun 9mm, three-mode AUG (.223 / 9mm / .300 Blackout), and fast-reloading
  12g Over & Under, with distinct ammunition and combat timings.
- Eight prerequisite-gated upgrades: two med kit levels, head/arms/torso/legs,
  and two panic field levels.
- Panic makes visible enemies retreat without shooting, then recharges.
- Two additional missions: Ghost Shift and Boardroom Blackout, each with a
  different map layout, deployment, objective route and extraction.
- Ordered contract unlocks, one-time rewards, validated local campaign saves.
- Relaxed preserves the original balance; Hostile adds tougher, faster security.
- WASD camera, Q select-all, hold-to-pan mouse arrows, middle-drag, follow mode.
- Radar in the battlefield's top-left corner and compact objective strip.
- Interpolated movement, smooth focus, reused graphics buffers, shadows,
  health bars, impact flashes and an optional lower-resolution Eco mode.
- Original mathematical chiptunes with separate music/SFX and volume controls.
- GitHub Pages publication waits for simulation and Chromium campaign checks.

Weapon configurations are fictional game values. Campaign saves preserve
purchases/progression, not active mission positions. WebGL2 remains required.
No external runtime packages or downloaded game/audio assets are introduced.

Validation is recorded in the pull request and its Actions runs. The local cloud
preview does not provide WebGL2; actual rendered play is checked in CI Chromium
with software WebGL. Physical GPUs and other browser engines remain unverified.
