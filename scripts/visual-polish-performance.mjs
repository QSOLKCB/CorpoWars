// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {cpus,platform,arch} from 'node:os';
import {pathToFileURL} from 'node:url';
import {Renderer as Reference} from './visual-polish-reference.mjs';
import {Renderer} from '../src/renderer.js';
import {modelCanvas} from './performance-render-model.mjs';
import {polishFixture,WORKLOADS,FRAME_COUNT} from './visual-polish-fixtures.mjs';

function surface(Implementation,name,{capture=false}={}) {
  const model=modelCanvas({capture}),fixture=polishFixture(name),renderer=new Implementation(model.canvas,fixture.game);
  const original=model.gl.drawArrays.bind(model.gl);
  const vertices={total:0,current:0,peak:0,dynamic:0};
  model.gl.drawArrays=(mode,start,count)=>{vertices.total+=count;vertices.current+=count;original(mode,start,count);};
  return {model,fixture,renderer,vertices};
}
function draw(state,index,{pure=false}={}) {
  const {fixture,renderer,model,vertices}=state,frame=fixture.step(index,renderer,model);
  const before=pure?structuredClone(fixture.game):null;
  vertices.current=0;
  renderer.render(fixture.game,frame.hover,frame.alpha,frame.delta);
  state.frame=frame;
  vertices.peak=Math.max(vertices.peak,vertices.current);
  const staticVertices=renderer.groundCount+(renderer.cutaway?0:renderer.cityCount);
  vertices.dynamic+=vertices.current-staticVertices;
  if(pure)assert.deepEqual(fixture.game,before,`${fixture.game.mission.id}/${index}: rendering must not mutate simulation or inputs`);
  return vertices.current-staticVertices;
}
function counts(state) {
  return {frames:FRAME_COUNT,...state.model.stats,retainedBytes:state.model.retainedBytes(),
    totalLiveVertices:state.vertices.total,dynamicLiveVertices:state.vertices.dynamic,peakFrameVertices:state.vertices.peak,
    geometryBuilds:state.renderer.stats.geometryBuilds,geometryHits:state.renderer.stats.geometryHits};
}
function dispose(state) {
  state.renderer.dispose();assert.equal(state.model.liveBuffers(),0);assert.equal(state.model.liveVaos(),0);
}
export function runPolishWorkload(name,Implementation) {
  globalThis.devicePixelRatio=1.5;
  const state=surface(Implementation,name);
  for(let i=0;i<FRAME_COUNT;i++)draw(state,i);
  const result=counts(state);dispose(state);return result;
}

