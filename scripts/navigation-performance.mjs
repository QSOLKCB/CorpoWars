// SPDX-License-Identifier: Apache-2.0
// Complete preparation cost, including world creation and cold scratch storage.
// Timings are observations; exact waypoint parity is the correctness gate.
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';
import { createWorld, findPath, random, walkable } from '../src/simulation.js';
import { findPath as reference } from './navigation-reference.mjs';

function workload(search) {
  const rng=random(0x425354),routes=[];
  for(let layout=0;layout<3;layout++) {
    const world=createWorld(2091+layout,layout),cells=[];
    for(let y=0;y<world.size;y++)for(let x=0;x<world.size;x++)if(walkable(world,x,y))cells.push({x:x+.5,y:y+.5});
    for(let i=0;i<400;i++) {
      const start={...cells[Math.floor(rng()*cells.length)]},goal=cells[Math.floor(rng()*cells.length)];
      if(i%3===0){start.x+=.23;start.y-=.19;}
      routes.push(search(world,start,goal));
    }
  }
  return routes;
}
function measure(search) {
  const start=performance.now(),routes=workload(search),milliseconds=performance.now()-start;
  return {milliseconds,routes};
}
const samples={reference:[],heap:[]};
let digest='';
for(let pair=0;pair<9;pair++) {
  const results={};
  for(const name of pair%2?['heap','reference']:['reference','heap']) {
    results[name]=measure(name==='heap'?findPath:reference);
    if(pair>=2)samples[name].push(results[name].milliseconds);
  }
  assert.deepEqual(results.heap.routes,results.reference.routes,`pair ${pair} route parity`);
  digest=createHash('sha256').update(JSON.stringify(results.heap.routes)).digest('hex');
}
const median=values=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)];
console.log(JSON.stringify({
  source:'CorpoWars 54a4b1bc1d24195092be2c1e8f056a2eb3730057 findPath',
  method:'2 warm-up pairs, 7 alternating measured pairs; 1200 paths across 3 freshly constructed 36x36 worlds per trial; exact complete waypoint-array parity',
  environment:{node:process.version,platform:process.platform,architecture:process.arch},
  samplesMs:samples,medianMs:{reference:median(samples.reference),heap:median(samples.heap)},
  routeDigestSha256:digest,retainedScratchBytesPer1296CellWorld:1296*40,
  limitations:'CPU route preparation only; no frame-rate, browser, physical GPU or heap/RSS claim. Timings have no CI threshold.'
},null,2));
