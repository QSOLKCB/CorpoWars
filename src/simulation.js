// SPDX-License-Identifier: Apache-2.0
// The simulation has no DOM, graphics, audio, network, or wall-clock dependencies.
export const STEP = 1 / 30;
export const SIZE = 36;
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function random(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

export function createWorld(seed = 2091) {
  const rng = random(seed), blocked = new Uint8Array(SIZE * SIZE), buildings = [];
  for (let by = 0; by < 4; by++) for (let bx = 0; bx < 4; bx++) {
    const x = bx * 9 + 4, y = by * 9 + 4;
    // Open courtyards break up the skyline and leave routes around every block.
    const parts = (bx + by) % 3 === 0 ? [[0, 0, 3, 5], [4, 0, 1, 3]] : [[0, 0, 5, 3], [0, 4, 3, 1]];
    for (const [dx, dy, w, d] of parts) {
      const height = 1.3 + rng() * 3.8;
      buildings.push({ x: x + dx, y: y + dy, w, d, height, tone: rng(), sign: buildings.length % 5 });
      for (let cy = y + dy; cy < y + dy + d; cy++) for (let cx = x + dx; cx < x + dx + w; cx++) blocked[cy * SIZE + cx] = 1;
    }
  }
  return { size: SIZE, blocked, buildings, seed };
}

export function walkable(world, x, y) {
  return Number.isFinite(x) && Number.isFinite(y) && x >= 0 && y >= 0 && x < world.size && y < world.size && !world.blocked[Math.floor(y) * world.size + Math.floor(x)];
}

export function nearestWalkable(world, x, y, used = new Set()) {
  x = clamp(Math.floor(x), 0, world.size - 1); y = clamp(Math.floor(y), 0, world.size - 1);
  for (let r = 0; r < world.size; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (Math.abs(dx) + Math.abs(dy) !== r) continue;
    const tx = x + dx, ty = y + dy, key = ty * world.size + tx;
    if (walkable(world, tx, ty) && !used.has(key)) return { x: tx + .5, y: ty + .5 };
  }
  return null;
}

export function findPath(world, start, goal) {
  if (!walkable(world, start.x, start.y) || !walkable(world, goal.x, goal.y)) return [];
  const n = world.size, a = Math.floor(start.y) * n + Math.floor(start.x), b = Math.floor(goal.y) * n + Math.floor(goal.x);
  const costs = new Float64Array(n * n).fill(Infinity), previous = new Int32Array(n * n).fill(-1);
  const open = new Set([a]), closed = new Set(); costs[a] = 0;
  const h = id => Math.abs(id % n - b % n) + Math.abs(Math.floor(id / n) - Math.floor(b / n));
  while (open.size) {
    let current = -1, best = Infinity;
    for (const id of open) { const score = costs[id] + h(id); if (score < best) { best = score; current = id; } }
    if (current === b) {
      const path = [];
      for (let id = b; id !== -1; id = previous[id]) path.push({ x: id % n + .5, y: Math.floor(id / n) + .5 });
      path.reverse();
      if (distance(start, path[0]) < .001) path.shift();
      return path;
    }
    open.delete(current); closed.add(current);
    const x = current % n, y = Math.floor(current / n);
    for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
      if (!walkable(world, x + dx, y + dy)) continue;
      const next = (y + dy) * n + x + dx;
      if (closed.has(next) || costs[current] + 1 >= costs[next]) continue;
      costs[next] = costs[current] + 1; previous[next] = current; open.add(next);
    }
  }
  return [];
}

// Supercover grid traversal: touching a solid tile's corner also blocks a shot.
export function lineOfSight(world, a, b) {
  if (!walkable(world, a.x, a.y) || !walkable(world, b.x, b.y)) return false;
  let x = Math.floor(a.x), y = Math.floor(a.y);
  const ex = Math.floor(b.x), ey = Math.floor(b.y), dx = b.x - a.x, dy = b.y - a.y;
  const sx = Math.sign(dx), sy = Math.sign(dy), tx = dx ? Math.abs(1 / dx) : Infinity, ty = dy ? Math.abs(1 / dy) : Infinity;
  let mx = dx ? ((sx > 0 ? x + 1 : x) - a.x) / dx : Infinity;
  let my = dy ? ((sy > 0 ? y + 1 : y) - a.y) / dy : Infinity;
  while (x !== ex || y !== ey) {
    if (Math.abs(mx - my) < 1e-9) {
      if (!walkable(world, x + sx, y) || !walkable(world, x, y + sy)) return false;
      x += sx; y += sy; mx += tx; my += ty;
    } else if (mx < my) { x += sx; mx += tx; } else { y += sy; my += ty; }
    if (!walkable(world, x, y)) return false;
  }
  return true;
}