export function polishBudget(name) {
  globalThis.devicePixelRatio=1.5;
  const baseline=surface(Reference,name,{capture:true}),candidate=surface(Renderer,name,{capture:true});
  const staticDigest=createHash('sha256'),overlayDigest=createHash('sha256');
  let strictlyFewerDynamicFrames=0;
  for(let index=0;index<FRAME_COUNT;index++) {
    const oldDynamic=draw(baseline,index,{pure:true}),newDynamic=draw(candidate,index,{pure:true});
    assert.ok(newDynamic<=oldDynamic,`${name}/${index}: actor polish must not increase live dynamic vertices`);
    if(newDynamic<oldDynamic)strictlyFewerDynamicFrames++;
    const a=baseline.model.draws.splice(0),b=candidate.model.draws.splice(0);
    assert.equal(b.length,a.length,`${name}/${index}: no additional rendering pass or draw`);
    const staticCount=baseline.renderer.cutaway?1:2;
    assert.deepEqual(b.slice(0,staticCount),a.slice(0,staticCount),`${name}/${index}: static city must remain exact`);
    assert.deepEqual(b.at(-1),a.at(-1),`${name}/${index}: tactical overlays must remain exact`);
    const game=baseline.fixture.game,oldMain=a.at(-2).values,newMain=b.at(-2).values;
    let prefix=648+(game.mission.kind==='hold'&&!game.vault.done?192:0);
    for(const unit of game.agents)if(unit.hp>0&&game.selected.has(unit.id))prefix+=192+unit.path.length*6;
    const suffix=324+game.effects.filter(e=>e.type==='shot').length*24+(baseline.frame.hover&&game.phase==='active'?192:0);
    assert.deepEqual(newMain.subarray(0,prefix*7),oldMain.subarray(0,prefix*7),`${name}/${index}: objectives, selected-unit rings and routes must remain exact`);
    assert.deepEqual(newMain.subarray(newMain.length-suffix*7),oldMain.subarray(oldMain.length-suffix*7),`${name}/${index}: traffic, shots and hover geometry must remain exact`);
    for(let draw=0;draw<a.length;draw++) {
      const {values:oldValues,count:oldCount,...oldState}=a[draw],{values:newValues,count:newCount,...newState}=b[draw];
      assert.deepEqual(newState,oldState,`${name}/${index}: draw uniforms, depth and primitive state must remain exact`);
    }
    for(const draw of b.slice(0,staticCount))staticDigest.update(new Uint8Array(draw.values.buffer,draw.values.byteOffset,draw.values.byteLength));
    const overlay=b.at(-1);overlayDigest.update(new Uint8Array(overlay.values.buffer,overlay.values.byteOffset,overlay.values.byteLength));
    for(const [x,y,z]of [[0,0,0],[12.5,20.5,.65],[35.5,35.5,1.5]])assert.deepEqual(candidate.renderer.project(x,y,z),baseline.renderer.project(x,y,z),'camera projection and click targets remain exact');
    for(const [x,y]of [[0,0],[640,360],[1000,800]])assert.deepEqual(candidate.renderer.unproject(x,y),baseline.renderer.unproject(x,y),'ground picking remains exact');
  }
  const before=counts(baseline),after=counts(candidate);
  for(const key of ['storageCalls','storageBytes','uploadCalls','uploadedBytes','attributeCalls','retainedBytes','totalLiveVertices','dynamicLiveVertices','peakFrameVertices'])assert.ok(after[key]<=before[key],`${name}: ${key} exceeds v0.4 budget (${after[key]} > ${before[key]})`);
  for(const key of ['drawCalls','geometryBuilds','geometryHits'])assert.equal(after[key],before[key],`${name}: ${key} must retain the same work schedule`);
  assert.ok(strictlyFewerDynamicFrames>0,`${name}: fewer dynamic vertices must pay for the visual changes`);
  dispose(baseline);dispose(candidate);
  return {name,baseline:before,polished:after,strictlyFewerDynamicFrames,
    staticOutputSha256:staticDigest.digest('hex'),overlayOutputSha256:overlayDigest.digest('hex')};
}

