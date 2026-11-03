// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {createCampaign,equip,research,RESEARCH,MISSIONS,settleMission,decodeCampaign} from '../src/campaign.js';
import {createGame,createWorld,random,SIZE,startGame,tick,STEP,walkable,findPath,orderMove,orderEscort,orderAttack,stopAgents,medkit,pulse,togglePanic,objectiveDuration,distance,lineOfSight} from '../src/simulation.js';

const run=(game,seconds)=>{for(let i=0;i<Math.ceil(seconds/STEP);i++)tick(game);};
function inheritedWorld(seed,layout){
  const rng=random(seed),blocked=new Uint8Array(SIZE*SIZE),buildings=[];
  for(let by=0;by<4;by++)for(let bx=0;bx<4;bx++){
    const x=bx*9+4,y=by*9+4;
    const parts=(bx+by+layout)%3===0?[[0,0,3,5],[4,0,1,3]]:[[0,0,5,3],[0,4,3,1]];
    for(const [dx,dy,w,d]of parts){
      const height=1.3+rng()*3.8;
      buildings.push({x:x+dx,y:y+dy,w,d,height,tone:rng(),sign:buildings.length%5});
      for(let cy=y+dy;cy<y+dy+d;cy++)for(let cx=x+dx;cx<x+dx+w;cx++)blocked[cy*SIZE+cx]=1;
    }
  }
  return {size:SIZE,blocked,buildings,seed};
}
function veteran(){
  const campaign=createCampaign();for(let i=0;i<3;i++)settleMission(campaign,i,'won');
  for(let i=0;i<4;i++){assert.ok(equip(campaign,i,'aug'));campaign.modes[i]=2;}
  for(const node of RESEARCH)assert.ok(research(campaign,node.id));
  assert.deepEqual(decodeCampaign(JSON.stringify(campaign)),campaign);
  return campaign;
}
function objectiveFixture(index){
  const game=createGame(undefined,undefined,index);startGame(game);game.guards=[];game.holdFire=true;
  for(const a of game.agents){a.x=game.vault.x;a.y=game.vault.y;a.path=[];}
  game.relay.done=true;return game;
}

test('expansion has six distinct connected maps while the first three remain byte-for-byte unchanged',()=>{
  const maps=new Set();
  for(let i=0;i<MISSIONS.length;i++){
    const game=createGame(undefined,undefined,i),world=game.world;maps.add(world.blocked.join(''));
    if(i<3)assert.deepEqual(world,inheritedWorld(game.mission.seed,game.mission.layout));
    else assert.equal(world.theme,['copperline','coldstore','exchange'][i-3]);
    const queue=[0],seen=new Set(queue);
    for(let q=0;q<queue.length;q++)for(const [dx,dy]of [[1,0],[0,1],[-1,0],[0,-1]]){
      const x=queue[q]%SIZE+dx,y=Math.floor(queue[q]/SIZE)+dy,id=y*SIZE+x;
      if(walkable(world,x,y)&&!seen.has(id)){seen.add(id);queue.push(id);}
    }
    assert.equal(seen.size,world.blocked.filter(v=>!v).length);
    const points=[game.relay,game.vault,game.exit,...game.agents,...game.guards];
    for(const wave of game.mission.waves??[])for(const [x,y]of wave.guards)points.push({x,y});
    for(const [x,y]of game.mission.reinforcements)points.push({x,y});
    for(const p of points){assert.ok(walkable(world,p.x,p.y),`${game.mission.id}: ${p.x},${p.y}`);assert.ok(distance(game.agents[0],p)<.001||findPath(world,game.agents[0],p).length);}
  }
  assert.equal(maps.size,6);
});

test('hold occupation requires a stationary unobstructed living agent and clear or disabled security',()=>{
  const game=objectiveFixture(3);game.mission={...game.mission,waves:[]};game.vault.progress=5;
  const enemy=createGame(undefined,undefined,3).guards[0];
  Object.assign(enemy,{x:game.vault.x+1,y:game.vault.y,speed:0,damage:0,think:100,cooldown:100});game.guards=[enemy];
  tick(game);assert.equal(game.holdContested,true);assert.equal(game.vault.progress,5-STEP*.5);
  enemy.stun=10;const before=game.vault.progress;tick(game);assert.equal(game.holdContested,false);assert.equal(game.vault.progress,before+STEP);
  enemy.stun=0;enemy.fear=10;tick(game);assert.equal(game.holdContested,false);
  enemy.fear=0;enemy.hp=0;tick(game);assert.equal(game.holdContested,false);
  for(const a of game.agents)a.path=[{x:a.x+1,y:a.y}];
  const moving=game.vault.progress;tick(game);assert.equal(game.vault.progress,moving-STEP*.5);
  for(const a of game.agents){a.path=[];a.hp=0;}game.agents[0].hp=120;
  Object.assign(game.agents[0],{x:game.vault.x+2,y:game.vault.y});
  const outside=game.vault.progress;tick(game);assert.equal(game.vault.progress,outside-STEP*.5);
  Object.assign(game.agents[0],{x:game.vault.x,y:game.vault.y});game.vault.progress=11.99;
  tick(game);assert.equal(game.vault.done,true);assert.equal(game.vault.progress,12);assert.equal(objectiveDuration(game,'vault'),12);
});

