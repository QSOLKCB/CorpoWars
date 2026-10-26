// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame,createWorld,walkable,findPath,lineOfSight,nearestWalkable,startGame,tick,STEP,orderMove,orderAttack,selectAgents,stopAgents,medkit,pulse,visibleGuard } from '../src/simulation.js';

const advance=(g,seconds)=>{for(let i=0;i<Math.ceil(seconds/STEP);i++){tick(g);g.events=[];}};
const emptyWorld=(size=6)=>({size,blocked:new Uint8Array(size*size)});

test('the seeded city is reproducible and every walkable cell is connected',()=>{
  const w=createWorld();assert.deepEqual(w,createWorld());assert.notDeepEqual(w.buildings,createWorld(9).buildings);
  const queue=[[0,0]],seen=new Set(['0,0']);
  for(let i=0;i<queue.length;i++){const [x,y]=queue[i];for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const key=`${x+dx},${y+dy}`;if(walkable(w,x+dx,y+dy)&&!seen.has(key)){seen.add(key);queue.push([x+dx,y+dy]);}}}
  assert.equal(seen.size,w.blocked.filter(b=>!b).length);
});
test('routes avoid solids, cannot wrap rows, and report unreachable endpoints',()=>{
  const w=emptyWorld();w.blocked[1*6+2]=1;w.blocked[2*6+2]=1;
  const start={x:1.5,y:1.5},end={x:4.5,y:1.5},path=findPath(w,start,end);
  assert.deepEqual(path.at(-1),end);let prev=start;
  for(const p of path){assert.ok(walkable(w,p.x,p.y));assert.equal(Math.abs(prev.x-p.x)+Math.abs(prev.y-p.y),1);prev=p;}
  for(let y=0;y<6;y++)w.blocked[y*6+3]=1;
  assert.deepEqual(findPath(w,start,end),[]);assert.deepEqual(findPath(w,start,{x:-1,y:1}),[]);
});
test('line of sight rejects walls and diagonal corner clipping in both directions',()=>{
  const w=emptyWorld();w.blocked[1*6+2]=1;
  for(const [a,b] of [[{x:1.5,y:1.5},{x:3.5,y:1.5}],[{x:1.5,y:1.5},{x:2.5,y:2.5}]]){assert.equal(lineOfSight(w,a,b),false);assert.equal(lineOfSight(w,b,a),false);}
  assert.ok(lineOfSight(w,{x:.5,y:.5},{x:.5,y:5.5}));assert.ok(lineOfSight(w,{x:.5,y:.5},{x:5.5,y:.5}));
  assert.equal(lineOfSight(w,{x:-.1,y:1},{x:1,y:1}),false);
});
test('formation destinations are distinct, walkable, and orders work during tactical pause',()=>{
  const g=createGame();assert.equal(orderMove(g,10,10),false);startGame(g);g.paused=true;
  assert.ok(orderMove(g,14,14));const destinations=g.agents.map(a=>a.path.at(-1));
  assert.equal(new Set(destinations.map(p=>`${p.x},${p.y}`)).size,4);for(const p of destinations)assert.ok(walkable(g.world,p.x,p.y));
  const before=structuredClone(g.agents);advance(g,1);assert.deepEqual(g.agents,before);assert.equal(g.time,0);
  g.paused=false;advance(g,1);assert.notDeepEqual(g.agents,before);
});
test('reissuing movement mid-cell does not cut a blocked corner',()=>{
  const g=createGame();startGame(g);selectAgents(g,[0]);orderMove(g,11.5,18.5);advance(g,.4);orderMove(g,29.5,11.5);
  for(let i=0;i<900;i++){tick(g);for(const a of g.agents)assert.ok(walkable(g.world,a.x,a.y));g.events=[];}
});
test('selection, stop and invalid commands respect agent state',()=>{
  const g=createGame();startGame(g);g.agents[1].hp=0;selectAgents(g,[1,2]);assert.deepEqual([...g.selected],[2]);selectAgents(g,[3],true);assert.deepEqual([...g.selected],[2,3]);
  orderMove(g,20,20);stopAgents(g);assert.equal(g.agents[2].path.length,0);assert.equal(orderMove(g,NaN,0),false);assert.equal(orderMove(g,Infinity,0),false);
  assert.equal(nearestWalkable(emptyWorld(),-100,100).x,.5);
});
test('patches cannot revive, over-heal, or consume charges without an eligible agent',()=>{
  const g=createGame();startGame(g);assert.equal(medkit(g),false);assert.equal(g.medkits,2);
  g.agents[0].hp=0;g.agents[1].hp=95;assert.ok(medkit(g));assert.equal(g.agents[0].hp,0);assert.equal(g.agents[1].hp,100);assert.equal(g.medkits,1);
  g.paused=true;g.agents[1].hp=50;assert.equal(medkit(g),false);assert.equal(g.medkits,1);
});
test('EMP range, cooldown and finite charges are enforced',()=>{
  const g=createGame();startGame(g);g.guards[0].x=g.agents[0].x+1;g.guards[0].y=g.agents[0].y;
  assert.ok(pulse(g));assert.equal(g.guards[0].stun,6);assert.equal(g.guards[4].stun,0);g.holdFire=true;advance(g,1);assert.ok(g.guards[0].stun<6&&g.guards[0].stun>4.9);
  assert.ok(pulse(g));assert.equal(pulse(g),false);assert.equal(g.pulses,0);
});
test('walls prevent both agent and guard gunfire',()=>{
  const g=createGame();startGame(g);g.world=emptyWorld();g.world.blocked[2*6+2]=1;
  g.agents=g.agents.slice(0,1);Object.assign(g.agents[0],{x:1.5,y:2.5});g.guards=g.guards.slice(0,1);Object.assign(g.guards[0],{x:3.5,y:2.5,think:100,path:[]});
  const hp=[g.agents[0].hp,g.guards[0].hp];advance(g,2);assert.deepEqual([g.agents[0].hp,g.guards[0].hp],hp);assert.equal(visibleGuard(g,g.guards[0]),false);assert.equal(orderAttack(g,g.guards[0].id),false);
});
test('magazines reload without negative ammunition',()=>{
  const g=createGame();startGame(g);g.agents=g.agents.slice(0,1);g.guards=g.guards.slice(0,1);
  Object.assign(g.guards[0],{x:8.5,y:29.5,hp:10000,damage:0});g.agents[0].ammo=1;
  advance(g,.2);assert.equal(g.agents[0].ammo,0);advance(g,2);assert.ok(g.agents[0].ammo>0&&g.agents[0].ammo<=12);
});
test('ledger access requires relay completion and a stationary living hacker',()=>{
  const g=createGame();startGame(g);g.guards=[];g.agents[0].x=g.vault.x;g.agents[0].y=g.vault.y;advance(g,6);assert.equal(g.vault.done,false);
  g.relay.done=true;advance(g,6);assert.equal(g.vault.done,true);assert.equal(g.guards.length,3);
});
test('extraction requires every survivor and resets when an agent leaves',()=>{
  const g=createGame();startGame(g);g.guards=[];g.relay.done=true;g.vault.done=true;
  g.agents[0].x=20.5;advance(g,3);assert.equal(g.phase,'active');assert.equal(g.extraction,0);
  g.agents[0].hp=0;advance(g,1);assert.ok(g.extraction>0);g.agents[1].x=20.5;tick(g);assert.equal(g.extraction,0);
  g.agents[1].x=5.5;advance(g,2.1);assert.equal(g.phase,'won');
});
test('loss and victory are terminal and time is frozen',()=>{
  const g=createGame();startGame(g);g.agents.forEach(a=>a.hp=0);tick(g);assert.equal(g.phase,'lost');const time=g.time;advance(g,3);assert.equal(g.time,time);assert.equal(orderMove(g,1,1),false);
});
function playMission() {
  const g=createGame();startGame(g);
  for(const objective of ['relay','vault','exit']) {
    assert.ok(orderMove(g,g[objective].x,g[objective].y));
    for(let step=0;step<3600&&g.phase==='active'&&(objective==='exit'||!g[objective].done);step++){
      tick(g);g.events=[];for(const a of g.agents){assert.ok(Number.isFinite(a.hp));assert.ok(walkable(g.world,a.x,a.y));}
    }
  }
  assert.equal(g.phase,'won');assert.equal(g.agents.filter(a=>a.hp>0).length,4);assert.ok(g.kills>0);assert.ok(g.time<120);
  return {time:g.time,hp:g.agents.map(a=>a.hp),kills:g.kills};
}
test('a complete real-combat mission is winnable and repeatable',()=>assert.deepEqual(playMission(),playMission()));
