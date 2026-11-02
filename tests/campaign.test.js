// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { createCampaign, STARTING_CASH, WEAPONS, RESEARCH, MISSIONS, equip, research, canResearch, missionUnlocked, settleMission, decodeCampaign } from '../src/campaign.js';
import { createGame, startGame, tick, STEP, orderMove, medkit, togglePanic, cycleMode, walkable, distance, lineOfSight } from '../src/simulation.js';
import { musicStep, frequency } from '../src/music.js';

function advance(g,seconds) {for(let i=0;i<Math.ceil(seconds/STEP);i++){tick(g);g.events=[];}}
test('one finite budget funds weapons and prerequisite-gated research',()=>{
  const c=createCampaign();assert.equal(c.cash,STARTING_CASH);
  assert.equal(research(c,'med2'),false);assert.equal(research(c,'arms'),false);
  assert.ok(equip(c,0,'aug'));assert.ok(equip(c,1,'owen'));assert.ok(equip(c,2,'shotgun'));
  assert.ok(research(c,'head'));assert.ok(research(c,'arms'));assert.ok(research(c,'med1'));
  assert.equal(c.cash,400);const before=structuredClone(c);
  assert.equal(research(c,'torso'),false);assert.equal(equip(c,3,'aug'),false);assert.equal(research(c,'head'),false);
  assert.deepEqual(c,before);assert.equal(canResearch(c,'unknown'),false);
  assert.ok(equip(c,0,'issued'));assert.ok(equip(c,0,'aug'));assert.equal(c.cash,400);
  for(const invalid of ['__proto__','constructor','missing'])assert.equal(equip(c,0,invalid),false);
  assert.equal(equip(c,4,'aug'),false);assert.equal(equip(c,-1,'owen'),false);
});
test('campaign settlement unlocks in order and never duplicates credits',()=>{
  const c=createCampaign();assert.equal(missionUnlocked(c,1),false);
  assert.equal(settleMission(c,1,'won'),0);assert.equal(settleMission(c,0,'lost'),0);
  for(let i=0;i<3;i++){
    assert.ok(missionUnlocked(c,i));assert.equal(settleMission(c,i,'won'),MISSIONS[i].reward);
    assert.equal(settleMission(c,i,'won'),0);
  }
  assert.equal(c.cash,15600);assert.equal(c.mission,2);assert.deepEqual(c.completed,[0,1,2]);
});
test('save round trip validates the balance, ownership, prerequisites and mission bounds',()=>{
  const c=createCampaign();equip(c,2,'aug');research(c,'med1');settleMission(c,0,'won');
  assert.deepEqual(decodeCampaign(JSON.stringify(c)),c);
  for(const mutate of [s=>s.cash++,s=>s.version=8,s=>s.cash=-1,s=>s.completed=[2],s=>s.owned[0]=['constructor'],s=>s.loadout[1]='aug',s=>s.research=['med2'],s=>s.mission=2,s=>s.modes[0]=9,s=>s.owned[1].push('issued')]) {
    const broken=structuredClone(c);mutate(broken);assert.equal(decodeCampaign(JSON.stringify(broken)),null);
  }
  for(const value of ['{','null','[]','"bad"'])assert.equal(decodeCampaign(value),null);
});
test('medical research heals only selected living agents and restocks between missions',()=>{
  const c=createCampaign();research(c,'med1');research(c,'med2');const g=createGame(undefined,c);startGame(g);
  assert.equal(g.medkits,4);g.agents[0].hp=1;g.agents[1].hp=0;g.agents[2].hp=85;g.selected=new Set([0,1]);
  assert.ok(medkit(g));assert.equal(g.agents[0].hp,111);assert.equal(g.agents[1].hp,0);assert.equal(g.agents[2].hp,85);
  assert.ok(medkit(g));assert.equal(g.agents[0].hp,g.agents[0].maxHp);
  assert.equal(createGame(undefined,c).medkits,4);
});
test('body augmentations modify combat, travel and hacking without stacking on refit',()=>{
  const c=createCampaign();for(const id of ['head','arms','torso','legs'])assert.ok(research(c,id));
  const base=createGame(),g=createGame(undefined,c),refit=createGame(undefined,c);
  for(let i=0;i<4;i++){
    assert.equal(g.agents[i].maxHp,base.agents[i].maxHp+30);assert.equal(g.agents[i].armour,.2);
    assert.ok(g.agents[i].speed>base.agents[i].speed);assert.equal(g.agents[i].range,base.agents[i].range+1);
    assert.ok(g.agents[i].interval<base.agents[i].interval);assert.ok(g.agents[i].reloadTime<base.agents[i].reloadTime);
    assert.deepEqual(g.agents[i],refit.agents[i]);
  }
  startGame(g);g.guards=[];Object.assign(g.agents[0],{x:g.relay.x,y:g.relay.y});advance(g,2.4);assert.equal(g.relay.done,true);
});
function duel(weapon='issued',mode=0) {
  const c=createCampaign();equip(c,0,weapon);c.modes[0]=mode;const g=createGame(undefined,c);startGame(g);
  g.agents=g.agents.slice(0,1);g.guards=g.guards.slice(0,1);g.selected=new Set([0]);
  Object.assign(g.guards[0],{x:8.5,y:29.5,hp:10000,damage:0,speed:0});return g;
}
test('all loadouts fire and reload their own magazine with distinct cadences',()=>{
  const damage={};
  for(const id of Object.keys(WEAPONS)){
    const g=duel(id);advance(g,1);damage[id]=10000-g.guards[0].hp;assert.ok(damage[id]>0);
    advance(g,10);assert.ok(g.agents[0].ammo>=0&&g.agents[0].ammo<=WEAPONS[id].magazine);
  }
  assert.ok(damage.owen>damage.issued);assert.ok(damage.shotgun>damage.issued);
  assert.ok(WEAPONS.shotgun.reloadTime<WEAPONS.issued.reloadTime);
});
test('AUG switches among all three conversions with an enforced full reload',()=>{
  const g=duel('aug');g.paused=true;
  for(const expected of [1,2,0]) {
    assert.ok(cycleMode(g));assert.equal(g.agents[0].mode,expected);assert.equal(g.agents[0].ammo,0);assert.ok(g.agents[0].reload>0);
  }
  g.paused=false;g.holdFire=true;advance(g,2.1);assert.equal(g.agents[0].ammo,30);
  const damage=[];for(let mode=0;mode<3;mode++){const d=duel('aug',mode);tick(d);damage.push(10000-d.guards[0].hp);}
  assert.deepEqual(damage,[12,7,23]);assert.equal(cycleMode(duel('owen')),false);
});
test('panic forces visible guards to retreat without firing, then expires and recharges',()=>{
  const g=duel();g.holdFire=true;g.guards[0].damage=8;g.guards[0].speed=1.65;
  const initial=distance(g.agents[0],g.guards[0]),hp=g.agents[0].hp;togglePanic(g);advance(g,1.5);
  assert.ok(g.guards[0].fear>0);assert.ok(distance(g.agents[0],g.guards[0])>initial);assert.equal(g.agents[0].hp,hp);
  assert.ok(g.panicCooldown>20);assert.ok(walkable(g.world,g.guards[0].x,g.guards[0].y));
  togglePanic(g);advance(g,5);assert.equal(g.guards[0].fear,0);assert.ok(g.panicCooldown>0);
  g.paused=true;const cooldown=g.panicCooldown;advance(g,1);assert.equal(g.panicCooldown,cooldown);
});
test('panic cannot reach through walls or spend a cooldown without a living emitter',()=>{
  const g=duel();g.holdFire=true;
  Object.assign(g.agents[0],{x:3.5,y:5.5});Object.assign(g.guards[0],{x:8.5,y:5.5,speed:0,think:100});
  assert.equal(lineOfSight(g.world,g.agents[0],g.guards[0]),false);togglePanic(g);tick(g);
  assert.equal(g.guards[0].fear,0);assert.equal(g.panicCooldown,0);
  g.selected.clear();Object.assign(g.guards[0],{x:3.5,y:6.5});tick(g);assert.equal(g.guards[0].fear,0);
});
test('each district has distinct geometry, reachable objectives, and a winnable real-combat route',()=>{
  const c=createCampaign(),maps=new Set();
  for(let i=0;i<MISSIONS.length;i++) {
    const g=createGame(undefined,c,i);maps.add(g.world.blocked.join(''));startGame(g);
    for(const p of [g.relay,g.vault,g.exit,...g.agents,...g.guards])assert.ok(walkable(g.world,p.x,p.y));
    for(const key of ['relay','vault','exit']) {
      assert.ok(orderMove(g,g[key].x,g[key].y));
      for(let n=0;n<3600&&g.phase==='active'&&(key==='exit'||!g[key].done);n++) {
        tick(g);g.events=[];for(const a of [...g.agents,...g.guards])assert.ok(walkable(g.world,a.x,a.y));
      }
    }
    assert.equal(g.phase,'won');assert.equal(g.agents.filter(a=>a.hp>0).length,4);
    assert.equal(settleMission(c,i,g.phase),MISSIONS[i].reward);assert.deepEqual(decodeCampaign(JSON.stringify(c)),c);
  }
  assert.equal(maps.size,3);
});
test('Relaxed preserves the baseline; Hostile adds stronger guards and panic resistance',()=>{
  const c=createCampaign(),relaxed=createGame(undefined,c);c.difficulty='hostile';
  const hard=createGame(undefined,c);assert.equal(relaxed.guards[0].hp,65);assert.equal(relaxed.guards[0].damage,4);
  assert.equal(hard.guards.length,relaxed.guards.length+4);assert.ok(hard.guards[0].hp>relaxed.guards[0].hp);
  assert.ok(hard.guards[0].damage>relaxed.guards[0].damage);assert.ok(hard.guards[0].interval<relaxed.guards[0].interval);
  assert.ok(hard.panicDuration<relaxed.panicDuration);assert.equal(c.cash,6000);
  for(const e of hard.guards)assert.ok(walkable(hard.world,e.x,e.y));
  assert.deepEqual(decodeCampaign(JSON.stringify(c)),c);c.difficulty='invalid';assert.equal(decodeCampaign(JSON.stringify(c)),null);
});
test('the original chip score is deterministic, finite and changes its arrangement by mood',()=>{
  assert.equal(frequency(69),440);
  for(const mood of ['briefing','patrol','combat','paused'])for(let step=0;step<512;step++){
    const notes=musicStep(step,mood);assert.deepEqual(notes,musicStep(step,mood));
    for(const n of notes){assert.ok(Number.isFinite(frequency(n.midi)));assert.ok(n.length>0&&n.length<=.25);assert.ok(n.level>0&&n.level<.2);}
    assert.ok(notes.reduce((sum,n)=>sum+n.level,0)<.4);
    if(mood==='paused')assert.ok(notes.every(n=>n.voice!=='kick'&&n.voice!=='snare'&&n.voice!=='hat'));
  }
  assert.notDeepEqual(musicStep(0,'combat'),musicStep(0,'briefing'));
  assert.equal(RESEARCH.length,8);
});