const median=values=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)];
const hashFile=path=>createHash('sha256').update(readFileSync(new URL(path,import.meta.url))).digest('hex');
// Each observation uses a fresh JS process. The clock starts before importing
// either renderer or the common fixture/model modules, so finite template
// initialization and first render are included. OS/process creation is excluded.
function coldObservation(name,polished) {
  const rendererUrl=new URL(polished?'../src/renderer.js':'./visual-polish-reference.mjs',import.meta.url).href;
  const fixturesUrl=new URL('./visual-polish-fixtures.mjs',import.meta.url).href;
  const modelUrl=new URL('./performance-render-model.mjs',import.meta.url).href;
  const source=`import {performance} from 'node:perf_hooks';
const start=performance.now();
const {Renderer}=await import(${JSON.stringify(rendererUrl)});
const {polishFixture}=await import(${JSON.stringify(fixturesUrl)});
const {modelCanvas}=await import(${JSON.stringify(modelUrl)});
globalThis.devicePixelRatio=1.5;
const model=modelCanvas(),fixture=polishFixture(${JSON.stringify(name)}),renderer=new Renderer(model.canvas,fixture.game);
let vertices=0;const draw=model.gl.drawArrays.bind(model.gl);
model.gl.drawArrays=(mode,first,count)=>{vertices+=count;draw(mode,first,count);};
const frame=fixture.step(0,renderer,model);renderer.render(fixture.game,frame.hover,frame.alpha,frame.delta);
const milliseconds=performance.now()-start;
const counts={...model.stats,retainedBytes:model.retainedBytes(),liveVertices:vertices};
renderer.dispose();
if(model.liveBuffers()||model.liveVaos())throw Error('cold renderer leaked GPU model resources');
console.log(JSON.stringify({milliseconds,counts}));`;
  return JSON.parse(execFileSync(process.execPath,['--input-type=module','--eval',source],{encoding:'utf8',maxBuffer:1024*1024}));
}
export function coldPolishEvidence() {
  return ['breakwater-briefing','specialist-stress'].map(name=>{
    const samples={baseline:[],polished:[]};let counts;
    for(let pair=0;pair<9;pair++) {
      const observed={};
      for(const polished of pair%2?[true,false]:[false,true]) {
        const key=polished?'polished':'baseline';observed[key]=coldObservation(name,polished);
        if(pair>=2)samples[key].push(observed[key].milliseconds);
      }
      counts={baseline:observed.baseline.counts,polished:observed.polished.counts};
      for(const key of Object.keys(counts.baseline))assert.ok(counts.polished[key]<=counts.baseline[key],`${name}: cold ${key} exceeds baseline`);
    }
    return {name,samplesMs:samples,medianMs:{baseline:median(samples.baseline),polished:median(samples.polished)},counts};
  });
}
export function polishEvidence() {
  const workloads=WORKLOADS.map(name=>{
    const budget=polishBudget(name);
    for(let pair=0;pair<2;pair++){runPolishWorkload(name,Reference);runPolishWorkload(name,Renderer);}
    const samples={baseline:[],polished:[]};
    for(let pair=0;pair<7;pair++)for(const polished of pair%2?[true,false]:[false,true]) {
      const start=performance.now();runPolishWorkload(name,polished?Renderer:Reference);
      samples[polished?'polished':'baseline'].push(performance.now()-start);
    }
    return {...budget,samplesMs:samples,medianMs:{baseline:median(samples.baseline),polished:median(samples.polished)}};
  });
  let actorSha256=null;try{actorSha256=hashFile('../src/actors.js');}catch{}
  return {schemaVersion:1,baseline:'QSOLKCB/CorpoWars@677c998c2dded6d962bec3afdd091a81ae4884db',
    rendererSha256:hashFile('../src/renderer.js'),actorSha256,
    environment:{node:process.version,platform:platform(),arch:arch(),cpu:cpus()[0]?.model},
    protocol:{frames:FRAME_COUNT,warmupPairs:2,measuredPairs:7,order:'alternating',timingGate:false,
      scope:'CPU cold renderer construction, fixture preparation, signatures, mesh generation and modeled Float32 GPU copies. Modules and finite actor templates may already be warm. No GPU, full-game FPS, driver-memory, heap/RSS or universal device performance claim.',
      gates:'No increase in draw/attribute/upload/storage calls, uploaded bytes, live vertices or retained modeled GPU capacity per fixed workload. Exact static city, overlays, uniforms/depth/projection/picking. Renderer must not mutate simulation state.',
      limits:'Fewer vertices and uploaded bytes do not prove identical GPU fragment cost; shapes, alpha coverage, driver and device behavior require native-browser/device observations.',
      cold:'Two process warm-up pairs plus seven alternating measured fresh-process pairs for initial briefing and mixed-role stress. Child clock begins before dynamic imports and includes common fixture/model imports, renderer/template initialization, constructor and first frame. Process creation and OS cache coldness are not measured.'},
    workloads,coldStart:coldPolishEvidence()};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(JSON.stringify(polishEvidence(),null,2));
