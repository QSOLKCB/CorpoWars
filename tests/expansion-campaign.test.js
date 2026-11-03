// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {createCampaign,decodeCampaign,MISSIONS,STARTING_CASH,ENEMY_TYPES,DIFFICULTIES,settleMission,missionUnlocked,equip,research} from '../src/campaign.js';
import {CHALLENGES,challengeResults,recordChallenges} from '../src/challenges.js';

function won(index=0,difficulty='relaxed') {
  return {phase:'won',missionIndex:index,mission:MISSIONS[index],difficulty:DIFFICULTIES[difficulty],
    time:MISSIONS[index].parTime,agents:Array.from({length:4},()=>({hp:100})),metrics:{medkitsUsed:0,empsUsed:0,panicBursts:0}};
}
function allCompleted() {
  const c=createCampaign();
  for(let i=0;i<MISSIONS.length;i++)settleMission(c,i,'won');
  return c;
}

test('six distinct contracts include hold, escort and lockdown with reachable avenue anchors',()=>{
  assert.equal(MISSIONS.length,6);
  for(const field of ['id','name','district','seed','layout'])assert.equal(new Set(MISSIONS.map(m=>m[field])).size,6);
  assert.deepEqual(MISSIONS.slice(3).map(m=>m.kind),['hold','escort','lockdown']);
  for(const mission of MISSIONS) {
    assert.ok(Number.isFinite(mission.parTime)&&mission.parTime>0);
    const points=[mission.relay,mission.vault,mission.exit,mission.spawn,...mission.guards,...mission.reinforcements,...(mission.waves??[]).flatMap(wave=>wave.guards)];
    for(const [x,y,enemyType]of points) {
      assert.ok(x>=0&&x<36&&y>=0&&y<36);
      assert.ok(Math.floor(x)%9<3||Math.floor(y)%9<3,'new anchors stay on unobstructed avenues');
      if(enemyType)assert.ok(Object.hasOwn(ENEMY_TYPES,enemyType));
    }
  }
  assert.deepEqual(MISSIONS[3].waves.map(w=>w.at),[0,6]);
  assert.equal(MISSIONS[3].vaultDuration,12);
  assert.deepEqual(MISSIONS[4].courier,{hp:120,speed:2.8});
  assert.deepEqual(MISSIONS[5].lockdown,{relaxed:180,hostile:120});
  assert.deepEqual(ENEMY_TYPES.guard,{name:'Security',hp:1,damage:1,speed:1,interval:1,range:5.8,detection:9,armour:0});
  assert.ok(ENEMY_TYPES.bulwark.armour>0&&ENEMY_TYPES.bulwark.speed<1);
  assert.ok(ENEMY_TYPES.marksman.range>ENEMY_TYPES.guard.range&&ENEMY_TYPES.marksman.hp<1);
});

test('completed v0.3 saves retain economy, equipment, research and selection while unlocking contract four',()=>{
  const legacy=createCampaign();equip(legacy,0,'aug');research(legacy,'head');
  for(let i=0;i<3;i++)settleMission(legacy,i,'won');
  delete legacy.challenges;legacy.mission=2;
  const restored=decodeCampaign(JSON.stringify(legacy));
  assert.ok(restored);assert.equal(restored.version,1);assert.equal(restored.mission,2);
  for(const key of ['cash','owned','loadout','research','completed','modes'])assert.deepEqual(restored[key],legacy[key]);
  assert.deepEqual(restored.challenges,{});assert.ok(missionUnlocked(restored,3));assert.equal(missionUnlocked(restored,4),false);
});

test('all six contracts unlock sequentially, pay once and persist above the old cash ceiling',()=>{
  const c=createCampaign();assert.equal(missionUnlocked(c,3),false);assert.equal(settleMission(c,3,'won'),0);
  for(let i=0;i<MISSIONS.length;i++) {
    const before=c.cash;
    assert.equal(missionUnlocked(c,i),true);assert.equal(settleMission(c,i,'lost'),0);
    assert.equal(settleMission(c,i,'won'),MISSIONS[i].reward);assert.equal(c.cash,before+MISSIONS[i].reward);
    assert.equal(settleMission(c,i,'won'),0);assert.deepEqual(decodeCampaign(JSON.stringify(c)),c);
  }
  assert.equal(c.cash,33200);assert.equal(c.cash,STARTING_CASH+MISSIONS.reduce((sum,m)=>sum+m.reward,0));
  assert.equal(c.mission,5);assert.deepEqual(c.completed,[0,1,2,3,4,5]);
  assert.equal(missionUnlocked(c,6),false);assert.equal(settleMission(c,6,'won'),0);
  const forged=structuredClone(c);forged.cash++;assert.equal(decodeCampaign(JSON.stringify(forged)),null);
});

