// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {createCampaign,decodeCampaign,buyPatch,reservePatches,PATCH_COST,MAX_RESERVE_PATCHES,MISSIONS} from '../src/campaign.js';
import {createGame,startGame,tick,STEP,selectAgents,manualFire,aimManualFire,medkit,walkable,findPath,objectiveDuration,orderMove} from '../src/simulation.js';
import {captureKeys,objectiveKeys,capturesComplete,currentObjectiveKey} from '../src/objectives.js';
import {Renderer} from '../src/renderer.js';
import {modelCanvas} from '../scripts/performance-render-model.mjs';

function arena(){
  const game=createGame();startGame(game);game.world.blocked.fill(0);game.holdFire=true;
  game.agents.forEach((a,i)=>Object.assign(a,{x:2.5,y:2.5+i*2,prevX:2.5,prevY:2.5+i*2,path:[]}));
  const enemy=game.guards[0];Object.assign(enemy,{x:6.5,y:2.5,speed:0,damage:0,cooldown:100,think:100});game.guards=[enemy];
  return game;
}
const run=(g,n)=>{for(let i=0;i<n;i++)tick(g);};

test('right-click shot uses only the controlled selected agent and overrides hold fire',()=>{
  const g=arena(),a=g.agents[0],enemy=g.guards[0],hp=enemy.hp;
  assert.ok(aimManualFire(g,enemy.x,enemy.y));assert.ok(manualFire(g,a.id,enemy.x,enemy.y));
  assert.equal(a.ammo,11);assert.equal(enemy.hp,hp-a.damage);assert.deepEqual(g.agents.slice(1).map(a=>a.ammo),[12,12,12]);
  assert.equal(manualFire(g,a.id,enemy.x,enemy.y),false);assert.equal(a.ammo,11);
  run(g,17);assert.equal(a.ammo,10);assert.equal(g.holdFire,true);
  selectAgents(g,[1]);assert.equal(g.controlledAgent,1);assert.equal(g.manualAim,null);
  assert.equal(manualFire(g,0,enemy.x,enemy.y),false);
});

test('manual misses consume ammo; cover, range and friendly bodies prevent target damage',()=>{
  for(const reason of ['wall','range','friend','courier','miss']){
    const g=arena(),a=g.agents[0],e=g.guards[0],hp=e.hp;
    if(reason==='wall')g.world.blocked[2*g.world.size+4]=1;
    if(reason==='range')e.x=15;
    if(reason==='friend')Object.assign(g.agents[1],{x:4,y:2.5});
    if(reason==='courier')g.courier={x:4,y:2.5,hp:120,team:'courier',active:true};
    assert.ok(manualFire(g,a.id,e.x,reason==='miss'?0:e.y),reason);
    assert.equal(e.hp,hp,reason);assert.equal(a.ammo,11);assert.equal(g.agents[1].hp,g.agents[1].maxHp);
    if(g.courier)assert.equal(g.courier.hp,120);
    if(reason==='wall')assert.ok(g.effects.at(-1).tx<=4);
    if(reason==='range')assert.ok(g.effects.at(-1).tx<=a.x+a.range);
  }
});

test('manual rays stop at the nearest hostile and reject paused, dead, empty and invalid shots',()=>{
  const g=arena(),a=g.agents[0],e=g.guards[0];g.guards.push({...e,id:101,x:5});
  assert.ok(manualFire(g,0,e.x,e.y));assert.equal(e.hp,e.maxHp);assert.ok(g.guards[1].hp<e.hp);
  for(const condition of ['paused','dead','empty','reload','briefing','won']){
    const g=arena(),a=g.agents[0];
    if(condition==='paused')g.paused=true;else if(condition==='dead')a.hp=0;else if(condition==='empty')a.ammo=0;else if(condition==='reload')a.reload=1;else g.phase=condition;
    const before=JSON.stringify(g);assert.equal(manualFire(g,0,6.5,2.5),false);assert.equal(JSON.stringify(g),before);
  }
  for(const [x,y] of [[NaN,1],[1,Infinity],[2.5,2.5]])assert.equal(manualFire(arena(),0,x,y),false);
});

test('held manual fire reloads naturally and never queues an attack or movement order',()=>{
  const g=arena(),a=g.agents[0];g.guards=[];
  a.path=[{x:9,y:2.5}];a.target=123;
  assert.ok(aimManualFire(g,9,2.5));assert.deepEqual(a.path,[]);assert.equal(a.target,null);
  const start=a.x;run(g,400);assert.equal(a.x,start);assert.ok(a.ammo>=0&&a.ammo<=a.magazine);assert.ok(g.events.filter(e=>e.type==='shot').length>a.magazine);
  g.manualAim=null;const ammo=a.ammo;run(g,10);assert.equal(a.ammo,ammo);
  aimManualFire(g,9,2.5);orderMove(g,3.5,2.5);assert.equal(g.manualAim,null);
});

