// SPDX-License-Identifier: Apache-2.0
import {createGame,startGame,orderMove,tick,STEP} from '../src/simulation.js';
import {createCampaign} from '../src/campaign.js';

export const FRAME_COUNT=120;
export const WORKLOADS=['briefing-camera','paused-orders','active-patrol','changing-combat'];

export function renderFixture(name) {
  const campaign=createCampaign();campaign.difficulty=name==='changing-combat'?'hostile':'relaxed';
  const game=createGame(undefined,campaign,name==='paused-orders'?1:name==='changing-combat'?2:0);
  // Freeze the historical two-capture scene for the legacy renderer comparison.
  // Expanded objectives are covered by tactical-controls and full campaign checks.
  game.captureKeys=[];game.guards=game.guards.filter(unit=>unit.id<500);
  if(name!=='briefing-camera')startGame(game);
  if(name==='active-patrol')orderMove(game,game.relay.x,game.relay.y);
  if(name==='paused-orders')game.paused=true;
  if(name==='changing-combat') {
    for(const [i,a]of game.agents.entries()){a.x=7+i;a.y=1.5;a.prevX=a.x-.15;a.prevY=a.y;}
    for(const [i,g]of game.guards.entries()){g.x=7+i%8;g.y=2.5;g.prevX=g.x;g.prevY=g.y;}
  }
  const hover={x:1,y:1};
  return {game,frame(index,renderer,model){
    if(name==='briefing-camera') {
      if(index%12===0){renderer.pan(9,-4);renderer.zoomBy(index%24===0?1.02:1/1.02);}
      renderer.cutaway=index%20<10;
      if(index===60){model.rect.width=1000;model.rect.height=800;}
    } else if(name==='paused-orders') {
      // Exact key invalidation without a tick: paused orders, selection, hover,
      // terminal state and visual injury can all change independently of time.
      if(index===10)game.selected.delete(0);
      if(index===20)game.agents[1].path=[{x:game.agents[1].x+1,y:game.agents[1].y}];
      if(index===30)game.agents[2].hp-=10;
      if(index===40)game.relay.done=true;
      if(index===50)game.vault.done=true;
      if(index===60)game.phase='won';
      if(index===70)game.agents[3].hp=0;
      if(index===80)game.agents[1].path=[];
      if(index===90)game.selected.add(0);
      if(index===100)hover.x=2;
      renderer.pan(.5,-.2);
    } else if(name==='active-patrol') {
      if(index%2===0)tick(game,STEP);
    } else {
      game.time=index*STEP;
      game.selected=new Set(index%2?[0,2]:[1,3]);
      game.relay.done=index%11>4;game.vault.done=game.relay.done&&index%17>9;
      for(const [i,a]of game.agents.entries()) {
        a.prevX=a.x;a.x+=index%2?.015:-.015;a.path=index%3?[{x:a.x+1,y:a.y}]:[];
        a.hp=a.maxHp-index%20;a.fear=index%5===0?1:0;a.stun=index%7===0?1:0;
      }
      for(const [i,g]of game.guards.entries()){
        g.hp=index%13===0&&i===0?0:g.maxHp-index%10;g.fear=i%3===index%3?1:0;g.stun=i%4===index%4?1:0;
      }
      game.effects=[
        {type:'shot',x:8,y:1.5,tx:10,ty:2.5,team:'agent',weapon:index%2?'shotgun':'issued',life:(120-index)/120,maxLife:1},
        {type:index%3===0?'panic':index%3===1?'pulse':'order',x:9,y:2.5,life:(120-index)/120,maxLife:1},
      ];
      hover.x=8+index%3;hover.y=1.5;
      renderer.cutaway=index%10===0;
    }
    const alpha=name==='active-patrol'||name==='changing-combat'?(index%2?.75:.25):1;
    renderer.render(game,name==='briefing-camera'?null:hover,alpha,1/60);
  }};
}
