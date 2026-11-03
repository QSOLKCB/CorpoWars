// SPDX-License-Identifier: Apache-2.0
// Fixed visual workloads, independent of the actorless legacy-parity adapter.
import {createGame,startGame,orderMove,tick,STEP} from '../src/simulation.js';
import {createCampaign} from '../src/campaign.js';

export const FRAME_COUNT=120;
export const WORKLOADS=['breakwater-briefing','foundry-paused','breakwater-patrol','spire-combat',
  'copperline-siege','coldstore-courier','exchange-lockdown','specialist-stress'];
const missions={'breakwater-briefing':0,'foundry-paused':1,'breakwater-patrol':0,'spire-combat':2,
  'copperline-siege':3,'coldstore-courier':4,'exchange-lockdown':5,'specialist-stress':4};

function stageVisibleUnits(game,stress=false) {
  // Synthetic visual fixtures intentionally remove occlusion but retain the
  // original static city. Real campaign gameplay remains in the browser suite.
  game.world.blocked.fill(0);
  for(const [i,a]of game.agents.entries())Object.assign(a,{x:9+i,y:1.5,prevX:8.9+i,prevY:1.5,path:[]});
  if(stress) {
    const source=game.guards[0];
    game.guards=Array.from({length:32},(_,i)=>({...source,id:1000+i,enemyType:['guard','bulwark','marksman'][i%3],
      x:4+i%14,y:2.5+Math.floor(i/14),prevX:4+i%14,prevY:2.5+Math.floor(i/14),path:[]}));
  }else for(const [i,g]of game.guards.entries())Object.assign(g,{x:7+i%8,y:2.5+Math.floor(i/8),prevX:7+i%8,prevY:2.5+Math.floor(i/8),path:[]});
  if(game.courier)Object.assign(game.courier,{x:11,y:4.5,prevX:10.9,prevY:4.5,active:true,path:[{x:12,y:4.5}]});
}

export function polishFixture(name) {
  if(!Object.hasOwn(missions,name))throw new RangeError(`unknown visual workload: ${name}`);
  const campaign=createCampaign();campaign.difficulty=name==='spire-combat'||name==='specialist-stress'?'hostile':'relaxed';
  const game=createGame(undefined,campaign,missions[name]);
  if(name!=='breakwater-briefing')startGame(game);
  if(name==='foundry-paused')game.paused=true;
  if(name==='breakwater-patrol')orderMove(game,game.relay.x,game.relay.y);
  if(['spire-combat','copperline-siege','coldstore-courier','exchange-lockdown','specialist-stress'].includes(name))stageVisibleUnits(game,name==='specialist-stress');
  if(name==='copperline-siege')game.relay.done=true;
  if(name==='exchange-lockdown'){game.relay.done=true;game.lockdownRemaining=120;}
  const hover={x:10.2,y:1.5};
  return {game,step(index,renderer,model){
    if(name==='breakwater-briefing') {
      if(index%12===0){renderer.pan(9,-4);renderer.zoomBy(index%24===0?1.02:1/1.02);}
      renderer.cutaway=index%20<10;
      if(index===60){model.rect.width=1000;model.rect.height=800;}
    }else if(name==='foundry-paused') {
      if(index===12)game.selected.delete(0);
      if(index===24)game.agents[1].path=[{x:game.agents[1].x+1,y:game.agents[1].y}];
      if(index===36)game.agents[2].hp-=10;
      if(index===48)game.relay.done=true;
      if(index===60)game.vault.done=true;
      if(index===72)game.agents[3].hp=0;
      if(index===84)game.agents[1].path=[];
      if(index===96)game.selected.add(0);
      if(index===108)hover.x=11;
      renderer.pan(.5,-.2);
    }else if(name==='breakwater-patrol') {
      if(index%2===0)tick(game,STEP);
    }else {
      game.time=index*STEP;
      for(const [i,a]of game.agents.entries()) {
        a.prevX=a.x;a.prevY=a.y;a.x+=index%2?.025:-.025;
        a.path=index%4?[{x:a.x+1,y:a.y}]:[];a.hp=a.maxHp-index%20;
        a.fear=index%17===0?1:0;a.stun=index%19===0?1:0;
      }
      for(const [i,g]of game.guards.entries()) {
        g.prevX=g.x;g.x+=index%2?.01:-.01;
        g.hp=index%23===0&&i===0?0:g.maxHp-index%10;
        g.fear=i%3===index%3?1:0;g.stun=i%4===index%4?1:0;
        g.path=index%3?[{x:g.x,y:g.y+1}]:[];
        if(name==='specialist-stress')g.enemyType=['guard','bulwark','marksman'][(i+Math.floor(index/12))%3];
      }
      game.effects=[{type:'shot',x:9,y:1.5,tx:11,ty:2.5,team:'agent',weapon:index%2?'shotgun':'aug',life:(120-index)/120,maxLife:1},
        {type:index%3===0?'panic':index%3===1?'pulse':'order',x:10,y:2.5,life:(120-index)/120,maxLife:1}];
      if(name==='copperline-siege'){game.holdContested=index%12<6;game.vault.progress=index%12;game.vault.done=index>=108;}
      if(name==='exchange-lockdown')game.lockdownRemaining=120-game.time;
      if(game.courier) {
        const c=game.courier;c.prevX=c.x;c.x+=index%2?.025:-.025;
        c.active=name==='specialist-stress'||index>=30;
        c.hp=index===119?0:c.maxHp-index%40;
        c.path=index%5?[{x:c.x+1,y:c.y}]:[];
      }
      hover.x=9+index%3;renderer.cutaway=index%20<5;
    }
    return {hover:name==='breakwater-briefing'?null:hover,alpha:name==='foundry-paused'||name==='breakwater-briefing'?1:(index%2?.75:.25),delta:1/60};
  }};
}