test('maps require 2 through 7 distinct reachable captures and one extraction; locked nodes do not progress',()=>{
  for(let i=0;i<MISSIONS.length;i++){
    const g=createGame(undefined,undefined,i),keys=captureKeys(g),points=objectiveKeys(g).map(k=>g[k]);
    assert.equal(keys.length,i+2);assert.equal(objectiveKeys(g).filter(k=>k==='exit').length,1);
    assert.equal(new Set(points.map(p=>`${p.x},${p.y}`)).size,points.length);
    for(const p of points){assert.ok(walkable(g.world,p.x,p.y));assert.ok(findPath(g.world,g.agents[0],p).length);}
    startGame(g);g.guards=[];
    if(g.captureKeys.length){const p=g[g.captureKeys[0]];g.agents.forEach(a=>Object.assign(a,{x:p.x,y:p.y}));run(g,150);assert.equal(p.progress,0);}
    assert.equal(capturesComplete(g),false);assert.equal(currentObjectiveKey(g),'relay');
    keys.forEach(k=>{g[k].done=true;});
    g[keys.at(-1)].done=false;g.agents.forEach(a=>Object.assign(a,{x:g.exit.x,y:g.exit.y}));run(g,90);
    assert.equal(g.phase,'active');assert.equal(g.extraction,0);
    if(g.courier){g.courier.active=true;Object.assign(g.courier,{x:g.exit.x,y:g.exit.y});}
    g[keys.at(-1)].done=true;run(g,61);assert.equal(g.phase,'won');
  }
});

test('extra captures require uninterrupted occupation and respect pause; courier release is last',()=>{
  const g=createGame(undefined,undefined,4);startGame(g);g.guards=[];g.relay.done=true;
  assert.equal(captureKeys(g).at(-1),'vault');
  const key=currentObjectiveKey(g),p=g[key];g.agents.forEach(a=>Object.assign(a,{x:p.x,y:p.y,path:[]}));
  run(g,30);assert.ok(p.progress>0);assert.equal(g.courier.active,false);
  g.paused=true;const progress=p.progress;run(g,30);assert.equal(p.progress,progress);
  g.paused=false;g.agents.forEach(a=>{a.x=g.exit.x;a.y=g.exit.y;});run(g,30);assert.ok(p.progress<progress);
  g.agents.forEach(a=>{a.x=p.x;a.y=p.y;});run(g,150);assert.equal(p.progress,objectiveDuration(g,key));assert.ok(p.done);
});

test('reserve patch economy accepts legacy saves, enforces spending, stock limits and persistent consumption',()=>{
  const c=createCampaign(),legacy={...c};delete legacy.patchesBought;delete legacy.patchesUsed;
  assert.deepEqual(decodeCampaign(JSON.stringify(legacy)),c);
  assert.ok(buyPatch(c));assert.equal(c.cash,6000-PATCH_COST);assert.equal(reservePatches(c),1);
  const g=createGame(undefined,c);startGame(g);assert.equal(g.medkits,3);
  for(let i=0;i<3;i++){g.agents[0].hp=1;const before=g.reserveMedkits;assert.ok(medkit(g));c.patchesUsed+=before-g.reserveMedkits;}
  assert.equal(g.medkits,0);assert.equal(reservePatches(c),0);assert.equal(createGame(undefined,c).medkits,2);
  assert.deepEqual(decodeCampaign(JSON.stringify(c)),c);
  for(const bad of [{patchesUsed:2},{patchesBought:-1},{patchesBought:1.1},{cash:c.cash+250},{patchesUsed:NaN}])assert.equal(decodeCampaign(JSON.stringify({...c,...bad})),null);
  const full=createCampaign();for(let i=0;i<MAX_RESERVE_PATCHES;i++)assert.ok(buyPatch(full));assert.equal(buyPatch(full),false);
  full.cash=0;full.patchesUsed++;assert.equal(buyPatch(full),false);
});

test('four camera angles preserve ground picking, screen-relative panning, bounds and simulation state',()=>{
  globalThis.devicePixelRatio=1;const g=createGame(),model=modelCanvas({capture:true}),r=new Renderer(model.canvas,g),snapshot=JSON.stringify(g);
  for(let turn=0;turn<4;turn++){
    r.render(g,null);assert.equal(r.turn,turn);
    for(const [x,y] of [[0,0],[35.5,35.5],[4.5,29.5],[10.125,18.875]]){const p=r.project(x,y),world=r.unproject(p.x,p.y);assert.ok(Math.abs(world.x-x)<1e-12&&Math.abs(world.y-y)<1e-12);}
    r.focus({x:18,y:18},true);const before=r.project(18,18);r.pan(40,20);const after=r.project(18,18);assert.ok(Math.abs(before.x-after.x-40)<1e-9&&Math.abs(before.y-after.y-20)<1e-9);
    r.pan(1e8,-1e8);assert.ok(r.camera.x>=-2&&r.camera.x<=38&&r.camera.y>=-2&&r.camera.y<=38);r.focus({x:18,y:18},true);r.rotate(1);
  }
  assert.equal(r.turn,0);assert.equal(JSON.stringify(g),snapshot);r.dispose();assert.equal(model.liveBuffers(),0);assert.equal(model.liveVaos(),0);
});

test('dirty uploads preserve exact bytes after growth, shrink, equal frames and a write-then-throw failure',()=>{
  globalThis.devicePixelRatio=1;const g=createGame(),model=modelCanvas({capture:true}),r=new Renderer(model.canvas,g);
  r.render(g,null);const bytes=model.stats.uploadedBytes;r.geometryKey=null;r.render(g,null);assert.equal(model.stats.uploadedBytes,bytes);
  assert.equal(r.stats.objectiveBuilds,1);assert.equal(r.stats.objectiveHits,1);
  const original=model.gl.bufferSubData;
  model.gl.bufferSubData=(...args)=>{original(...args);throw Error('after-write');};g.time=1;assert.throws(()=>r.render(g,null),/after-write/);
  model.gl.bufferSubData=original;g.time=0;model.draws.length=0;r.render(g,null);
  const freshModel=modelCanvas({capture:true}),fresh=new Renderer(freshModel.canvas,g);fresh.render(g,null);
  assert.deepEqual(model.draws,freshModel.draws);r.dispose();fresh.dispose();
});
