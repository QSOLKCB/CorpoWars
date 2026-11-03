// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {Renderer} from '../src/renderer.js';
import {createGame,startGame} from '../src/simulation.js';
import {modelCanvas} from '../scripts/performance-render-model.mjs';

globalThis.devicePixelRatio=1;
function fixture() {
  const game=createGame(),model=modelCanvas({capture:true});startGame(game);game.paused=true;
  const renderer=new Renderer(model.canvas,game);
  const render=(alpha=1)=>{model.draws.length=0;renderer.render(game,null,alpha);return model.draws.map(draw=>({count:draw.count,values:draw.values}));};
  return {game,model,renderer,render};
}
const digest=values=>createHash('sha256').update(new Uint8Array(values.buffer,values.byteOffset,values.byteLength)).digest('hex');
function matchesFresh(f) {
  const reused=f.render();f.renderer.geometryKey=null;
  assert.deepEqual(f.render(),reused,'retained frame must equal forced fresh geometry');
}

test('each expansion district has a distinct static palette and original rooftop silhouette',()=>{
  const f=fixture(),original=f.render(),legacy=original.slice(0,2).map(draw=>digest(draw.values)),variants=[];
  for(const theme of ['copperline','coldstore','exchange']) {
    f.game.world.theme=theme;f.renderer.makeCity(f.game.world);
    const draws=f.render();variants.push(draws.slice(0,2).map(draw=>digest(draw.values)));
    assert.ok(draws[1].count>original[1].count,'district rooftop equipment adds visible static geometry');
    assert.ok(draws.every(draw=>draw.values.every(Number.isFinite)));
    assert.notDeepEqual(variants.at(-1),legacy);
  }
  assert.equal(new Set(variants.map(value=>value.join('/'))).size,3);
  delete f.game.world.theme;f.renderer.makeCity(f.game.world);
  assert.deepEqual(f.render().slice(0,2).map(draw=>digest(draw.values)),legacy,'returning to an original district restores its exact static stream');
  f.renderer.dispose();
});

test('visible specialist silhouettes and colours invalidate reuse without a simulation tick',()=>{
  const f=fixture();f.game.world.blocked.fill(0);
  const guard=f.game.guards[0];guard.x=f.game.agents[0].x+1;guard.y=f.game.agents[0].y;guard.prevX=guard.x;guard.prevY=guard.y;
  guard.enemyType='guard';const normal=f.render(),time=f.game.time;
  guard.enemyType='bulwark';const bulwark=f.render();assert.notDeepEqual(bulwark,normal);matchesFresh(f);
  guard.enemyType='marksman';const marksman=f.render();assert.notDeepEqual(marksman,normal);assert.notDeepEqual(marksman,bulwark);matchesFresh(f);
  guard.fear=1;const feared=f.render();guard.stun=1;guard.fear=0;assert.notDeepEqual(f.render(),feared);matchesFresh(f);
  guard.enemyType='guard';guard.stun=0;assert.deepEqual(f.render(),normal);
  assert.equal(f.game.time,time);f.renderer.dispose();
});

test('hidden specialists add no silhouettes or reveal markers',()=>{
  const f=fixture(),guard=f.game.guards[0];guard.x=100;guard.y=100;guard.prevX=100;guard.prevY=100;
  const normal=f.render(),uploads=f.model.stats.uploadedBytes;
  guard.enemyType='marksman';assert.deepEqual(f.render(),normal);assert.equal(f.model.stats.uploadedBytes,uploads);
  guard.enemyType='bulwark';assert.deepEqual(f.render(),normal);assert.equal(f.model.stats.uploadedBytes,uploads);
  f.renderer.dispose();
});

test('courier activation, health, movement, interpolation and removal rebuild exact live geometry',()=>{
  const f=fixture(),without=f.render();
  f.game.courier={id:300,team:'courier',x:12,y:20,prevX:12,prevY:20,hp:120,maxHp:120,active:false,path:[]};
  let previous=f.render();assert.notDeepEqual(previous,without);matchesFresh(f);
  const courier=f.game.courier;
  for(const change of [()=>{courier.active=true;},()=>{courier.hp=70;},()=>{courier.prevX=11;courier.x=12.5;},()=>{courier.path=[{x:13.5,y:20}];},()=>{courier.maxHp=150;},()=>{courier.hp=0;}]) {
    change();const changed=f.render();assert.notDeepEqual(changed,previous);matchesFresh(f);previous=changed;
  }
  courier.hp=70;const atStart=f.render(0),atEnd=f.render(1);assert.notDeepEqual(atStart,atEnd);
  delete f.game.courier;assert.deepEqual(f.render(),without,'removed courier must not leave stale vertices in the retained buffers');
  f.renderer.dispose();assert.equal(f.model.liveBuffers(),0);assert.equal(f.model.liveVaos(),0);
});

test('hold-zone contour reflects contest, relay gating and completion at unchanged time',()=>{
  const f=fixture();f.game.mission={...f.game.mission,kind:'hold'};f.game.holdContested=false;
  const locked=f.render();f.game.relay.done=true;const open=f.render();assert.notDeepEqual(open,locked);matchesFresh(f);
  f.game.holdContested=true;assert.notDeepEqual(f.render(),open);matchesFresh(f);
  f.game.vault.done=true;const complete=f.render();f.game.holdContested=false;
  assert.deepEqual(f.render(),complete,'completed zone contour is absent regardless of old contest flag');
  f.renderer.dispose();
});

test('all new district scenes render finite live data through resize, cutaway and renderer recreation',()=>{
  for(let mission=3;mission<6;mission++) {
    const game=createGame(undefined,undefined,mission),model=modelCanvas({capture:true}),renderer=new Renderer(model.canvas,game);
    assert.equal(game.world.layout,mission);
    renderer.render(game,null,1);const first=model.draws.splice(0).map(({values,count})=>({values,count})),uploads=model.stats.uploadedBytes;
    model.rect.width=760;model.rect.height=440;renderer.zoomBy(1.2);renderer.cutaway=true;renderer.render(game,null,1);
    assert.equal(model.stats.uploadedBytes,uploads,'projection changes must retain new scene geometry');
    assert.ok(model.draws.every(draw=>draw.values.every(Number.isFinite)));
    renderer.dispose();assert.equal(model.liveBuffers(),0);assert.equal(model.liveVaos(),0);
    const replacement=new Renderer(model.canvas,game);model.draws.length=0;replacement.render(game,null,1);
    assert.deepEqual(model.draws.map(({values,count})=>({values,count})),first,'recreated resources must rebuild the same complete new scene');
    replacement.dispose();assert.equal(model.liveBuffers(),0);assert.equal(model.liveVaos(),0);
  }
});