const profiles = [
  { name: 'VEX', role: 'POINT', hp: 120, speed: 2.6, damage: 10, range: 6.5 },
  { name: 'NULL', role: 'BREACH', hp: 100, speed: 2.8, damage: 9, range: 6.5 },
  { name: 'ECHO', role: 'RECON', hp: 90, speed: 3, damage: 12, range: 8 },
  { name: 'IRON', role: 'SUPPORT', hp: 140, speed: 2.4, damage: 11, range: 6 },
];

function guard(id, x, y) {
  return { id, x, y, home: { x, y }, team: 'guard', hp: 65, maxHp: 65, speed: 1.65, damage: 4, range: 5.8, cooldown: .8, path: [], target: null, think: 0, stun: 0, patrol: 0 };
}

export function createGame(seed = 2091) {
  const world = createWorld(seed);
  return {
    world, time: 0, phase: 'briefing', paused: false, holdFire: false, selected: new Set([0, 1, 2, 3]),
    agents: profiles.map((p, id) => ({ ...p, maxHp: p.hp, id, team: 'agent', x: 4.5 + id, y: 29.5, path: [], target: null, cooldown: 0, ammo: 12, reload: 0 })),
    guards: [[16.5, 29.5], [11.5, 20.5], [20.5, 20.5], [29.5, 20.5], [29.5, 11.5], [24.5, 11.5], [20.5, 6.5], [11.5, 8.5]].map(([x, y], i) => guard(100 + i, x, y)),
    relay: { x: 11.5, y: 18.5, progress: 0, done: false }, vault: { x: 28.5, y: 11.5, progress: 0, done: false },
    exit: { x: 5.5, y: 29.5 }, medkits: 2, pulses: 2, kills: 0, effects: [], events: [], log: [], extraction: 0, alert: 0,
  };
}

export function message(game, text, kind = 'info') {
  game.log.unshift({ text, kind, time: game.time }); game.log.length = Math.min(game.log.length, 5);
  game.events.push({ type: kind, text });
}

export function startGame(game) {
  if (game.phase !== 'briefing') return;
  game.phase = 'active'; message(game, 'Uplink established. Squad deployed in Breakwater.');
}

export function selectAgents(game, ids, additive = false) {
  if (!additive) game.selected.clear();
  for (const id of ids) if (game.agents.some(a => a.id === id && a.hp > 0)) game.selected.add(id);
}

export function orderMove(game, x, y) {
  if (game.phase !== 'active' || !Number.isFinite(x) || !Number.isFinite(y)) return false;
  const used = new Set(); let issued = false;
  for (const a of game.agents.filter(a => a.hp > 0 && game.selected.has(a.id))) {
    const dest = nearestWalkable(game.world, x, y, used);
    if (!dest) continue;
    const path = findPath(game.world, a, dest);
    if (!path.length && distance(a, dest) > .01) continue;
    used.add(Math.floor(dest.y) * game.world.size + Math.floor(dest.x));
    a.path = path; a.target = null; issued = true;
  }
  if (issued) { game.effects.push({ type: 'order', x, y, life: 1, maxLife: 1 }); game.events.push({ type: 'order' }); }
  return issued;
}

export function visibleGuard(game, enemy) {
  return enemy.hp > 0 && game.agents.some(a => a.hp > 0 && distance(a, enemy) <= 11 && lineOfSight(game.world, a, enemy));
}

export function orderAttack(game, id) {
  if (game.phase !== 'active') return false;
  const enemy = game.guards.find(e => e.id === id);
  if (!enemy || !visibleGuard(game, enemy)) return false;
  for (const a of game.agents.filter(a => a.hp > 0 && game.selected.has(a.id))) {
    a.target = id;
    a.path = findPath(game.world, a, enemy);
  }
  game.holdFire = false; game.events.push({ type: 'order' }); return true;
}

export function stopAgents(game) {
  if (game.phase !== 'active') return;
  for (const a of game.agents) if (game.selected.has(a.id)) { a.path = []; a.target = null; }
}

export function medkit(game) {
  if (game.phase !== 'active' || game.paused || game.medkits < 1) return false;
  const hurt = game.agents.filter(a => a.hp > 0 && a.hp < a.maxHp && game.selected.has(a.id));
  if (!hurt.length) return false;
  for (const a of hurt) a.hp = Math.min(a.maxHp, a.hp + 55);
  game.medkits--; message(game, 'Trauma patch applied to selected agents.', 'heal'); return true;
}

export function pulse(game) {
  if (game.phase !== 'active' || game.paused || game.pulses < 1) return false;
  const selected = game.agents.filter(a => a.hp > 0 && game.selected.has(a.id));
  if (!selected.length) return false;
  for (const e of game.guards) if (e.hp > 0 && selected.some(a => distance(a, e) <= 7)) e.stun = 6;
  for (const a of selected) game.effects.push({ type: 'pulse', x: a.x, y: a.y, life: 1.1, maxLife: 1.1 });
  game.pulses--; message(game, 'EMP discharged. Nearby security disabled for six seconds.', 'pulse'); return true;
}