test('hold security waves trigger once each and cannot be farmed by losing progress or pausing',()=>{
  const game=objectiveFixture(3);tick(game);
  assert.deepEqual(game.holdWavesSpawned,[true,false]);const first=game.guards.length;
  assert.ok(game.guards.every(e=>e.path.length||distance(e,game.vault)<=e.range));
  game.vault.progress=6;tick(game);assert.deepEqual(game.holdWavesSpawned,[true,true]);
  const total=game.guards.length;assert.ok(total>first);
  game.vault.progress=0;tick(game);game.vault.progress=6;tick(game);assert.equal(game.guards.length,total);
  game.paused=true;const snapshot=JSON.stringify(game);run(game,3);assert.equal(JSON.stringify(game),snapshot);
});

test('bulwarks resist bullets and marksmen outrange standard guards in both difficulty modes',()=>{
  for(const difficulty of ['relaxed','hostile']){
    const campaign=createCampaign();campaign.difficulty=difficulty;
    const game=createGame(undefined,campaign,3),bulwark=game.guards.find(e=>e.enemyType==='bulwark'),marksman=game.guards.find(e=>e.enemyType==='marksman'),standard=game.guards.find(e=>e.enemyType==='guard');
    assert.ok(bulwark.hp>standard.hp&&bulwark.speed<standard.speed);assert.equal(bulwark.armour,.25);
    assert.ok(marksman.range>standard.range&&marksman.detection>standard.detection&&marksman.damage>standard.damage);
    startGame(game);game.agents=game.agents.slice(0,1);Object.assign(game.agents[0],{x:2.5,y:1.5});
    Object.assign(bulwark,{x:3.5,y:1.5,speed:0,damage:0,think:100});game.guards=[bulwark];
    const hp=bulwark.hp;tick(game);assert.equal(hp-bulwark.hp,8);
  }
});

test('courier waits for nearby unobstructed support; escort orders rendezvous and manual orders cancel',()=>{
  const game=objectiveFixture(4);game.vault.done=true;game.courier.active=true;
  for(const a of game.agents){a.x=29.5;a.y=29.5;}
  const start={x:game.courier.x,y:game.courier.y};run(game,1);assert.equal(game.courier.x,start.x);assert.equal(game.courier.y,start.y);
  game.paused=true;assert.ok(orderEscort(game));const paused=JSON.stringify(game);run(game,1);assert.equal(JSON.stringify(game),paused);
  game.paused=false;run(game,20);assert.ok(distance(game.courier,start)>3);assert.ok(walkable(game.world,game.courier.x,game.courier.y));
  assert.ok(orderMove(game,game.vault.x,game.vault.y));assert.equal(game.escortFollowing,false);
  assert.ok(orderEscort(game));stopAgents(game);assert.equal(game.escortFollowing,false);
  assert.ok(orderEscort(game));game.selected.clear();assert.equal(orderEscort(game),false);
  const inactive=createGame(undefined,undefined,4);startGame(inactive);assert.equal(orderEscort(inactive),false);
});

test('courier cannot be targeted before release and death afterward terminates and freezes the contract',()=>{
  const game=createGame(undefined,undefined,4);startGame(game);game.holdFire=true;
  for(const a of game.agents){a.x=2.5;a.y=29.5;}
  const enemy=game.guards[0];Object.assign(enemy,{x:game.courier.x+1,y:game.courier.y,speed:0,damage:200,cooldown:0});game.guards=[enemy];
  tick(game);assert.equal(game.courier.hp,120);assert.equal(game.phase,'active');
  game.courier.active=true;tick(game);assert.equal(game.courier.hp,0);assert.equal(game.phase,'lost');
  const snapshot=JSON.stringify(game);run(game,2);assert.equal(JSON.stringify(game),snapshot);
});

