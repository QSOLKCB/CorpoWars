// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {Renderer} from '../src/renderer.js';
import {createGame,startGame} from '../src/simulation.js';
import {modelCanvas} from '../scripts/performance-render-model.mjs';

globalThis.devicePixelRatio=2;
function fixture() {
  const game=createGame(),model=modelCanvas({capture:true}),renderer=new Renderer(model.canvas,game);
  startGame(game);game.paused=true;
  return {game,model,renderer,render:(hover=null,alpha=1)=>{model.draws.length=0;renderer.render(game,hover,alpha);return model.draws;}};
}
function dynamic(draws) {return draws.slice(-2).map(d=>({count:d.count,values:d.values}));}

test('paused geometry survives camera, zoom, cutaway and resolution changes without uploads',()=>{
  const {game,model,renderer,render}=fixture();
  const first=dynamic(render()),uploaded=model.stats.uploadedBytes,attributes=model.stats.attributeCalls;
  renderer.pan(80,40);renderer.zoomBy(1.2);renderer.cutaway=true;renderer.pixelRatio=1;
  model.rect.width=900;model.rect.height=500;
  const draws=render();
  assert.deepEqual(dynamic(draws),first);assert.equal(draws.length,3);
  assert.equal(model.stats.uploadedBytes,uploaded);assert.equal(model.stats.attributeCalls,attributes);
  assert.deepEqual(draws[0].uniforms.u_resolution,[900,500]);assert.equal(model.canvas.width,900);
  assert.equal(renderer.stats.geometryBuilds,1);assert.equal(renderer.stats.geometryHits,1);
  const point={x:game.agents[0].x,y:game.agents[0].y},screen=renderer.project(point.x,point.y),world=renderer.unproject(screen.x,screen.y);
  assert.ok(Math.abs(world.x-point.x)<1e-12&&Math.abs(world.y-point.y)<1e-12);
  renderer.dispose();assert.equal(model.liveBuffers(),0);assert.equal(model.liveVaos(),0);
});

test('same-tick orders, objective gates, health, selection, effects and interpolation invalidate reuse',()=>{
  const {game,renderer,render}=fixture();render();let builds=1;
  const changes=[
    ()=>{game.agents[0].path=[{x:10.5,y:10.5}];},
    ()=>{game.selected.delete(0);},
    ()=>{game.agents[1].hp-=10;},
    ()=>{game.agents[1].prevX-=.25;},
    ()=>{game.relay.done=true;},
    ()=>{game.vault.done=true;},
    ()=>{game.exit.x+=1;},
    ()=>{game.effects.push({type:'shot',x:1,y:2,tx:3,ty:4,life:.1,maxLife:.2,team:'agent'});},
    ()=>{game.effects[0].weapon='shotgun';},
    ()=>{game.effects[0].life=.05;},
    ()=>{game.effects[0].tx=5;},
    ()=>{game.phase='won';},
  ];
  for(const change of changes){change();render();assert.equal(renderer.stats.geometryBuilds,++builds);render();assert.equal(renderer.stats.geometryBuilds,builds);}
  render(null,.5);assert.equal(renderer.stats.geometryBuilds,++builds);
  // Hover is quantised to the tile that is actually drawn.
  game.phase='active';render({x:2.1,y:3.2});builds++;
  render({x:2.9,y:3.8});assert.equal(renderer.stats.geometryBuilds,builds);
  render({x:3.1,y:3.2});assert.equal(renderer.stats.geometryBuilds,++builds);
  renderer.makeCity(game.world);render();assert.equal(renderer.stats.geometryBuilds,++builds);
  renderer.dispose();
});

test('guard visibility, fear, stun and death affect cached geometry at unchanged game time',()=>{
  const {game,renderer,render}=fixture();game.world.blocked.fill(0);
  const guard=game.guards[0];guard.x=game.agents[0].x+1;guard.y=game.agents[0].y;guard.prevX=guard.x;guard.prevY=guard.y;
  render();let builds=1;
  for(const change of [()=>{guard.fear=1;},()=>{guard.fear=0;guard.stun=1;},()=>{guard.hp=0;},()=>{guard.hp=guard.maxHp;},()=>{guard.x=100;guard.y=100;}]) {
    change();render();assert.equal(renderer.stats.geometryBuilds,++builds);
  }
  renderer.dispose();
});

test('retained buffers grow, shrink and draw empty overlays without stale tails',()=>{
  const {game,model,renderer,render}=fixture();render();
  game.effects=Array.from({length:700},(_,i)=>({type:'panic',x:i%36,y:Math.floor(i/36),life:.5,maxLife:1}));
  const large=dynamic(render()),capacity=renderer.overlayBytes,allocations=model.stats.storageCalls;
  assert.ok(capacity>262144);assert.ok(large[1].count>100000);
  game.effects=[];game.selected.clear();game.relay.done=true;game.vault.done=true;game.agents.forEach(a=>{a.hp=a.maxHp;});
  game.guards=[];game.phase='won';
  const small=dynamic(render());assert.equal(small[1].count,192);assert.ok(small[1].values.length<large[1].values.length);
  assert.equal(model.stats.storageCalls,allocations);assert.equal(renderer.overlayBytes,capacity);
  const uploaded=model.stats.uploadedBytes;render();assert.equal(model.stats.uploadedBytes,uploaded);
  renderer.overlay.reset();renderer.uploadMesh(renderer.overlay,renderer.overlayBuffer,'overlayBytes');
  model.draws.length=0;renderer.buffer(renderer.overlayBuffer,0);assert.equal(model.draws[0].values.length,0);assert.equal(model.stats.uploadedBytes,uploaded);
  renderer.dispose();
});

test('failed upload never publishes a partial generation, including a return to the old inputs',()=>{
  const {game,model,renderer,render}=fixture();const first=dynamic(render());
  const original=model.gl.bufferSubData;let calls=0;
  model.gl.bufferSubData=function(...args){if(++calls===2)throw new Error('injected upload failure');return original.apply(this,args);};
  game.agents[0].hp-=10;game.time=1;assert.throws(()=>render(),/injected upload failure/);
  model.gl.bufferSubData=original;game.agents[0].hp+=10;game.time=0;
  assert.deepEqual(dynamic(render()),first);assert.equal(renderer.stats.geometryBuilds,2);
  renderer.dispose();
});

test('non-finite render inputs fail before publishing a cached generation',()=>{
  const {game,renderer,render}=fixture();render();const builds=renderer.stats.geometryBuilds;
  game.agents[0].x=NaN;assert.throws(()=>render(),/non-finite render input/);assert.equal(renderer.stats.geometryBuilds,builds);
  renderer.dispose();
});
