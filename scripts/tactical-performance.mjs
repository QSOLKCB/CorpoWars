// SPDX-License-Identifier: Apache-2.0
// Exact-output ablation: identical new maps/actors/camera, with objective-batch
// retention and changed-range uploads disabled in the reference only.
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {cpus} from 'node:os';
import {pathToFileURL} from 'node:url';
import {Renderer} from '../src/renderer.js';
import {createGame,startGame} from '../src/simulation.js';
import {modelCanvas} from './performance-render-model.mjs';
export class FullStreamRenderer extends Renderer {
  render(...args){this.objectiveKey=null;return super.render(...args);}
  uploadMesh(mesh,buffer,capacityName){
    const gl=this.gl;gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    if(mesh.length*4>this[capacityName]){const capacity=Math.max(262144,mesh.data.byteLength);gl.bufferData(gl.ARRAY_BUFFER,capacity,gl.DYNAMIC_DRAW);this[capacityName]=capacity;this.stats.storageAllocations++;}
    if(mesh.length){gl.bufferSubData(gl.ARRAY_BUFFER,0,mesh.view());this.stats.uploadedBytes+=mesh.length*4;}
  }
}
const FRAMES=90;
function fixture(index,Implementation,capture=false){
  globalThis.devicePixelRatio=1;const game=createGame(undefined,undefined,index);startGame(game);
  const model=modelCanvas({capture}),renderer=new Implementation(model.canvas,game);
  renderer.render(game,null,1);model.draws.length=0;
  return {game,model,renderer};
}
function frame(state,n){
  const {game,renderer}=state;game.time=n/30;
  if(n===30)game.relay.done=true;
  if(n===45)renderer.rotate(1);
  if(n===65)renderer.pan(20,-10);
  renderer.render(game,null,1);
}
function counts({model,renderer}){return {uploadedBytes:model.stats.uploadedBytes,uploadCalls:model.stats.uploadCalls,objectiveBuilds:renderer.stats.objectiveBuilds,objectiveHits:renderer.stats.objectiveHits,retainedGpuBytes:model.retainedBytes(),uploadSnapshotBytes:[...renderer.uploadSnapshots.values()].reduce((sum,s)=>sum+s.data.byteLength,0)};}
export function tacticalParity(index){
  const base=fixture(index,FullStreamRenderer,true),next=fixture(index,Renderer,true),hash=createHash('sha256');
  for(let n=1;n<=FRAMES;n++){
    frame(base,n);frame(next,n);
    assert.deepEqual(next.model.draws,base.model.draws,`map ${index+1} frame ${n}: submitted vertices, uniforms and depth must match`);
    for(const draw of next.model.draws)hash.update(new Uint8Array(draw.values.buffer,draw.values.byteOffset,draw.values.byteLength));
    base.model.draws.length=next.model.draws.length=0;
  }
  const before=counts(base),after=counts(next);base.renderer.dispose();next.renderer.dispose();
  assert.ok(after.uploadedBytes<before.uploadedBytes);assert.ok(after.objectiveBuilds<before.objectiveBuilds);
  assert.equal(after.retainedGpuBytes,before.retainedGpuBytes);
  return {map:index+1,captures:index+2,frames:FRAMES,outputSha256:hash.digest('hex'),reference:before,candidate:after};
}
function measure(index,Implementation){const state=fixture(index,Implementation),start=performance.now();for(let n=1;n<=FRAMES;n++)frame(state,n);const ms=performance.now()-start;state.renderer.dispose();return ms;}
export function tacticalEvidence(){
  const workloads=[0,5].map(index=>{
    const parity=tacticalParity(index),samples={reference:[],candidate:[]};
    for(let i=0;i<2;i++){measure(index,FullStreamRenderer);measure(index,Renderer);}
    for(let pair=0;pair<7;pair++)for(const next of pair%2?[true,false]:[false,true])samples[next?'candidate':'reference'].push(measure(index,next?Renderer:FullStreamRenderer));
    const median=a=>[...a].sort((a,b)=>a-b)[3];
    return {...parity,samplesMs:samples,medianMs:{reference:median(samples.reference),candidate:median(samples.candidate)}};
  });
  const sourceSha256=Object.fromEntries(['src/renderer.js','src/simulation.js','src/objectives.js','src/campaign.js','scripts/tactical-performance.mjs','scripts/performance-render-model.mjs'].map(path=>[path,createHash('sha256').update(readFileSync(path)).digest('hex')]));
  return {schemaVersion:1,sourceSha256,environment:{runtime:process.version,cpu:cpus()[0]?.model},protocol:{frames:FRAMES,warmupPairs:2,pairs:7,order:'alternating',reference:'same candidate with full objective rebuilds and full-stream uploads',scope:'CPU geometry and test-model buffer copies; renderer setup excluded, lazy rotated-side upload included. No GPU time, driver-memory or end-to-end FPS claim.',memory:'one retained Float32 upload snapshot per dynamic stream; objective batch retained; no historical frame cache'},workloads};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(JSON.stringify(tacticalEvidence(),null,2));