test('challenge recognition requires victory and evaluates survival, actual expenditure and exact par boundaries',()=>{
  const game=won();assert.deepEqual(challengeResults(game).filter(c=>c.earned).map(c=>c.id),['clean','restraint','swift']);
  game.phase='active';assert.ok(challengeResults(game).every(c=>!c.earned));game.phase='lost';assert.ok(challengeResults(game).every(c=>!c.earned));
  game.phase='won';game.agents[2].hp=0;game.time+=.001;game.metrics.empsUsed=1;
  assert.ok(challengeResults(game).every(c=>!c.earned));
  game.agents[2].hp=100;game.time=MISSIONS[0].parTime;
  for(const key of ['medkitsUsed','empsUsed','panicBursts']) {
    game.metrics={medkitsUsed:0,empsUsed:0,panicBursts:0};game.metrics[key]=1;
    assert.equal(challengeResults(game).find(c=>c.id==='restraint').earned,false);
  }
  for(const metrics of [undefined,{medkitsUsed:0,empsUsed:0},{medkitsUsed:0,empsUsed:NaN,panicBursts:0}]) {
    game.metrics=metrics;assert.equal(challengeResults(game).find(c=>c.id==='restraint').earned,false);
  }
  for(const time of [-1,NaN,Infinity]){game.time=time;assert.equal(challengeResults(game).find(c=>c.id==='swift').earned,false);}
});

test('challenge badges accumulate by contract/difficulty without duplicate payouts and survive replay/load',()=>{
  const c=createCampaign(),game=won();
  assert.deepEqual(recordChallenges(c,game),[],'settle the contract before recording badges');
  settleMission(c,0,'won');const cash=c.cash;
  game.metrics.medkitsUsed=1;assert.deepEqual(recordChallenges(c,game),['clean','swift']);
  assert.deepEqual(c.challenges['breakwater:relaxed'],['clean','swift']);
  game.metrics.medkitsUsed=0;game.time++;game.agents[0].hp=0;recordChallenges(c,game);
  assert.deepEqual(c.challenges['breakwater:relaxed'],['clean','restraint','swift']);assert.equal(c.cash,cash);
  game.difficulty=DIFFICULTIES.hostile;recordChallenges(c,game);assert.deepEqual(c.challenges['breakwater:hostile'],['restraint']);
  assert.deepEqual(decodeCampaign(JSON.stringify(c)),c);
  const before=structuredClone(c);game.phase='lost';assert.deepEqual(recordChallenges(c,game),[]);assert.deepEqual(c,before);
  assert.equal(settleMission(c,0,'won'),0);assert.equal(c.cash,cash);
});

test('save reconstruction rejects forged badge keys, unknown/duplicate IDs and uncompleted contract claims',()=>{
  const c=allCompleted();
  for(const challenges of [null,[],42,{'breakwater:relaxed':['missing']},{'breakwater:relaxed':['clean','clean']},{'breakwater:impossible':['clean']},{'constructor:relaxed':['clean']},{'missing:relaxed':[]},{'exchange:relaxed':'clean'},JSON.parse('{"__proto__":["clean"]}')]) {
    const forged=structuredClone(c);forged.challenges=challenges;assert.equal(decodeCampaign(JSON.stringify(forged)),null);
  }
  const fresh=createCampaign();fresh.challenges={'exchange:relaxed':['clean']};assert.equal(decodeCampaign(JSON.stringify(fresh)),null);
  c.challenges={'exchange:hostile':CHALLENGES.map(ch=>ch.id)};assert.deepEqual(decodeCampaign(JSON.stringify(c)),c);
  const over=structuredClone(c);over.completed.push(6);assert.equal(decodeCampaign(JSON.stringify(over)),null);
});
