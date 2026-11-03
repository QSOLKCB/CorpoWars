// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {cpus,platform,arch} from 'node:os';
import {pathToFileURL} from 'node:url';
import {Renderer as BaselineRenderer} from './performance-render-reference.mjs';
import {Renderer} from '../src/renderer.js';
import {modelCanvas} from './performance-render-model.mjs';
import {renderFixture,WORKLOADS,FRAME_COUNT} from './performance-render-fixtures.mjs';

// The actor bodies/shadows intentionally change in v0.4.1. Keep the frozen
// v0.3 baseline for every untouched city/tactical stream, without hiding the
// actual actors from the timed or counted workloads.
function preservedStreams(draws,game,hover) {
  let prefix=648+(game.mission.kind==='hold'&&!game.vault.done?192:0);
  for(const a of game.agents)if(a.hp>0&&game.selected.has(a.id))prefix+=192+a.path.length*6;
  const suffix=324+game.effects.filter(e=>e.type==='shot').length*24+(hover&&game.phase==='active'?192:0);
  return draws.map((draw,index)=>{
    if(index!==draws.length-2)return draw;
    const {count,values,...state}=draw;
    assert.ok(count>=prefix+suffix,'actor body span must fit between tactical prefix and effects suffix');
    return {...state,scope:'non-actor-scene',prefix:values.subarray(0,prefix*7),suffix:values.subarray(values.length-suffix*7)};
  });
}

export function runRendererWorkload(name,Implementation,{capture=false}={}) {
  globalThis.devicePixelRatio=1.5;
  const model=modelCanvas({capture}),fixture=renderFixture(name),renderer=new Implementation(model.canvas,fixture.game);
  const frames=[];
  for(let index=0;index<FRAME_COUNT;index++){
    fixture.frame(index,renderer,model);
    if(capture)frames.push(preservedStreams(model.draws.splice(0),fixture.game,name!=='briefing-camera'));
  }
  const counts={frames:FRAME_COUNT,...model.stats,retainedBytes:model.retainedBytes(),
    geometryBuilds:renderer.stats?.geometryBuilds??FRAME_COUNT,geometryHits:renderer.stats?.geometryHits??0};
  renderer.dispose();
  assert.equal(model.liveBuffers(),0,'dispose releases every GPU buffer');
  assert.equal(model.liveVaos(),0,'dispose releases every VAO');
  return {counts,frames};
}

export function rendererParity(name) {
  const baseline=runRendererWorkload(name,BaselineRenderer,{capture:true});
  const optimized=runRendererWorkload(name,Renderer,{capture:true});
  assert.deepEqual(optimized.frames,baseline.frames,`${name}: static city, routes, selection, overlays, traffic, effects, hover, camera and depth state must match`);
  const digest=createHash('sha256');
  for(const frame of optimized.frames)for(const draw of frame){
    const {values,prefix,suffix,...state}=draw;digest.update(JSON.stringify(state));
    for(const data of values?[values]:[prefix,suffix])digest.update(new Uint8Array(data.buffer,data.byteOffset,data.byteLength));
  }
  return {name,parityScope:'all non-actor geometry and draw state; actor bodies/shadows intentionally excluded',unchangedOutputSha256:digest.digest('hex'),baseline:baseline.counts,optimized:optimized.counts};
}

const median=values=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)];
export function rendererEvidence() {
  const workloads=WORKLOADS.map(name=>{
    const parity=rendererParity(name);
    for(let pair=0;pair<2;pair++){runRendererWorkload(name,BaselineRenderer);runRendererWorkload(name,Renderer);}
    const samples={baseline:[],optimized:[]};
    for(let pair=0;pair<7;pair++)for(const optimized of pair%2?[true,false]:[false,true]){
      const start=performance.now();runRendererWorkload(name,optimized?Renderer:BaselineRenderer);
      samples[optimized?'optimized':'baseline'].push(performance.now()-start);
    }
    assert.ok(parity.optimized.attributeCalls<parity.baseline.attributeCalls,'VAOs reduce repeated attribute setup');
    assert.ok(parity.optimized.uploadedBytes<=parity.baseline.uploadedBytes,'reuse must not increase uploaded values');
    if(name==='briefing-camera'||name==='paused-orders')assert.ok(parity.optimized.uploadedBytes<parity.baseline.uploadedBytes,'unchanged effective input must reuse uploads');
    return {...parity,samplesMs:samples,medianMs:{baseline:median(samples.baseline),optimized:median(samples.optimized)}};
  });
  return {schemaVersion:1,baseline:'QSOLKCB/CorpoWars@54a4b1bc1d24195092be2c1e8f056a2eb3730057',
    donor:'QSOLKCB/VANILLAJS retained-capacity/exact-render-input reuse patterns',
    environment:{runtime:process.version,platform:platform(),arch:arch(),cpu:cpus()[0]?.model},
    protocol:{frames:FRAME_COUNT,warmupPairs:2,measuredPairs:7,order:'alternating',timingGate:false,
      scope:'Cold renderer construction plus CPU geometry/signatures/Float32 model copies. Excludes GPU/driver, browser layout, full game frame rate and memory measurement.',
      metrics:'Timings/work counts include full actor scenes. uploadCalls/uploadedBytes count bufferSubData only. storageCalls/storageBytes include static city bufferData calls. retainedBytes is modeled capacity, not driver memory. Exact parity covers static draws, main prefix/suffix and entire overlays; only character body/shadow geometry is intentionally excluded.'},workloads};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(JSON.stringify(rendererEvidence(),null,2));