function move(unit, dt) {
  let remaining = unit.speed * dt;
  while (remaining > 0 && unit.path.length) {
    const target = unit.path[0], d = distance(unit, target);
    if (d <= remaining) { unit.x = target.x; unit.y = target.y; unit.path.shift(); remaining -= d; }
    else { unit.x += (target.x - unit.x) / d * remaining; unit.y += (target.y - unit.y) / d * remaining; break; }
  }
}

function fire(game, unit, target) {
  unit.cooldown = unit.team === 'agent' ? .52 : 1.25;
  if (unit.team === 'agent') unit.ammo--;
  target.hp = Math.max(0, target.hp - unit.damage);
  game.alert = Math.max(game.alert, 10);
  game.effects.push({ type: 'shot', x: unit.x, y: unit.y, tx: target.x, ty: target.y, life: .13, maxLife: .13, team: unit.team });
  game.events.push({ type: 'shot', team: unit.team });
  if (target.hp <= 0) {
    target.path = [];
    if (target.team === 'guard') { game.kills++; message(game, 'Security unit neutralised.'); }
    else { game.selected.delete(target.id); message(game, `${target.name} is down.`, 'danger'); }
  }
}

export function tick(game, dt = STEP) {
  if (game.phase !== 'active' || game.paused || !Number.isFinite(dt) || dt <= 0) return;
  dt = Math.min(dt, .1); game.time += dt; game.alert = Math.max(0, game.alert - dt);
  game.effects = game.effects.filter(e => (e.life -= dt) > 0);
  const world = game.world;
  for (const a of game.agents) {
    if (a.hp <= 0) continue;
    a.cooldown -= dt;
    if (a.reload > 0) { a.reload -= dt; if (a.reload <= 0) a.ammo = 12; }
    if (!a.ammo && a.reload <= 0) a.reload = 1.8;
    const requested = game.guards.find(e => e.id === a.target && e.hp > 0);
    const inRange = e => e.hp > 0 && distance(a, e) <= a.range && lineOfSight(world, a, e);
    const target = requested && inRange(requested) ? requested : game.guards.filter(inRange).sort((p, q) => distance(a, p) - distance(a, q))[0];
    if (requested && !inRange(requested) && !a.path.length && visibleGuard(game, requested)) a.path = findPath(world, a, requested);
    if (!(requested && inRange(requested))) move(a, dt);
    if (!game.holdFire && target && a.cooldown <= 0 && a.reload <= 0 && a.ammo && inRange(target)) fire(game, a, target);
    if (a.target !== null && !requested) { a.target = null; a.path = []; }
  }
  for (const e of game.guards) {
    if (e.hp <= 0) continue;
    if (e.stun > 0) { e.stun = Math.max(0, e.stun - dt); continue; }
    e.cooldown -= dt; e.think -= dt;
    const target = game.agents.filter(a => a.hp > 0 && distance(e, a) < 9 && lineOfSight(world, e, a)).sort((a, b) => distance(e, a) - distance(e, b))[0];
    if (target && distance(e, target) <= e.range) {
      e.path = []; if (e.cooldown <= 0) fire(game, e, target);
    } else {
      if (e.think <= 0) {
        e.think = 1.1;
        if (target) e.path = findPath(world, e, target);
        else if (!e.path.length) {
          e.patrol = (e.patrol + 1) % 2;
          const dest = nearestWalkable(world, e.home.x + e.patrol * 2, e.home.y);
          if (dest) e.path = findPath(world, e, dest);
        }
      }
      move(e, dt);
    }
  }
  const living = game.agents.filter(a => a.hp > 0);
  if (!living.length) { game.phase = 'lost'; message(game, 'All agents lost. Contract terminated.', 'danger'); return; }
  const channel = (point, duration) => {
    if (living.some(a => distance(a, point) < 1.7 && !a.path.length && lineOfSight(world, a, point))) point.progress = Math.min(duration, point.progress + dt);
    else point.progress = Math.max(0, point.progress - dt * .5);
    if (point.progress >= duration) point.done = true;
  };
  if (!game.relay.done) {
    channel(game.relay, 3);
    if (game.relay.done) message(game, 'Relay severed. Ledger access unlocked.', 'objective');
  } else if (!game.vault.done) {
    channel(game.vault, 5);
    if (game.vault.done) {
      message(game, 'Ledger secured. Return every surviving agent to extraction.', 'objective');
      game.guards.push(guard(200, 29.5, 2.5), guard(201, 2.5, 20.5), guard(202, 20.5, 29.5));
      game.alert = 30;
    }
  }
  if (game.vault.done) {
    if (living.every(a => distance(a, game.exit) <= 3)) game.extraction += dt;
    else game.extraction = 0;
    if (game.extraction >= 2) { game.phase = 'won'; message(game, 'Extraction confirmed. Hostile takeover complete.', 'victory'); }
  }
}
