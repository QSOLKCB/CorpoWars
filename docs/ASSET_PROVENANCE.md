# Asset and source provenance

The v0.1.0 implementation was written for QSOL-IMC / Trent Slade using OpenAI
Codex. The repository's pre-existing Apache 2.0 licence is retained unchanged.

| Material | Origin | Storage / construction |
| --- | --- | --- |
| Game logic and interface | Newly written for CorpoWars | `src/`, HTML, CSS |
| City map | Original 36 × 36 layout and seeded building variation | `createWorld` |
| Building, agent, vehicle, tree, terminal geometry | Original programmatic boxes, triangles, lines and rings | `renderer.js` |
| Rendering shaders | Newly written GLSL ES 3.00 | `renderer.js` |
| Sound effects | Original oscillator frequencies and envelopes; no samples | `audio.js` |
| Brand mark / favicon | Original lettering and SVG paths | HTML, `favicon.svg` |
| Fiction, mission, agent names, interface text | Original CorpoWars material | HTML, simulation, docs |
| Typefaces | User device's system fonts | CSS fallback stacks; no bundled fonts |
| Test-only dependencies | Node built-ins, GitHub Actions, Playwright/Chromium | CI; not shipped in `dist/` |
| README screenshot | Unedited Chromium WebGL2 capture of this game at `09cfead142654a0680d713b56427a06862312779` | `docs/images/briefing.png`; [CI run](https://github.com/QSOLKCB/CorpoWars/actions/runs/40354546823) |

The FreeSynd public overview and download pages were consulted for project
context. They identify FreeSynd as a reimplementation requiring original game
data. No FreeSynd source, original Syndicate files, screenshots, extracted art,
maps, sounds, characters, mission text, or binary formats were used to implement
CorpoWars. This is an independent genre-inspired game, not a port or compatible
replacement engine.

References, accessed 27 October 2026 (Australia/Adelaide):

- <https://freesynd.sourceforge.io/about.php>
- <https://freesynd.sourceforge.io/dl.php>

Future contributors should document the source and licence of any new asset
before adding it. Do not add proprietary original-game data or third-party code
without an appropriate licence and attribution review.