test('courier is mandatory at extraction and does not move or progress while paused',()=>{
  const game=objectiveFixture(4);game.vault.done=true;game.courier.active=true;
  for(const a of game.agents){a.x=game.exit.x;a.y=game.exit.y;}
  run(game,3);assert.equal(game.extraction,0);assert.equal(game.phase,'active');
  game.courier.x=game.exit.x;game.courier.y=game.exit.y;game.courier.path=[];
  game.paused=true;const snapshot=JSON.stringify(game);run(game,2);assert.equal(JSON.stringify(game),snapshot);
  game.paused=false;run(game,2.1);assert.equal(game.phase,'won');
});

test('lockdown starts after the relay, freezes on pause, expires and permits an extraction at the exact deadline',()=>{
  for(const difficulty of ['relaxed','hostile']){
    const campaign=createCampaign();campaign.difficulty=difficulty;
    const game=createGame(undefined,campaign,5);startGame(game);game.guards=[];
    run(game,2);assert.equal(game.lockdownRemaining,null);
    Object.assign(game.agents[0],{x:game.relay.x,y:game.relay.y});game.relay.progress=2.99;tick(game);
    assert.equal(game.lockdownRemaining,difficulty==='relaxed'?180:120);
    game.paused=true;const snapshot=JSON.stringify(game);run(game,2);assert.equal(JSON.stringify(game),snapshot);
    game.paused=false;game.lockdownRemaining=STEP;tick(game);assert.equal(game.phase,'lost');assert.equal(game.lockdownRemaining,0);
    const expired=JSON.stringify(game);run(game,2);assert.equal(JSON.stringify(game),expired);
  }
  const game=objectiveFixture(5);game.vault.done=true;game.lockdownRemaining=STEP;game.extraction=2-STEP/2;
  for(const a of game.agents){a.x=game.exit.x;a.y=game.exit.y;}
  tick(game);assert.equal(game.phase,'won');assert.equal(game.lockdownRemaining,0);
});

test('challenge metrics count successful consumption and emitted panic, never failed or paused requests',()=>{
  const game=createGame();startGame(game);assert.equal(medkit(game),false);assert.deepEqual(game.metrics,{medkitsUsed:0,empsUsed:0,panicBursts:0});
  game.paused=true;assert.equal(pulse(game),false);game.agents[0].hp=1;assert.equal(medkit(game),false);
  game.paused=false;assert.ok(medkit(game));assert.ok(pulse(game));
  game.holdFire=true;const enemy=game.guards[0];Object.assign(enemy,{x:game.agents[0].x+2,y:game.agents[0].y,speed:0});game.guards=[enemy];
  togglePanic(game);tick(game);assert.equal(game.metrics.panicBursts,1);tick(game);assert.equal(game.metrics.panicBursts,1);
  assert.deepEqual(game.metrics,{medkitsUsed:1,empsUsed:1,panicBursts:1});
});

test('all six contracts have deterministic winning real-combat routes with a legitimate veteran loadout',()=>{
  const results=[];
  for(let repeat=0;repeat<2;repeat++){
    const campaign=veteran(),outcomes=[];
    for(let index=0;index<MISSIONS.length;index++){
      const game=createGame(undefined,campaign,index);startGame(game);
      for(const key of ['relay','vault','exit']){
        if(key==='exit'&&game.courier?.active)assert.ok(orderEscort(game));else assert.ok(orderMove(game,game[key].x,game[key].y));
        for(let i=0;i<6000&&game.phase==='active'&&(key==='exit'||!game[key].done);i++){
          tick(game);game.events=[];
          for(const unit of [...game.agents,...game.guards,...(game.courier?[game.courier]:[])])assert.ok(walkable(game.world,unit.x,unit.y));
        }
      }
      assert.equal(game.phase,'won',game.mission.id);assert.equal(game.agents.filter(a=>a.hp>0).length,4);assert.deepEqual(game.metrics,{medkitsUsed:0,empsUsed:0,panicBursts:0});
      outcomes.push({id:game.mission.id,time:game.time,hp:game.agents.map(a=>a.hp),courier:game.courier?.hp,kills:game.kills});
      if(index>=3)assert.equal(settleMission(campaign,index,'won'),game.mission.reward);
      assert.deepEqual(decodeCampaign(JSON.stringify(campaign)),campaign);
    }
    results.push(outcomes);
  }
  assert.deepEqual(results[0],results[1]);
});
