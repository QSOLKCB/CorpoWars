// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/simulation.js';
import { writeProperty, writeStyle, writeAttribute, writeClass, MinimapBackground } from '../src/runtime.js';

test('unchanged HUD updates do not assign DOM properties, attributes or classes; external edits are repaired', () => {
  let value = 'READY', propertyWrites = 0, attributeWrites = 0, classWrites = 0;
  const attributes = new Map([['aria-pressed', 'false']]), classes = new Set();
  const node = {
    get textContent() { return value; },
    set textContent(text) { propertyWrites++; value = text; },
    getAttribute(key) { return attributes.get(key) ?? null; },
    setAttribute(key, text) { attributeWrites++; attributes.set(key, text); },
    classList: {
      contains(key) { return classes.has(key); },
      toggle(key, enabled) { classWrites++; if (enabled) classes.add(key); else classes.delete(key); },
    },
  };
  const render = () => { writeProperty(node, 'textContent', 'READY'); writeAttribute(node, 'aria-pressed', 'false'); writeClass(node, 'selected', false); };
  for (let i = 0; i < 600; i++) render();
  assert.deepEqual([propertyWrites, attributeWrites, classWrites], [0, 0, 0]);
  value = 'external edit'; attributes.set('aria-pressed', 'true'); classes.add('selected');
  render();
  assert.deepEqual([propertyWrites, attributeWrites, classWrites], [1, 1, 1]);
  assert.equal(value, 'READY'); assert.equal(attributes.get('aria-pressed'), 'false'); assert.equal(classes.has('selected'), false);
  writeProperty(node, 'textContent', 'CHANGED'); writeAttribute(node, 'aria-pressed', 'true'); writeClass(node, 'selected', true);
  assert.deepEqual([propertyWrites, attributeWrites, classWrites], [2, 2, 2]);
});

test('CSSOM-normalised styles skip equal desired strings and repair external edits without rounding inputs', () => {
  const writes = [], values = { width: '', left: '' }, normalisedStyle = {};
  for (const key of ['width', 'left']) Object.defineProperty(normalisedStyle, key, {
    get() { return values[key]; },
    set(value) {
      writes.push([key, value]);
      values[key] = value.replace(/-?\d+(?:\.\d+)?/, number => String(Number(Number(number).toFixed(4))));
    },
  });
  const width = '33.33333333333333%', left = '127.123456789px';
  for (let frame = 0; frame < 600; frame++) {
    writeStyle(normalisedStyle, 'width', width);
    writeStyle(normalisedStyle, 'left', left);
  }
  assert.deepEqual(writes, [['width', width], ['left', left]], 'each original string is submitted once despite normalisation');
  assert.equal(normalisedStyle.width, '33.3333%'); assert.equal(normalisedStyle.left, '127.1235px');
  values.width = '12%'; values.left = '3px';
  writeStyle(normalisedStyle, 'width', width); writeStyle(normalisedStyle, 'left', left);
  assert.deepEqual(writes.slice(2), [['width', width], ['left', left]], 'external changes are corrected');
  writeStyle(normalisedStyle, 'width', '33.33333333333334%');
  assert.deepEqual(writes.at(-1), ['width', '33.33333333333334%'], 'changed desired CSS retains exact assignment semantics even if serialisation matches');
  writeStyle(normalisedStyle, 'width', width);
  assert.deepEqual(writes.at(-1), ['width', width], 'A → B → A keeps only the current desired generation');
  const other = { width: '12%' }; writeStyle(other, 'width', width);
  assert.equal(other.width, width, 'element/property records cannot alias');
});

function canvasRecorder(available = true) {
  const calls = [], context = {
    fillStyle: '', strokeStyle: '',
    fillRect(...args) { calls.push(['fill', this.fillStyle, ...args]); },
    strokeRect(...args) { calls.push(['stroke', this.strokeStyle, ...args]); },
    drawImage(canvas, x, y) { calls.push(['image', canvas, x, y]); },
  };
  return { calls, context, getContext() { return available ? context : null; } };
}

test('minimap retains one exact background generation and blits it on repeated or dynamic-only updates', () => {
  const game = createGame(), backing = canvasRecorder(), screen = canvasRecorder(), cache = new MinimapBackground(backing);
  cache.draw(screen.context, game);
  assert.equal(backing.width, 216); assert.equal(backing.height, 216);
  assert.deepEqual(backing.calls[0], ['fill', '#10191b', 0, 0, 216, 216]);
  assert.equal(backing.calls.length, game.world.buildings.length + 4);
  assert.deepEqual(backing.calls.slice(-3), [
    ['stroke', '#91af9e', game.relay.x * 6 - 3, game.relay.y * 6 - 3, 6, 6],
    ['stroke', '#91af9e', game.vault.x * 6 - 3, game.vault.y * 6 - 3, 6, 6],
    ['stroke', '#91af9e', game.exit.x * 6 - 3, game.exit.y * 6 - 3, 6, 6],
  ]);
  const coldCalls = backing.calls.length;
  for (let frame = 0; frame < 240; frame++) {
    game.time++; game.agents[0].x += .01; game.relay.progress += .01; game.relay.done = !game.relay.done;
    cache.draw(screen.context, game);
  }
  assert.equal(backing.calls.length, coldCalls, 'unit motion/progress does not rebuild static geometry');
  assert.equal(screen.calls.length, 241);
  assert.ok(screen.calls.every(call => call[0] === 'image' && call[1] === backing));
  game.world = { ...game.world, buildings: game.world.buildings.map(building => ({ ...building })) };
  cache.draw(screen.context, game);
  assert.equal(backing.calls.length, coldCalls, 'equal replacement world has equivalent effective inputs');
});

test('every building/objective coordinate invalidates the minimap, including same-object edits and resets', () => {
  const game = createGame(), backing = canvasRecorder(), screen = canvasRecorder(), cache = new MinimapBackground(backing);
  cache.draw(screen.context, game);
  for (const [object, key] of [
    ...['x', 'y', 'w', 'd'].map(key => [game.world.buildings[0], key]),
    ...['relay', 'vault', 'exit'].flatMap(object => ['x', 'y'].map(key => [game[object], key])),
  ]) {
    const original = object[key], before = backing.calls.length;
    object[key] += 1; cache.draw(screen.context, game);
    assert.ok(backing.calls.length > before);
    const changedCalls = backing.calls.length; object[key] = original; cache.draw(screen.context, game);
    assert.ok(backing.calls.length > changedCalls, 'A → B → A must rebuild the current generation');
  }
  const before = backing.calls.length;
  game.world.buildings.push({ x: 0, y: 0, w: 1, d: 1 }); cache.draw(screen.context, game);
  assert.equal(backing.calls.length - before, game.world.buildings.length + 4);
  game.world.buildings.pop(); cache.draw(screen.context, game);
  const mission = createGame(undefined, undefined, 1); cache.draw(screen.context, mission);
  assert.ok(cache.matches(mission)); assert.equal(cache.matches(game), false);
});

test('minimap still draws if a secondary canvas context is unavailable', () => {
  const game = createGame(), cache = new MinimapBackground(canvasRecorder(false)), screen = canvasRecorder();
  cache.draw(screen.context, game);
  assert.equal(screen.calls.length, game.world.buildings.length + 4);
  assert.equal(screen.calls.some(call => call[0] === 'image'), false);
});
