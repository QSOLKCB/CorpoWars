import { objectiveKeys } from '../src/objectives.js';
// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {createCampaign,equip,research,RESEARCH,MISSIONS,settleMission,decodeCampaign} from '../src/campaign.js';
import {createGame,startGame,tick,STEP,orderMove,orderEscort,distance,lineOfSight,walkable} from '../src/simulation.js';

function relocate(unit,x,y) {Object.assign(unit,{x,y,prevX:x,prevY:y,path:[]});}
function openOperation(index) {
  const game=createGame(undefined,undefined,index);startGame(game);
  game.world.blocked.fill(0);game.guards=[];game.holdFire=true;
  return game;
}
function veteran() {
  const campaign=createCampaign();
  for(let i=0;i<3;i++)assert.equal(settleMission(campaign,i,'won'),MISSIONS[i].reward);
  for(let i=0;i<4;i++){assert.equal(equip(campaign,i,'aug'),true);campaign.modes[i]=2;}
  for(const node of RESEARCH)assert.equal(research(campaign,node.id),true);
  campaign.difficulty='hostile';
  assert.equal(campaign.cash,2150);assert.deepEqual(decodeCampaign(JSON.stringify(campaign)),campaign);
  return campaign;
}

test('a nearby occluded guard cannot contest transmission and a corner-occluded agent cannot channel',()=>{
  const game=openOperation(3);game.relay.done=true;game.mission={...game.mission,waves:[]};
  const {x,y}=game.vault;
  for(const agent of game.agents)relocate(agent,x,y);
  const enemy=createGame(undefined,undefined,3).guards[0];
  relocate(enemy,x+2,y);Object.assign(enemy,{speed:0,damage:0,cooldown:100,think:100});game.guards=[enemy];
  const blocker=Math.floor(y)*game.world.size+Math.floor(x+1);
  game.world.blocked[blocker]=1;
  assert.ok(distance(enemy,game.vault)<=3);assert.equal(lineOfSight(game.world,enemy,game.vault),false);
  tick(game);assert.equal(game.holdContested,false);assert.equal(game.vault.progress,STEP);
  game.world.blocked[blocker]=0;
  tick(game);assert.equal(game.holdContested,true);assert.equal(game.vault.progress,STEP-STEP*.5);
  game.guards=[];game.vault.progress=4;
  for(const agent of game.agents)relocate(agent,x+1,y+1);
  game.world.blocked[blocker]=1;
  assert.ok(distance(game.agents[0],game.vault)<1.7);
  assert.ok(walkable(game.world,game.agents[0].x,game.agents[0].y));
  assert.equal(lineOfSight(game.world,game.agents[0],game.vault),false,'supercover corner blocks the otherwise in-range channel');
  tick(game);assert.equal(game.vault.progress,4-STEP*.5);
  game.world.blocked[blocker]=0;
  const before=game.vault.progress;tick(game);assert.equal(game.vault.progress,before+STEP);
});

test('courier movement requires line of sight from nearby support, independently of distance',()=>{
  const game=openOperation(4);game.relay.done=true;game.vault.done=true;game.courier.active=true;
  const courier=game.courier,{x,y}=courier;
  for(const agent of game.agents)relocate(agent,x,y+2);
  const blocker=Math.floor(y+1)*game.world.size+Math.floor(x);
  game.world.blocked[blocker]=1;
  assert.ok(distance(game.agents[0],courier)<6);assert.equal(lineOfSight(game.world,game.agents[0],courier),false);
  for(let i=0;i<30;i++)tick(game);
  assert.equal(courier.x,x);assert.equal(courier.y,y);assert.ok(courier.path.length);
  game.world.blocked[blocker]=0;
  tick(game);assert.ok(distance(courier,{x,y})>0,'clearing the obstruction immediately enables supported movement');
  assert.equal(game.phase,'active');
});

test('marksman fire reaches beyond standard security range while walls still block it',()=>{
  function encounter(type,occluded=false) {
    const game=openOperation(3),enemy=createGame(undefined,undefined,3).guards.find(e=>e.enemyType===type);
    game.agents=game.agents.slice(0,1);relocate(game.agents[0],1.5,1.5);relocate(enemy,9.5,1.5);
    Object.assign(enemy,{speed:0,cooldown:0,think:100});game.guards=[enemy];
    if(occluded)game.world.blocked[1*game.world.size+5]=1;
    const before=game.agents[0].hp;tick(game);return before-game.agents[0].hp;
  }
  assert.equal(encounter('guard'),0);
  assert.equal(encounter('marksman'),8);
  assert.equal(encounter('marksman',true),0);
});

test('all three expansion contracts are winnable in Hostile with a legitimately funded squad and no abilities',()=>{
  const campaign=veteran();
  for(let index=3;index<MISSIONS.length;index++) {
    const game=createGame(undefined,campaign,index);startGame(game);
    for(const key of objectiveKeys(game)) {
      assert.equal(key==='exit'&&game.courier?orderEscort(game):orderMove(game,game[key].x,game[key].y),true);
      let frames=0;
      while(frames++<6000&&game.phase==='active'&&(key==='exit'||!game[key].done)) {
        tick(game);game.events=[];
        for(const unit of [...game.agents,...game.guards,...(game.courier?[game.courier]:[])])assert.ok(walkable(game.world,unit.x,unit.y));
      }
      assert.ok(frames<6000,`${game.mission.id}/${key}: bounded real-combat route must finish`);
    }
    assert.equal(game.phase,'won',game.mission.id);
    assert.equal(game.agents.filter(agent=>agent.hp>0).length,4);
    assert.deepEqual(game.metrics,{medkitsUsed:0,empsUsed:0,panicBursts:0});
    assert.ok(game.time<=game.mission.parTime,`${game.mission.id}: its direct route must permit the optional par challenge`);
    if(game.courier)assert.equal(game.courier.hp,game.courier.maxHp);
    assert.equal(settleMission(campaign,index,game.phase),game.mission.reward);
    assert.deepEqual(decodeCampaign(JSON.stringify(campaign)),campaign);
  }
});
