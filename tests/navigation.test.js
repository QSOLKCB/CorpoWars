// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, createWorld, findPath, random, walkable } from '../src/simulation.js';
import { findPath as reference } from '../scripts/navigation-reference.mjs';

function compare(world, start, goal) {
  assert.deepEqual(findPath(world, start, goal), reference(world, start, goal), JSON.stringify({start, goal}));
}

test('heap navigation preserves every reference waypoint and tie across all districts', () => {
  const rng = random(0x425354);
  for (let mission = 0; mission < 3; mission++) {
    const {world, relay, vault, exit, agents} = createGame(undefined, undefined, mission);
    for (const start of agents) for (const goal of [relay, vault, exit]) compare(world, start, goal);
    const cells=[];
    for (let y=0;y<world.size;y++) for (let x=0;x<world.size;x++) if(walkable(world,x,y))cells.push({x:x+.5,y:y+.5});
    for(let i=0;i<400;i++) {
      const start={...cells[Math.floor(rng()*cells.length)]},goal=cells[Math.floor(rng()*cells.length)];
      if(i%3===0){start.x+=.23;start.y-=.19;}
      compare(world,start,goal);
    }
  }
});

test('scratch reuse reads edited occupancy and returns independently owned routes', () => {
  const world={size:7,blocked:new Uint8Array(49)};
  const start={x:.5,y:.5},goal={x:6.5,y:6.5};
  const old=findPath(world,start,goal),saved=structuredClone(old);
  for(let y=0;y<7;y++)world.blocked[y*7+3]=1;
  compare(world,start,goal);assert.deepEqual(findPath(world,start,goal),[]);
  world.blocked[6*7+3]=0;compare(world,start,goal);
  assert.deepEqual(old,saved);
  old[0].x=999;old.push({x:999,y:999});compare(world,start,goal);
  world.blocked=new Uint8Array(49);compare(world,start,goal);
  world.size=4;world.blocked=new Uint8Array(16);compare(world,start,{x:3.5,y:3.5});
});

test('endpoint and disconnected-grid failures match the reference after populated searches', () => {
  const world=createWorld();compare(world,{x:.5,y:.5},{x:35.5,y:35.5});
  for(const start of [{x:NaN,y:1},{x:Infinity,y:1},{x:-.1,y:1},{x:36,y:1},{x:4.5,y:4.5}]) {
    compare(world,start,{x:1.5,y:1.5});compare(world,{x:1.5,y:1.5},start);
  }
  for(const start of [{x:1.5,y:1.5},{x:1.5001,y:1.5001},{x:1.2,y:1.3}])compare(world,start,{x:1.5,y:1.5});
  const disconnected={size:10,blocked:new Uint8Array(100)};
  for(let y=0;y<10;y++)disconnected.blocked[y*10+5]=1;
  for(let i=0;i<20;i++)compare(disconnected,{x:.5,y:i%10+.5},{x:9.5,y:9.5-i%10});
});


test('heap decreases preserve Set insertion-order ties on edited random grids', () => {
  const rng=random(97231),world={size:12,blocked:new Uint8Array(144)};
  for(let generation=0;generation<50;generation++) {
    for(let i=0;i<world.blocked.length;i++)world.blocked[i]=rng()<.27?1:0;
    for(let route=0;route<20;route++) {
      const start={x:Math.floor(rng()*12)+.5,y:Math.floor(rng()*12)+.5};
      const goal={x:Math.floor(rng()*12)+.5,y:Math.floor(rng()*12)+.5};
      compare(world,start,goal);
    }
  }
});
