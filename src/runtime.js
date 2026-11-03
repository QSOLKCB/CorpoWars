// SPDX-License-Identifier: Apache-2.0
// Compare against live DOM state: unchanged updates do no work, while an external
// edit is still corrected on the next HUD update (VANILLAJS OPT reuse pattern).
export function writeProperty(node, key, value) {
  if (node[key] !== value) node[key] = value;
}
// CSSOM may normalise e.g. 33.33333333333333% to 33.3333%. Retain the
// requested string and its actual serialisation so equal desired values skip
// writes without mistaking an external style edit for our normalised output.
const styleValues = new WeakMap();
export function writeStyle(style, key, value) {
  const current = style[key], properties = styleValues.get(style), previous = properties?.get(key);
  if (previous && previous.desired === value && previous.serialised === current) return;
  if (current !== value) style[key] = value;
  const snapshot = { desired: value, serialised: style[key] };
  if (properties) properties.set(key, snapshot);
  else styleValues.set(style, new Map([[key, snapshot]]));
}
export function writeAttribute(node, key, value) {
  if (node.getAttribute(key) !== value) node.setAttribute(key, value);
}
export function writeClass(node, key, enabled) {
  if (node.classList.contains(key) !== enabled) node.classList.toggle(key, enabled);
}

const objectives = ['relay', 'vault', 'exit'];
export function drawMinimapBackground(context, game, scale = 6) {
  context.fillStyle = '#10191b';
  context.fillRect(0, 0, 36 * scale, 36 * scale);
  context.fillStyle = '#394846';
  for (const b of game.world.buildings) context.fillRect(b.x * scale, b.y * scale, b.w * scale, b.d * scale);
  context.strokeStyle = '#91af9e';
  for (const key of objectives) {
    const p = game[key];
    context.strokeRect(p.x * scale - 3, p.y * scale - 3, 6, 6);
  }
}

// One current raster generation, keyed by every primitive used by its builder.
// Positions/progress of units and the viewport are drawn separately every time.
// Comparing the retained snapshot needs no per-update arrays or serialisation.
export class MinimapBackground {
  #values = null;
  #scale;
  constructor(canvas, scale = 6) {
    this.canvas = canvas;
    this.#scale = scale;
    canvas.width = canvas.height = 36 * scale;
    this.context = canvas.getContext('2d');
  }
  matches(game) {
    const values = this.#values, buildings = game.world.buildings;
    if (!values || values.length !== buildings.length * 4 + 6) return false;
    let i = 0;
    for (const b of buildings) {
      if (values[i++] !== b.x || values[i++] !== b.y || values[i++] !== b.w || values[i++] !== b.d) return false;
    }
    for (const key of objectives) {
      if (values[i++] !== game[key].x || values[i++] !== game[key].y) return false;
    }
    return true;
  }
  draw(context, game) {
    if (!this.context) { drawMinimapBackground(context, game, this.#scale); return; }
    if (!this.matches(game)) {
      drawMinimapBackground(this.context, game, this.#scale);
      const values = [];
      for (const b of game.world.buildings) values.push(b.x, b.y, b.w, b.d);
      for (const key of objectives) values.push(game[key].x, game[key].y);
      this.#values = values;
    }
    context.drawImage(this.canvas, 0, 0);
  }
}
