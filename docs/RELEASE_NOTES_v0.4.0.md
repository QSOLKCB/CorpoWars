# CorpoWars v0.4.0 — Hostile Expansion

Six contracts. The board has misplaced another three districts.

## Three new operations

| Contract | First-clear reward | Objective |
| --- | ---: | --- |
| Signal Siege · Copperline Grid | 4,800 CR | Restore the carrier, hold a transmitter for twelve uncontested seconds through two security waves, then extract |
| Witness Protection · Cold Storage | 5,600 CR | Unlock a cryostore, release a vulnerable courier and protect them to the transfer gate |
| Golden Parachute · Obsidian Exchange | 7,200 CR | Disable the failsafe, seize the severance fund and escape before lockdown |

Each district has its own connected building layout, procedural palette and
rooftop machinery. The original three contracts and their layouts remain.

## New tactical decisions

- **Contested transmission:** nearby unstunned, unafraid security blocks the
  hold zone. Abandoning or contesting it drains progress; waves trigger only once.
- **Courier escort:** press C / Escort courier to assign selected agents. The
  courier moves only with nearby unobstructed support. Protect their finite HP;
  their death loses the operation and extraction requires their presence.
- **Lockdown:** the first terminal starts a 180-second Relaxed or 120-second
  Hostile countdown. Pause freezes it. Extract before the district seals.
- **Bulwarks:** slower, tougher guards with 25% bullet armour and broad shields.
- **Marksmen:** lower HP, longer range and stronger, slower shots, with a long
  weapon and optic silhouette.

## Replay challenges and progression

Every contract now awards optional badges for extracting all four agents,
using no medical/EMP/panic abilities, and beating its headquarters par time.
Expansion pars are 45 / 35 / 45 simulated seconds. Badges accumulate separately
per contract and difficulty; they pay no credits and do not gate progression.
The debrief shows each result and headquarters retains earned badges.

Existing `corpowars-campaign-v1` saves retain credits, equipment, research,
completed contracts and the selected mission. Completing the original campaign
unlocks Signal Siege. All six rewards remain first-completion only; replays and
difficulty changes cannot duplicate payouts. In-mission positions are not saved.

## Presentation and engineering

The mission console reports transmission contests, courier health and lockdown
time. A courier world label and radar marker aid escorting; the existing camera,
pause, cutaway and Eco controls remain available. Headquarters and debrief adapt
to six contracts and three optional badges.

The VANILLAJS renderer, retained buffers, exact reuse and stable heap navigation
remain in place. New visual inputs participate in cache invalidation. Runtime
continues to use browser HTML/CSS/ES modules, WebGL2 and Web Audio, with no engine,
runtime package installation, downloaded asset, server or cloud account.

## Validation

Simulation checks cover the original worlds and routes, new-map connectivity,
real-combat wins, hold contests/wave limits, courier activation/loss/extraction,
lockdown boundaries, pause/terminal freezing, challenge accounting and old-save
continuity. The frozen legacy renderer still provides exact 480-frame draw
stream and native pixel comparisons. Packaged Chromium tests exercise the old
campaign, new three operations, challenge persistence, a completed replay,
graphics recovery and mobile layout.

Automated browser coverage uses Chromium/SwiftShader. Physical GPU, Firefox,
Safari and real mobile-device performance still need separate validation.
The earlier performance workload timings are not FPS promises for the new maps.
