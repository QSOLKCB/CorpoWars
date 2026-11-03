# Getting started

## Play

Open <https://qsolkcb.github.io/CorpoWars/> after GitHub Pages finishes deployment.
Click **Deploy squad**. Sound starts muted;
use **Sound** to enable the original synthesised effects.

Use a browser with JavaScript and WebGL2 enabled. Desktop mouse and keyboard
offer the best tactical control. The interface also provides touch-friendly
buttons and tap-to-move; physical mobile devices are not yet validated.

## Run a local copy

Serve the repository directory over HTTP. ES modules should not be opened with
`file://`. One option with Python 3 installed:

```sh
python3 -m http.server 8080
```

Then open <http://localhost:8080/>. There is no npm installation step and no
runtime dependency download. After loading, a mission makes no network requests.
There is no service worker or guaranteed offline reload support.

## Developer checks

Node.js 22 or newer is needed only for development and CI:

```sh
node scripts/check.mjs
node --test tests/*.test.js
node scripts/build.mjs
```

`dist/` contains the deployable static site and licence files. Source is served
directly for development. The optional browser test uses Playwright 1.56.1 in CI
on **Ubuntu 24.04**, with an ephemeral software WebGL2 Chromium instance. It
plays all six contracts, checks an existing campaign save and retains screenshots. This does not configure or
weaken security settings in a player's browser.

## GitHub Pages

The repository includes `.github/workflows/pages.yml`. In repository
**Settings → Pages**, choose **GitHub Actions** as the source. A push to `main`
or manual workflow dispatch validates, packages, and deploys `dist/`.

If Pages is already configured to deploy `main` / root, the root `index.html`
also works; choose one deployment method to avoid redundant publishes. This
PR does not change repository administration settings or merge itself.

## Troubleshooting

- **Display link unavailable:** WebGL2 is unavailable or blocked by the device,
  driver, or browser policy. Check browser graphics support. There is no Canvas
  2D game fallback.
- **Game paused after switching tabs:** intentional; press Space or Resume.
- **An agent is behind a building:** its selection marker remains visible.
  Enable Cutaway to see the street clearly.
- **Hacking is stalled:** an agent must stand still within 1.7 tiles with clear
  line of sight to the terminal. Complete the relay before the ledger.
- **Extraction is stalled:** every living agent must enter the extraction ring.
- **Transmitter is stalled:** clear, stun or frighten security within its contest
  ring, and keep a stationary living agent beside the terminal.
- **Courier is waiting:** select living agents and press C / Escort courier.
  They need nearby, unobstructed support to move; their survival is mandatory.
- **Lockdown countdown:** starts after the first terminal; tactical pause freezes it.
- **No sound:** it is off by default and requires an explicit click.
- **Graphics context lost:** simulation pauses. If it is restored, resume;
  Reconnect reloads the page and restarts the mission.

## New in v0.4.0

Three expansion contracts follow the original campaign. Existing v0.3 saves
remain valid: select Signal Siege after completing the original three contracts.
New objectives include a contested hold zone, courier protection and a lockdown
escape. Headquarters displays the optional badge requirements and par times.
Bulwarks and Marksmen have distinct armour, range and visual silhouettes.

## Headquarters and sound

Open Research & Loadout before deploying to spend the 6,000-credit starting
budget, choose Relaxed or Hostile combat, and configure equipment. WASD pans the
camera; Q selects the squad. Enable Music for the original procedural soundtrack.
See [the field manual](INSTRUCTIONS.md) for the full campaign and research tree.
