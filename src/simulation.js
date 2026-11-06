// SPDX-License-Identifier: Apache-2.0
// The simulation has no DOM, graphics, audio, network, or wall-clock dependencies.
import { createCampaign, WEAPONS, AUG_MODES, MISSIONS, DIFFICULTIES, ENEMY_TYPES, reservePatches } from './campaign.js';
import { capturesComplete, currentObjectiveKey } from './objectives.js';
export const STEP = 1 / 30;
export const SIZE = 36;
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function random(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

const DISTRICT_PARTS=[
  [[[0,0,2,5],[3,0,2,2],[3,3,2,2]], [[0,0,5,2],[0,3,2,2],[3,3,2,2]]],
  [[[0,0,1,5],[2,0,3,2],[2,3,3,2]], [[0,0,5,1],[0,2,2,3],[3,2,2,3]]],
  [[[0,0,2,2],[3,0,2,2],[0,3,2,2],[3,3,2,2]], [[0,0,5,2],[1,3,3,2]]],
];
export function createWorld(seed = 2091, layout = 0) {
  const rng = random(seed), blocked = new Uint8Array(SIZE * SIZE), buildings = [];
  for (let by = 0; by < 4; by++) for (let bx = 0; bx < 4; bx++) {
    const x = bx * 9 + 4, y = by * 9 + 4;
    // Open courtyards break up the skyline and leave routes around every block.
    const parts = layout>=3&&layout<=5 ? DISTRICT_PARTS[layout-3][(bx+by)%2] :
      (bx + by + layout) % 3 === 0 ? [[0, 0, 3, 5], [4, 0, 1, 3]] : [[0, 0, 5, 3], [0, 4, 3, 1]];
    for (const [dx, dy, w, d] of parts) {
      const height = 1.3 + rng() * 3.8;
      buildings.push({ x: x + dx, y: y + dy, w, d, height, tone: rng(), sign: buildings.length % 5 });
      for (let cy = y + dy; cy < y + dy + d; cy++) for (let cx = x + dx; cx < x + dx + w; cx++) blocked[cy * SIZE + cx] = 1;
    }
  }
  const world={ size: SIZE, blocked, buildings, seed };
  if(layout>=3&&layout<=5){world.layout=layout;world.theme=['copperline','coldstore','exchange'][layout-3];}
  return world;
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

// Adapted from VANILLAJS 1f965f4e5b6669de0f954e3a39b11aa679e56720's
// binary-heap navigation pattern. Keep CorpoWars's
// original Set insertion-order tie break and east/south/west/north expansion.
// Each live world owns one bounded scratch generation; paths always own their
// output points and occupancy is read fresh, including in-place terrain edits.
const searchWorkspaces = new WeakMap();
const PATH_DX = [1, 0, -1, 0], PATH_DY = [0, 1, 0, -1];
class SearchWorkspace {
  constructor(total) {
    this.total = total; this.epoch = 0; this.length = 0;
    this.costs = new Float64Array(total); this.priority = new Float64Array(total);
    this.previous = new Int32Array(total); this.heap = new Int32Array(total);
    this.position = new Int32Array(total); this.order = new Uint32Array(total);
    this.seen = new Uint32Array(total); this.closed = new Uint32Array(total);
  }
  begin() {
    this.length = 0;
    this.epoch = (this.epoch + 1) >>> 0;
    if (!this.epoch) { this.seen.fill(0); this.closed.fill(0); this.epoch = 1; }
  }
  before(a, b) {
    return this.priority[a] < this.priority[b] ||
      (this.priority[a] === this.priority[b] && this.order[a] < this.order[b]);
  }
  raise(id, at) {
    while (at) {
      const parent = (at - 1) >> 1, other = this.heap[parent];
      if (!this.before(id, other)) break;
      this.heap[at] = other; this.position[other] = at; at = parent;
    }
    this.heap[at] = id; this.position[id] = at;
  }
  pop() {
    const first = this.heap[0], last = this.heap[--this.length];
    if (this.length) {
      let at = 0;
      while (at * 2 + 1 < this.length) {
        let child = at * 2 + 1;
        if (child + 1 < this.length && this.before(this.heap[child + 1], this.heap[child])) child++;
        const other = this.heap[child];
        if (!this.before(other, last)) break;
        this.heap[at] = other; this.position[other] = at; at = child;
      }
      this.heap[at] = last; this.position[last] = at;
    }
    return first;
  }
}

export function findPath(world, start, goal) {
  if (!walkable(world, start.x, start.y) || !walkable(world, goal.x, goal.y)) return [];
  const n = world.size, total = n * n;
  const a = Math.floor(start.y) * n + Math.floor(start.x), b = Math.floor(goal.y) * n + Math.floor(goal.x);
  let work = searchWorkspaces.get(world);
  if (!work || work.total !== total) { work = new SearchWorkspace(total); searchWorkspaces.set(world, work); }
  work.begin();
  const { costs, priority, previous, seen, closed, order, position } = work, epoch = work.epoch;
  const gx = b % n, gy = Math.floor(b / n);
  costs[a] = 0; previous[a] = -1; seen[a] = epoch; order[a] = 0;
  priority[a] = Math.abs(a % n - gx) + Math.abs(Math.floor(a / n) - gy);
  work.raise(a, work.length++);
  let sequence = 1;
  while (work.length) {
    const current = work.pop();
    if (current === b) {
      const path = [];
      for (let id = b; id !== -1; id = previous[id]) path.push({ x: id % n + .5, y: Math.floor(id / n) + .5 });
      path.reverse();
      if (distance(start, path[0]) < .001) path.shift();
      return path;
    }
    closed[current] = epoch;
    const x = current % n, y = Math.floor(current / n), cost = costs[current] + 1;
    for (let direction = 0; direction < 4; direction++) {
      const nx = x + PATH_DX[direction], ny = y + PATH_DY[direction];
      if (!walkable(world, nx, ny)) continue;
      const next = ny * n + nx;
      if (closed[next] === epoch || (seen[next] === epoch && cost >= costs[next])) continue;
      const known = seen[next] === epoch;
      costs[next] = cost; previous[next] = current;
      priority[next] = cost + Math.abs(nx - gx) + Math.abs(ny - gy);
      if (!known) { seen[next] = epoch; order[next] = sequence++; }
      work.raise(next, known ? position[next] : work.length++);
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

function guard(id, x, y, difficulty = DIFFICULTIES.relaxed, enemyType = 'guard') {
  const type=ENEMY_TYPES[enemyType]??ENEMY_TYPES.guard,hp=Math.round(difficulty.hp*type.hp);
  return { id, x, y, prevX: x, prevY: y, home: { x, y }, team: 'guard', enemyType,
    hp, maxHp: hp, speed: difficulty.speed*type.speed, damage: difficulty.damage*type.damage,
    interval: difficulty.interval*type.interval, range: type.range, detection: type.detection, armour: type.armour,
    cooldown: .8, path: [], target: null, think: 0, stun: 0, fear: 0, patrol: 0 };
}

export function objectiveDuration(game,key) {
  return key==='relay'?(game.mission.relayDuration??3):key==='vault'?(game.mission.vaultDuration??5):key==='exit'?2:4;
}

export function configureWeapon(agent, research = [], refill = true) {
  const weapon = WEAPONS[agent.weapon], mode = agent.weapon === 'aug' ? AUG_MODES[agent.mode] : weapon;
  Object.assign(agent, { magazine: mode.magazine, interval: mode.interval * (research.includes('arms') ? .82 : 1),
    reloadTime: mode.reloadTime * (research.includes('arms') ? .85 : 1),
    damage: agent.weapon === 'issued' ? profiles[agent.id].damage : mode.damage,
    range: (agent.weapon === 'issued' ? profiles[agent.id].range : mode.range) + (research.includes('head') ? 1 : 0) });
  if(refill)agent.ammo=agent.magazine;
}

export function createGame(seed, campaign = createCampaign(), missionIndex = campaign.mission) {
  const mission = MISSIONS[missionIndex] || MISSIONS[0];
  const difficulty=DIFFICULTIES[campaign.difficulty]||DIFFICULTIES.relaxed;
  const world = createWorld(seed ?? mission.seed, mission.layout), upgrades = [...campaign.research];
  const point = ([x,y])=>({x,y,progress:0,done:false});
  const game = {
    mission, missionIndex, upgrades, difficulty,
    world, time: 0, phase: 'briefing', paused: false, holdFire: false, controlledAgent: 0, manualAim: null, selected: new Set([0, 1, 2, 3]),
    agents: profiles.map((p, id) => ({ ...p, hp: p.hp+(upgrades.includes('torso')?30:0), maxHp: p.hp+(upgrades.includes('torso')?30:0),
      speed: p.speed*(upgrades.includes('legs')?1.18:1), armour: upgrades.includes('torso')?.2:0,
      id, team: 'agent', x: mission.spawn[0]+id, y: mission.spawn[1], prevX: mission.spawn[0]+id, prevY: mission.spawn[1],
      weapon: campaign.loadout[id], mode: campaign.modes[id], path: [], target: null, cooldown: 0, ammo: 12, reload: 0 })),
    guards: mission.guards.map(([x,y,type],i)=>guard(100+i,x,y,difficulty,type)),
    relay: point(mission.relay), vault: point(mission.vault), exit: point(mission.exit),
    medkits: (upgrades.includes('med2')?4:2)+reservePatches(campaign), reserveMedkits: reservePatches(campaign), healAmount: upgrades.includes('med2')?110:upgrades.includes('med1')?85:55,
    hackSpeed: upgrades.includes('head')?1.3:1,
    panicEnabled: false, panicCooldown: 0, panicRange: upgrades.includes('panic1')?9:7,
    panicDuration: (upgrades.includes('panic2')?11:upgrades.includes('panic1')?8:5)*difficulty.fearScale,
    panicRecharge: upgrades.includes('panic2')?14:upgrades.includes('panic1')?18:24,
    pulses: 2, kills: 0, effects: [], events: [], log: [], extraction: 0, alert: 0,
    metrics:{medkitsUsed:0,empsUsed:0,panicBursts:0},
    holdContested:false,holdWavesSpawned:(mission.waves??[]).map(()=>false),
    lockdownRemaining:null,escortFollowing:false,escortAgents:[],escortThink:0,
  };
  const defenders=new Set(game.guards.map(unit=>Math.floor(unit.y)*world.size+Math.floor(unit.x)));
  game.captureKeys = mission.captures.map((position,i)=>{
    const key=`capture${i+1}`;
    game[key]={...point(position),label:`CONTROL ${i+(mission.kind==='escort'?2:3)}`};
    const post=nearestWalkable(world,position[0],position[1],defenders);
    if(post){defenders.add(Math.floor(post.y)*world.size+Math.floor(post.x));game.guards.push(guard(500+i,post.x,post.y,difficulty,i>1?'bulwark':'guard'));}
    return key;
  });
  if(mission.kind==='escort')game.courier={id:300,name:'Witness',team:'courier',x:game.vault.x,y:game.vault.y,
    prevX:game.vault.x,prevY:game.vault.y,active:false,hp:mission.courier.hp,maxHp:mission.courier.hp,
    speed:mission.courier.speed,path:[],armour:0};
  const occupied=new Set(game.guards.map(e=>Math.floor(e.y)*world.size+Math.floor(e.x)));
  for(let i=0;i<difficulty.extraGuards;i++) {
    const anchor=i<2?game.relay:game.vault,point=nearestWalkable(world,anchor.x+(i%2?2:-2),anchor.y+1,occupied);
    if(point){occupied.add(Math.floor(point.y)*world.size+Math.floor(point.x));game.guards.push(guard(150+i,point.x,point.y,difficulty));}
  }
  for(const a of game.agents)configureWeapon(a,upgrades);
  return game;
}

export function message(game, text, kind = 'info') {
  game.log.unshift({ text, kind, time: game.time }); game.log.length = Math.min(game.log.length, 5);
  game.events.push({ type: kind, text });
}

export function startGame(game) {
  if (game.phase !== 'briefing') return;
  game.phase = 'active'; message(game, `Uplink established. Squad deployed in ${game.mission.district}.`);
}

export function selectAgents(game, ids, additive = false) {
  game.manualAim=null;
  if (!additive) game.selected.clear();
  for (const id of ids) if (game.agents.some(a => a.id === id && a.hp > 0)) game.selected.add(id);
  if(ids.length && game.selected.has(ids[0]))game.controlledAgent=ids[0];
}

function formationMove(game,x,y,ids) {
  const used = new Set(); let issued = false;
  for (const a of game.agents.filter(a => a.hp > 0 && ids.has(a.id))) {
    const dest = nearestWalkable(game.world, x, y, used);
    if (!dest) continue;
    const path = findPath(game.world, a, dest);
    if (!path.length && distance(a, dest) > .01) continue;
    used.add(Math.floor(dest.y) * game.world.size + Math.floor(dest.x));
    a.path = path; a.target = null; issued = true;
  }
  return issued;
}
export function orderMove(game, x, y) {
  if (game.phase !== 'active' || !Number.isFinite(x) || !Number.isFinite(y)) return false;
  game.manualAim=null;
  const issued=formationMove(game,x,y,game.selected);
  if(issued)game.escortFollowing=false;
  if (issued) { game.effects.push({ type: 'order', x, y, life: 1, maxLife: 1 }); game.events.push({ type: 'order' }); }
  return issued;
}

export function orderEscort(game) {
  if(game.phase!=='active'||!game.courier?.active||game.courier.hp<=0)return false;
  const ids=game.agents.filter(a=>a.hp>0&&game.selected.has(a.id)).map(a=>a.id);
  if(!ids.length)return false;
  game.escortAgents=ids;game.escortFollowing=true;game.escortThink=0;
  message(game,'Selected agents escorting the witness. Manual orders cancel escort.','order');
  return true;
}

export function visibleGuard(game, enemy) {
  return enemy.hp > 0 && game.agents.some(a => a.hp > 0 && distance(a, enemy) <= 11 && lineOfSight(game.world, a, enemy));
}

export function orderAttack(game, id) {
  if (game.phase !== 'active') return false;
  const enemy = game.guards.find(e => e.id === id);
  if (!enemy || !visibleGuard(game, enemy)) return false;
  game.manualAim=null;game.escortFollowing=false;
  for (const a of game.agents.filter(a => a.hp > 0 && game.selected.has(a.id))) {
    a.target = id;
    a.path = findPath(game.world, a, enemy);
  }
  game.holdFire = false; game.events.push({ type: 'order' }); return true;
}

export function stopAgents(game) {
  if (game.phase !== 'active') return;
  game.manualAim=null;game.escortFollowing=false;
  for (const a of game.agents) if (game.selected.has(a.id)) { a.path = []; a.target = null; }
}

export function medkit(game) {
  if (game.phase !== 'active' || game.paused || game.medkits < 1) return false;
  const hurt = game.agents.filter(a => a.hp > 0 && a.hp < a.maxHp && game.selected.has(a.id));
  if (!hurt.length) return false;
  for (const a of hurt) a.hp = Math.min(a.maxHp, a.hp + game.healAmount);
  if(game.medkits<=game.reserveMedkits)game.reserveMedkits--;
  game.medkits--;game.metrics.medkitsUsed++; message(game, 'Trauma patch applied to selected agents.', 'heal'); return true;
}

export function pulse(game) {
  if (game.phase !== 'active' || game.paused || game.pulses < 1) return false;
  const selected = game.agents.filter(a => a.hp > 0 && game.selected.has(a.id));
  if (!selected.length) return false;
  for (const e of game.guards) if (e.hp > 0 && selected.some(a => distance(a, e) <= 7)) e.stun = 6;
  for (const a of selected) game.effects.push({ type: 'pulse', x: a.x, y: a.y, life: 1.1, maxLife: 1.1 });
  game.pulses--;game.metrics.empsUsed++; message(game, 'EMP discharged. Nearby security disabled for six seconds.', 'pulse'); return true;
}

export function cycleMode(game) {
  if(game.phase!=='active')return false;
  let changed=false;
  for(const a of game.agents)if(a.hp>0&&game.selected.has(a.id)&&a.weapon==='aug') {
    a.mode=(a.mode+1)%AUG_MODES.length;configureWeapon(a,game.upgrades,false);
    // A conversion always costs a complete reload: switching cannot refill for free.
    a.ammo=0;a.reload=a.reloadTime;a.cooldown=Math.max(a.cooldown,a.interval);changed=true;
  }
  if(changed)message(game,'AUG conversion selected. Reloading.','order');return changed;
}
export function togglePanic(game) {
  if(game.phase!=='active')return false;
  game.panicEnabled=!game.panicEnabled;
  message(game,game.panicEnabled?'Panic field armed. Visible hostiles will fall back.':'Panic field disengaged.');return true;
}

// A bounded flood fill chooses a reachable retreat. Walls cannot trap AI in an
// endlessly retried, unreachable straight-line destination.
export function retreatPath(world, unit, sources) {
  const n=world.size,start=Math.floor(unit.y)*n+Math.floor(unit.x),queue=[start],prev=new Map([[start,-1]]),depth=new Map([[start,0]]);
  const safety=id=>Math.min(...sources.map(a=>Math.hypot(id%n+.5-a.x,Math.floor(id/n)+.5-a.y)));
  let best=start,score=safety(start);
  for(let i=0;i<queue.length;i++) {
    const id=queue[i],x=id%n,y=Math.floor(id/n),d=depth.get(id);
    if(safety(id)>score){best=id;score=safety(id);}
    if(d===7)continue;
    for(const [dx,dy] of [[1,0],[0,1],[-1,0],[0,-1]]) {
      const next=(y+dy)*n+x+dx;
      if(walkable(world,x+dx,y+dy)&&!prev.has(next)){prev.set(next,id);depth.set(next,d+1);queue.push(next);}
    }
  }
  const path=[];for(let id=best;id!==-1;id=prev.get(id))path.push({x:id%n+.5,y:Math.floor(id/n)+.5});
  path.reverse();if(distance(unit,path[0])<.001)path.shift();return path;
}
function updatePanic(game,dt) {
  game.panicCooldown=Math.max(0,game.panicCooldown-dt);
  if(!game.panicEnabled||game.panicCooldown>0)return;
  const sources=game.agents.filter(a=>a.hp>0&&game.selected.has(a.id));
  const affected=game.guards.filter(e=>e.hp>0&&sources.some(a=>distance(a,e)<=game.panicRange&&lineOfSight(game.world,a,e)));
  if(!affected.length)return;
  for(const e of affected){e.fear=game.panicDuration;e.path=retreatPath(game.world,e,sources);e.target=null;}
  game.panicCooldown=game.panicRecharge;
  game.metrics.panicBursts++;
  for(const a of sources)game.effects.push({type:'panic',x:a.x,y:a.y,life:1,maxLife:1});
  message(game,`${affected.length} hostile${affected.length===1?'':'s'} falling back.`, 'panic');
}

function move(unit, dt, multiplier = 1) {
  let remaining = unit.speed * dt * multiplier;
  while (remaining > 0 && unit.path.length) {
    const target = unit.path[0], d = distance(unit, target);
    if (d <= remaining) { unit.x = target.x; unit.y = target.y; unit.path.shift(); remaining -= d; }
    else { unit.x += (target.x - unit.x) / d * remaining; unit.y += (target.y - unit.y) / d * remaining; break; }
  }
}

function updateEscortOrders(game,dt) {
  const courier=game.courier;
  if(!courier?.active||courier.hp<=0)return;
  if(!courier.path.length&&distance(courier,game.exit)>.1)courier.path=findPath(game.world,courier,game.exit);
  if(!game.escortFollowing)return;
  game.escortThink-=dt;
  if(game.escortThink>0)return;
  game.escortThink=.75;
  const ids=new Set(game.escortAgents),point=courier.path[Math.min(2,courier.path.length-1)]??game.exit;
  if(!game.agents.some(a=>a.hp>0&&ids.has(a.id))){game.escortFollowing=false;return;}
  formationMove(game,point.x,point.y,ids);
}
function updateCourier(game,dt) {
  const courier=game.courier;
  if(!courier?.active||courier.hp<=0)return;
  if(game.agents.some(a=>a.hp>0&&distance(a,courier)<=6&&lineOfSight(game.world,a,courier)))move(courier,dt);
}

function fire(game, unit, target) {
  unit.cooldown = unit.interval;
  if (unit.team === 'agent') unit.ammo--;
  if(target.team)target.hp = Math.max(0, target.hp - Math.max(1, Math.round(unit.damage*(1-(target.armour||0)))));
  game.alert = Math.max(game.alert, 10);
  game.effects.push({ type: 'shot', x: unit.x, y: unit.y, tx: target.x, ty: target.y, life: .13, maxLife: .13, team: unit.team, weapon: unit.weapon });
  game.events.push({ type: 'shot', team: unit.team });
  if (target.team && target.hp <= 0) {
    target.path = [];
    if (target.team === 'guard') { game.kills++; message(game, 'Security unit neutralised.'); }
    else if(target.team==='courier')message(game,'The witness has been killed. Contract terminated.','danger');
    else { game.selected.delete(target.id); message(game, `${target.name} is down.`, 'danger'); }
  }
}

// A direct shot consumes the controlled agent's real ammo/cooldown. Friendly
// bodies stop the ray without damage; walls win ties. No path or target lock.
export function manualFire(game, id, x, y) {
  const a=game.agents.find(unit=>unit.id===id);
  if(game.phase!=='active'||game.paused||!a||a.hp<=0||!game.selected.has(id)||!Number.isFinite(x)||!Number.isFinite(y)||a.cooldown>0||a.reload>0||a.ammo<=0)return false;
  const length=Math.hypot(x-a.x,y-a.y);
  if(!Number.isFinite(length)||length<1e-6)return false;
  const dx=(x-a.x)/length,dy=(y-a.y)/length,reach=Math.min(length,a.range);
  let end=reach,target=null;
  for(const unit of [...game.agents,...game.guards,...(game.courier?.active?[game.courier]:[])]) {
    if(unit===a||unit.hp<=0)continue;
    const ux=unit.x-a.x,uy=unit.y-a.y,along=ux*dx+uy*dy,perp=ux*dy-uy*dx;
    if(along<0||Math.abs(perp)>.35)continue;
    const entry=Math.max(0,along-Math.sqrt(Math.max(0,.35*.35-perp*perp)));
    if(entry<end){end=entry;target=unit;}
  }
  let hit={x:a.x+dx*end,y:a.y+dy*end};
  if(!lineOfSight(game.world,a,hit)) {
    let lo=0,hi=end;
    for(let i=0;i<24;i++){const mid=(lo+hi)/2;if(lineOfSight(game.world,a,{x:a.x+dx*mid,y:a.y+dy*mid}))lo=mid;else hi=mid;}
    hit={x:a.x+dx*lo,y:a.y+dy*lo};target=null;
  }
  fire(game,a,target?.team==='guard'?target:hit);
  return true;
}
export function aimManualFire(game,x,y) {
  const a=game.agents.find(unit=>unit.id===game.controlledAgent&&unit.hp>0&&game.selected.has(unit.id));
  if(game.phase!=='active'||game.paused||!a||!Number.isFinite(x)||!Number.isFinite(y))return false;
  a.path=[];a.target=null;game.escortFollowing=false;
  game.manualAim={id:a.id,x,y};return true;
}

export function tick(game, dt = STEP) {
  if (game.phase !== 'active' || game.paused || !Number.isFinite(dt) || dt <= 0) return;
  dt = Math.min(dt, .1); game.time += dt; game.alert = Math.max(0, game.alert - dt);
  const lockdownWasRunning=game.lockdownRemaining!==null;
  game.effects = game.effects.filter(e => (e.life -= dt) > 0);
  const world = game.world;
  for(const unit of [...game.agents,...game.guards]){unit.prevX=unit.x;unit.prevY=unit.y;}
  if(game.courier){game.courier.prevX=game.courier.x;game.courier.prevY=game.courier.y;}
  updatePanic(game,dt);
  updateEscortOrders(game,dt);
  for (const a of game.agents) {
    if (a.hp <= 0) continue;
    a.cooldown -= dt;
    if (a.reload > 0) { a.reload -= dt; if (a.reload <= 0) a.ammo = a.magazine; }
    if (!a.ammo && a.reload <= 0) a.reload = a.reloadTime;
    if(game.manualAim?.id===a.id){manualFire(game,a.id,game.manualAim.x,game.manualAim.y);continue;}
    const requested = game.guards.find(e => e.id === a.target && e.hp > 0);
    const inRange = e => e.hp > 0 && distance(a, e) <= a.range && lineOfSight(world, a, e);
    let target=requested&&inRange(requested)?requested:null;
    if(!target)for(const e of game.guards)if(inRange(e)&&(!target||distance(a,e)<distance(a,target)))target=e;
    if (requested && !inRange(requested) && !a.path.length && visibleGuard(game, requested)) a.path = findPath(world, a, requested);
    if (!(requested && inRange(requested))) move(a, dt);
    if (!game.holdFire && target && a.cooldown <= 0 && a.reload <= 0 && a.ammo && inRange(target)) fire(game, a, target);
    if (a.target !== null && !requested) { a.target = null; a.path = []; }
  }
  updateCourier(game,dt);
  for (const e of game.guards) {
    if (e.hp <= 0) continue;
    if(e.fear>0) {
      e.fear=Math.max(0,e.fear-dt);
      if(e.stun>0)e.stun=Math.max(0,e.stun-dt);else move(e,dt,1.45);
      if(e.fear===0){e.path=[];e.think=0;e.cooldown=Math.max(e.cooldown,.5);}
      continue;
    }
    if (e.stun > 0) { e.stun = Math.max(0, e.stun - dt); continue; }
    e.cooldown -= dt; e.think -= dt;
    let target=null;
    for(const a of game.agents)if(a.hp>0&&distance(e,a)<e.detection&&lineOfSight(world,e,a)&&(!target||distance(e,a)<distance(e,target)))target=a;
    const courier=game.courier;
    if(courier?.active&&courier.hp>0&&distance(e,courier)<e.detection&&lineOfSight(world,e,courier)&&(!target||distance(e,courier)<distance(e,target)))target=courier;
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
  if(game.courier?.active&&game.courier.hp<=0){game.phase='lost';game.escortFollowing=false;return;}
  const channel = (point, duration) => {
    if (living.some(a => distance(a, point) < 1.7 && !a.path.length && lineOfSight(world, a, point))) point.progress = Math.min(duration, point.progress + dt*game.hackSpeed);
    else point.progress = Math.max(0, point.progress - dt * .5);
    if (point.progress >= duration) point.done = true;
  };
  if (!game.relay.done) {
    channel(game.relay, objectiveDuration(game,'relay'));
    if (game.relay.done) {
      message(game, `${game.mission.labels[0]} disabled. Next objective unlocked.`, 'objective');
      if(game.mission.kind==='lockdown'){
        game.lockdownRemaining=game.mission.lockdown[game.difficulty.name.toLowerCase()];
        message(game,`Lockdown initiated. ${game.lockdownRemaining} seconds to seize the reserve and extract.`,'danger');
      }
    }
  } else if (!game.vault.done && currentObjectiveKey(game)==='vault') {
    if(game.mission.kind==='hold') {
      const occupied=living.some(a=>distance(a,game.vault)<1.7&&!a.path.length&&lineOfSight(world,a,game.vault));
      for(const [i,wave] of (game.mission.waves??[]).entries())if(!game.holdWavesSpawned[i]&&occupied&&game.vault.progress>=wave.at){
        game.holdWavesSpawned[i]=true;
        game.guards.push(...wave.guards.map(([x,y,type],j)=>{
          const e=guard(400+i*32+j,x,y,game.difficulty,type);e.path=findPath(world,e,game.vault);return e;
        }));
        game.alert=30;message(game,`Security wave ${i+1} inbound. Hold the transmit zone.`,'danger');
      }
      const contested=game.guards.some(e=>e.hp>0&&e.stun<=0&&e.fear<=0&&distance(e,game.vault)<=3&&lineOfSight(world,e,game.vault));
      if(contested!==game.holdContested){game.holdContested=contested;message(game,contested?'Transmit zone contested. Clear or disable nearby security.':'Transmit zone clear. Transmission can resume.','objective');}
      game.vault.progress=occupied&&!contested?Math.min(objectiveDuration(game,'vault'),game.vault.progress+dt):Math.max(0,game.vault.progress-dt*.5);
      if(game.vault.progress>=objectiveDuration(game,'vault'))game.vault.done=true;
    }else channel(game.vault, objectiveDuration(game,'vault'));
    if (game.vault.done) {
      message(game, `${game.mission.labels[1]} secured. Secure remaining control points, then extract every survivor.`, 'objective');
      game.guards.push(...game.mission.reinforcements.map(([x,y,type],i)=>guard(200+i,x,y,game.difficulty,type)));
      if(game.courier){game.courier.active=true;game.courier.path=findPath(world,game.courier,game.exit);message(game,'Witness released. Use Escort to accompany them; stay within six tiles and line of sight.','objective');}
      game.alert = 30;
    }
  }
  if(game.relay.done) {
    const key=currentObjectiveKey(game);
    if(key.startsWith('capture')) {
      const point=game[key];channel(point,objectiveDuration(game,key));
      if(point.done)message(game,`${point.label} captured. ${capturesComplete(game)?'Extraction unlocked.':'Next control point unlocked.'}`,'objective');
    }
  }
  if (capturesComplete(game)) {
    const courierReady=!game.courier||game.courier.active&&game.courier.hp>0&&distance(game.courier,game.exit)<=3;
    if (living.every(a => distance(a, game.exit) <= 3)&&courierReady) game.extraction += dt;
    else game.extraction = 0;
    if (game.extraction >= 2) { game.phase = 'won'; message(game, 'Extraction confirmed. Hostile takeover complete.', 'victory'); }
  }
  // A completed extraction wins at the exact deadline. Otherwise expiration
  // fails after this tick; the relay-completion tick starts a full countdown.
  if(lockdownWasRunning){game.lockdownRemaining=Math.max(0,game.lockdownRemaining-dt);if(game.lockdownRemaining===0&&game.phase==='active'){game.phase='lost';message(game,'Lockdown complete. Extraction route sealed.','danger');}}
}
