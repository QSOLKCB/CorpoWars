// SPDX-License-Identifier: Apache-2.0
// Frozen independent reference from CorpoWars 54a4b1bc1d24195092be2c1e8f056a2eb3730057.
// Original Set scan and insertion-order ties; never used by the shipped game.
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function walkable(world, x, y) {
  return Number.isFinite(x) && Number.isFinite(y) && x >= 0 && y >= 0 && x < world.size && y < world.size && !world.blocked[Math.floor(y) * world.size + Math.floor(x)];
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

