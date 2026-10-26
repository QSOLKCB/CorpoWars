# Getting started

## Play

Open <https://qsolkcb.github.io/CorpoWars/> after the initial PR is merged and
GitHub Pages finishes deployment. Click **Deploy squad**. Sound starts muted;
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
npm run check
npm test
npm run build
```

`dist/` contains the deployable static site and licence files. Source is served
directly for development. The optional browser test uses Playwright 1.56.1 in CI
on **Ubuntu 24.04**, with an ephemeral software WebGL2 Chromium instance. It
plays the entire mission and retains screenshots. This does not configure or
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
  2D game fallback in v0.1.0.
- **Game paused after switching tabs:** intentional; press Space or Resume.
- **An agent is behind a building:** its selection marker remains visible.
  Enable Cutaway to see the street clearly.
- **Hacking is stalled:** an agent must stand still within 1.7 tiles with clear
  line of sight to the terminal. Complete the relay before the ledger.
- **Extraction is stalled:** every living agent must enter the extraction ring.
- **No sound:** it is off by default and requires an explicit click.
- **Graphics context lost:** simulation pauses. If it is restored, resume;
  Reconnect reloads the page and restarts the mission.
