// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {Renderer,writeActor,actorVertexCount,actorCacheStats,ACTOR_TEMPLATE_BYTES} from '../src/renderer.js';
import {Renderer as Reference} from '../scripts/visual-polish-reference.mjs';
import {createGame} from '../src/simulation.js';
import {modelCanvas} from '../scripts/performance-render-model.mjs';

globalThis.devicePixelRatio=1;
class Target {
  data=new Float32Array(8);length=0;
  reserve(count){if(this.length+count<=this.data.length)return;let size=this.data.length;while(size<this.length+count)size*=2;const next=new Float32Array(size);next.set(this.data);this.data=next;}
  view(){return this.data.slice(0,this.length);}
}
function actor(unit,{time=.2,alpha=.5,x=5,y=7,asCourier=false}={}) {
  const mesh=new Target();writeActor(mesh,unit,x,y,time,alpha,asCourier);return mesh.view();
}
const unit=(team='guard',extra={})=>({team,id:100,enemyType:'guard',path:[],fear:0,stun:0,active:false,...extra});
const variants=[...Array.from({length:4},(_,id)=>unit('agent',{id})),
  ...['guard','bulwark','marksman'].flatMap(enemyType=>[{}, {fear:1}, {stun:1}].map(state=>unit('guard',{enemyType,...state}))),
  unit('courier'),unit('courier',{active:true})];

test('actor templates compile lazily into finite shape/material slots and stay below old vertex budgets',()=>{
  assert.deepEqual(actorCacheStats(),{shapes:0,variants:0,retainedBytes:0,maximumShapes:4,maximumVariants:15,maximumTypedBytes:ACTOR_TEMPLATE_BYTES});
  const model=modelCanvas(),renderer=new Renderer(model.canvas,createGame());
  assert.equal(actorCacheStats().variants,0,'constructing an unseen city must not build every actor template');renderer.dispose();
  for(const state of variants){
    const values=actor(state),oldBudget=state.team==='courier'?300:state.enemyType==='bulwark'?354:state.enemyType==='marksman'?336:300;
    assert.equal(values.length,actorVertexCount(state)*7);assert.ok(values.length/7<oldBudget);
    assert.ok(values.every(Number.isFinite));
  }
  const warmed=actorCacheStats();assert.equal(warmed.shapes,4);assert.equal(warmed.variants,15);assert.ok(warmed.retainedBytes<=ACTOR_TEMPLATE_BYTES);
  for(let id=4;id<200;id++)actor(unit('agent',{id}));
  for(let id=0;id<100;id++)actor(unit('guard',{id,enemyType:`unknown-${id}`,fear:id%2,stun:1}));
  assert.deepEqual(actorCacheStats(),warmed,'arbitrary identities do not create historical or unbounded template slots');
});

test('idle geometry is stable, walking articulates finite feet above the street, and caller buffers own their data',()=>{
  for(const state of variants){
    const saved=structuredClone(state),idle=actor(state,{time:0}),later=actor(state,{time:17});
    assert.deepEqual(later,idle,'an idle pose has no clock-dependent animation');
    state.active=true;state.path=[{x:9,y:7}];
    const moving=actor(state,{time:.35});assert.notDeepEqual(moving,idle);
    for(let frame=0;frame<30;frame++){
      const values=actor(state,{time:frame/30,alpha:frame%2});
      for(let i=0;i<values.length;i+=7){assert.ok(Number.isFinite(values[i])&&Number.isFinite(values[i+1])&&Number.isFinite(values[i+2]));assert.ok(values[i+2]>=.009,'articulated boots must remain above the .01 street plane within Float32 precision');}
    }
    Object.assign(state,saved);const first=actor(state);first.fill(999);
    assert.deepEqual(actor(state),idle,'writes into a caller-owned mesh cannot corrupt shared templates');
  }
});

test('agent accents, specialist silhouettes and fear/stun materials remain distinct',()=>{
  const accents=Array.from({length:4},(_,id)=>actor(unit('agent',{id})));
  for(let i=1;i<accents.length;i++)assert.notDeepEqual(accents[i],accents[0]);
  const normal=actor(unit()),fear=actor(unit('guard',{fear:1})),stun=actor(unit('guard',{stun:1}));
  assert.notDeepEqual(normal,fear);assert.notDeepEqual(normal,stun);assert.notDeepEqual(fear,stun);
  assert.notDeepEqual(actor(unit('guard',{enemyType:'bulwark'})),normal);
  assert.notDeepEqual(actor(unit('guard',{enemyType:'marksman'})),normal);
  assert.notDeepEqual(actor(unit('courier')),actor(unit('courier',{active:true})));
});

test('courier identity and cache reuse stay consistent after incidental record metadata changes',()=>{
  const game=createGame(undefined,undefined,4),model=modelCanvas({capture:true}),renderer=new Renderer(model.canvas,game);
  game.courier.active=true;game.courier.path=[{x:3,y:3}];game.time=.1;
  const frame=()=>{model.draws.length=0;renderer.render(game,null,.5);return model.draws.map(({values,count})=>({values,count}));};
  const first=frame();game.courier.team='agent';game.courier.id=301;game.courier.enemyType='marksman';game.courier.fear=1;
  const cached=frame();renderer.geometryKey=null;const fresh=frame();
  assert.deepEqual(cached,fresh);assert.deepEqual(fresh,first,'the known courier branch keeps its courier model and fixed gait identity');
  renderer.dispose();
});

test('dead agents and couriers retain the original eighteen-vertex corpse geometry',()=>{
  const game=createGame(undefined,undefined,4);game.agents.forEach(a=>{a.hp=0;});game.guards=[];game.courier.hp=0;game.captureKeys=[];
  const captures=[];
  for(const Implementation of [Reference,Renderer]){
    const model=modelCanvas({capture:true}),renderer=new Implementation(model.canvas,game);renderer.render(game,null,1);
    captures.push(model.draws);renderer.dispose();
  }
  assert.deepEqual(captures[1],captures[0]);
});
