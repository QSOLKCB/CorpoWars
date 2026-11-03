// SPDX-License-Identifier: Apache-2.0
import { createGame, startGame, tick, STEP, selectAgents, orderMove, orderAttack, orderEscort, objectiveDuration, stopAgents, medkit, pulse, visibleGuard, clamp, cycleMode, togglePanic } from './simulation.js';
import { createCampaign, decodeCampaign, SAVE_KEY, WEAPONS, AUG_MODES, MISSIONS, settleMission } from './campaign.js';
import { challengeResults, recordChallenges } from './challenges.js';
import { headquarters } from './headquarters.js';
import { Renderer } from './renderer.js';
import { Audio } from './audio.js';
import { writeProperty as prop, writeStyle as style, writeAttribute as attr, writeClass as css, MinimapBackground } from './runtime.js';

const elements=new Map();
const $=id=>{let element=elements.get(id);if(!element){element=document.getElementById(id);if(element)elements.set(id,element);}return element;};
const canvas=$('battlefield'),sound=new Audio(),keys=new Set(),agentUI=new Map();
let campaign=createCampaign(),saveNotice='Progress is saved in this browser.';
try {const saved=localStorage.getItem(SAVE_KEY);if(saved){const decoded=decodeCampaign(saved);if(decoded)campaign=decoded;else saveNotice='An incompatible campaign save was ignored. A new campaign is ready.';}}catch{saveNotice='Browser storage is unavailable. Progress lasts for this session.';}
let game=createGame(undefined,campaign),renderer,hover=null,drag=null,last=0,accumulator=0,lastUI=-1,finished=false,graphicsLost=false,helpWasPaused=false,lastLog='',follow=false,panDirection=null;
let fpsFrames=0,fpsElapsed=0;
function graphicsError(message) {$('graphics-error').hidden=false;$('graphics-message').textContent=message;$('deploy').disabled=true;game.paused=true;}
try {renderer=new Renderer(canvas,game);} catch(error) {graphicsError(error.message);}
$('reload').addEventListener('click',()=>location.reload());
canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();graphicsLost=true;graphicsError('The graphics context was interrupted. Reconnect to restart the mission, or wait for your browser to restore it.');});
canvas.addEventListener('webglcontextrestored',()=>{
  try {const old=renderer;renderer=new Renderer(canvas,game);if(old){renderer.focus(old.camera,true);renderer.zoom=old.zoom;renderer.cutaway=old.cutaway;renderer.pixelRatio=old.pixelRatio;}graphicsLost=false;$('graphics-error').hidden=true;$('deploy').disabled=false;}
  catch(error){graphicsError(error.message);}
});

for(const a of game.agents) {
  const button=document.createElement('button');button.className='agent selected';button.id=`agent-${a.id}`;button.setAttribute('aria-pressed','true');
  button.innerHTML=`<span class="agent-number">0${a.id+1}</span><span class="agent-info"><strong>${a.name}</strong><small class="weapon-name">${a.role}</small><span class="health-track"><span></span></span><small class="health-text"></small></span>`;
  button.addEventListener('click',event=>{selectAgents(game,[a.id],event.shiftKey);updateUI();});
  button.addEventListener('dblclick',()=>focusSquad());$('agents').append(button);
  agentUI.set(a.id,{button,health:button.querySelector('.health-track span'),healthText:button.querySelector('.health-text'),weapon:button.querySelector('.weapon-name')});
}
const labels={};
for(const [key,text] of [['relay','01 / RELAY'],['vault','02 / LEDGER'],['exit','03 / EXTRACT']]) {
  const label=document.createElement('span');label.className='world-label';label.textContent=text;$('world-labels').append(label);labels[key]=label;
}
labels.courier=$('courier-label');$('world-labels').append(labels.courier);

const objectiveUI={};
for(const key of ['relay','vault','exit']) {
  const button=$(`${key}-order`);
  objectiveUI[key]={button,title:button.querySelector('strong'),copy:button.querySelector('small'),number:button.querySelector('.objective-num'),progress:$(`${key}-progress`)};
}
const abilityCounts={medkit:$('medkit').querySelector('span'),pulse:$('pulse').querySelector('span'),panic:$('panic').querySelector('span')};

function focusSquad() {
  if(!renderer)return;
  let x=0,y=0,count=0;
  for(const a of game.agents)if(a.hp>0&&game.selected.has(a.id)){x+=a.x;y+=a.y;count++;}
  if(!count)for(const a of game.agents)if(a.hp>0){x+=a.x;y+=a.y;count++;}
  if(count)renderer.focus({x:x/count,y:y/count});
}
function announce(text) {$('announcement').textContent=text;}
function saveCampaign() {
  try {localStorage.setItem(SAVE_KEY,JSON.stringify(campaign));saveNotice='Campaign saved in this browser. Mission positions are not saved.';}
  catch{saveNotice='Browser storage is unavailable. Progress lasts for this session.';}
  $('save-status').textContent=saveNotice;
}
function prepareMission(index=campaign.mission) {
  const previous=game.missionIndex;game=createGame(undefined,campaign,index);finished=false;hover=null;lastLog='';accumulator=0;keys.clear();panDirection=null;cancelDrag();
  if(renderer){if(previous!==index)renderer.makeCity(game.world);renderer.focus({x:game.mission.spawn[0]+1.5,y:game.mission.spawn[1]},true);}
  updateUI();
}
const hq=headquarters(()=>campaign,()=>{saveCampaign();prepareMission();},()=>{campaign=createCampaign();saveCampaign();prepareMission();});
function openHQ() {if(game.phase!=='briefing')return;keys.clear();panDirection=null;$('save-status').textContent=saveNotice;hq.open();}
$('headquarters').addEventListener('click',openHQ);$('brief-hq').addEventListener('click',openHQ);
$('hq').addEventListener('close',()=>{keys.clear();$('deploy').focus();});
function reset(index=game.missionIndex) {
  $('debrief').close();$('manual').close();prepareMission(index);
  $('briefing').hidden=false;if(renderer){renderer.zoom=1;renderer.cutaway=false;}
  $('cutaway').setAttribute('aria-pressed','false');updateUI();$('deploy').focus();
}
function setPause() {
  if(game.phase!=='active'||graphicsLost)return;
  game.paused=!game.paused;accumulator=0;updateUI();announce(game.paused?'Tactical pause. Orders can be issued.':'Simulation resumed.');
}
function autoPause() {keys.clear();panDirection=null;cancelDrag();last=0;fpsFrames=0;fpsElapsed=0;sound.audible(false);if(game.phase==='active'){game.paused=true;accumulator=0;updateUI();}}
function openManual() {helpWasPaused=game.paused;if(game.phase==='active')game.paused=true;accumulator=0;keys.clear();panDirection=null;cancelDrag();$('manual').showModal();updateUI();}
$('manual').addEventListener('close',()=>{if(game.phase==='active'&&!graphicsLost){game.paused=helpWasPaused||document.hidden;updateUI();canvas.focus();}});
$('debrief').addEventListener('cancel',event=>event.preventDefault());
$('deploy').addEventListener('click',()=>{if(!renderer||graphicsLost)return;startGame(game);game.paused=false;$('briefing').hidden=true;focusSquad();renderer.zoom=1.15;canvas.focus();updateUI();});
$('sound').addEventListener('click',async()=>{const enabled=await sound.toggle();$('sound').setAttribute('aria-pressed',String(enabled));$('sound').querySelector('span').textContent=enabled?'ON':'OFF';});
$('music').addEventListener('click',async()=>{const enabled=await sound.toggleMusic();$('music').setAttribute('aria-pressed',String(enabled));$('music').querySelector('span').textContent=enabled?'ON':'OFF';if(!enabled&&!sound.context)announce('Audio is unavailable in this browser.');});
$('music-volume').addEventListener('input',event=>sound.setVolume(Number(event.target.value)/100));
$('help').addEventListener('click',openManual);
$('restart').addEventListener('click',()=>reset());$('retry').addEventListener('click',()=>{reset(campaign.mission);openHQ();});
$('select-all').addEventListener('click',()=>{selectAgents(game,game.agents.map(a=>a.id));updateUI();});
$('pause').addEventListener('click',setPause);
function heal() {if(!medkit(game))announce(game.paused?'Resume time to use a patch.':'Select an injured living agent.');updateUI();}
function emp() {if(!pulse(game))announce(game.paused?'Resume time to use EMP.':'Select a living agent with EMP charges available.');updateUI();}
function hold() {if(game.phase!=='active')return;game.holdFire=!game.holdFire;updateUI();}
function panic() {togglePanic(game);updateUI();}
function augMode() {if(!cycleMode(game))announce('Select an agent carrying an AUG.');updateUI();}
function escort() {
  if(orderEscort(game)){setFollow(true);renderer?.focus(game.courier);announce('Escort detail assigned. Stay close to protect the courier.');}
  else announce('Release the courier and select living agents to form an escort detail.');
  updateUI();
}
function cutaway() {if(!renderer)return;renderer.cutaway=!renderer.cutaway;$('cutaway').setAttribute('aria-pressed',String(renderer.cutaway));}
$('medkit').addEventListener('click',heal);$('pulse').addEventListener('click',emp);$('hold-fire').addEventListener('click',hold);
$('panic').addEventListener('click',panic);$('aug-mode').addEventListener('click',augMode);
$('escort-order').addEventListener('click',escort);
$('focus').addEventListener('click',focusSquad);$('cutaway').addEventListener('click',cutaway);
$('quality').addEventListener('click',()=>{if(!renderer)return;renderer.pixelRatio=renderer.pixelRatio===2?1:2;$('quality').setAttribute('aria-pressed',String(renderer.pixelRatio===1));});
function setFollow(value) {follow=value;attr($('follow'),'aria-pressed',String(value));}
$('follow').addEventListener('click',()=>{setFollow(!follow);if(follow)focusSquad();});
for(const [direction,vector] of Object.entries({up:[0,-1],left:[-1,0],down:[0,1],right:[1,0]})) {
  const button=$(`pan-${direction}`);
  button.addEventListener('pointerdown',event=>{setFollow(false);panDirection=vector;button.setPointerCapture(event.pointerId);event.preventDefault();});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,()=>{panDirection=null;});
  button.addEventListener('click',event=>{if(event.detail===0){setFollow(false);renderer?.pan(vector[0]*80,vector[1]*80);}});
}
$('zoom-in').addEventListener('click',()=>renderer?.zoomBy(1.2));$('zoom-out').addEventListener('click',()=>renderer?.zoomBy(1/1.2));
for(const key of ['relay','vault','exit']) $(`${key}-order`).addEventListener('click',()=>{
  if(key==='exit'&&game.courier?.active){escort();return;}
  const p=game[key];if(orderMove(game,p.x,p.y)){setFollow(false);renderer?.focus(p);announce(`Squad ordered to ${key==='exit'?'extraction':key}.`);}updateUI();
});

function local(event) {const rect=canvas.getBoundingClientRect();return {x:event.clientX-rect.left,y:event.clientY-rect.top};}
function pickUnit(point,units) {
  let closest=null,best=18;
  for(const unit of units) {
    if(unit.hp<=0)continue;
    const p=renderer.project(unit.x,unit.y,.65),d=Math.hypot(p.x-point.x,p.y-point.y);
    if(d<best){closest=unit;best=d;}
  }
  return closest;
}
function cancelDrag() {drag=null;$('selection-box').hidden=true;}
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointerdown',event=>{
  if(!renderer||graphicsLost||game.phase!=='active'||drag)return;
  canvas.focus();const p=local(event);drag={id:event.pointerId,button:event.button,start:p,last:p,shift:event.shiftKey};canvas.setPointerCapture(event.pointerId);event.preventDefault();
});
canvas.addEventListener('pointermove',event=>{
  if(!renderer)return;const p=local(event);hover=renderer.unproject(p.x,p.y);
  if(!drag||drag.id!==event.pointerId)return;
  if(drag.button===1){setFollow(false);renderer.pan(drag.last.x-p.x,drag.last.y-p.y);}
  else if(drag.button===0&&Math.hypot(p.x-drag.start.x,p.y-drag.start.y)>7) {
    const box=$('selection-box');box.hidden=false;style(box.style,'left',`${Math.min(p.x,drag.start.x)}px`);style(box.style,'top',`${Math.min(p.y,drag.start.y)}px`);style(box.style,'width',`${Math.abs(p.x-drag.start.x)}px`);style(box.style,'height',`${Math.abs(p.y-drag.start.y)}px`);
  }
  drag.last=p;
});
canvas.addEventListener('pointerup',event=>{
  if(!drag||drag.id!==event.pointerId||!renderer)return;
  const d=drag,p=local(event);cancelDrag();if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);
  if(d.button===1)return;
  if(d.button===0&&Math.hypot(p.x-d.start.x,p.y-d.start.y)>7) {
    const ids=game.agents.filter(a=>{const s=renderer.project(a.x,a.y,.65);return s.x>=Math.min(p.x,d.start.x)&&s.x<=Math.max(p.x,d.start.x)&&s.y>=Math.min(p.y,d.start.y)&&s.y<=Math.max(p.y,d.start.y);}).map(a=>a.id);
    selectAgents(game,ids,d.shift);
  } else {
    const agent=d.button===0?pickUnit(p,game.agents):null,enemy=pickUnit(p,game.guards.filter(e=>visibleGuard(game,e)));
    if(agent)selectAgents(game,[agent.id],d.shift);
    else if(enemy)orderAttack(game,enemy.id);
    else {const world=renderer.unproject(p.x,p.y);orderMove(game,world.x,world.y);}
  }
  updateUI();
});
canvas.addEventListener('pointercancel',cancelDrag);canvas.addEventListener('lostpointercapture',cancelDrag);
canvas.addEventListener('pointerleave',()=>{hover=null;});
canvas.addEventListener('wheel',event=>{event.preventDefault();if(renderer)renderer.zoomBy(event.deltaY>0?.9:1.1);},{passive:false});
$('minimap').addEventListener('click',event=>{
  if(!renderer)return;const rect=$('minimap').getBoundingClientRect();
  setFollow(false);
  // The square drawing is letterboxed by object-fit in the desktop layout.
  const side=Math.min(rect.width,rect.height),ox=(rect.width-side)/2,oy=(rect.height-side)/2;
  renderer.focus({x:clamp((event.clientX-rect.left-ox)/side*36,0,36),y:clamp((event.clientY-rect.top-oy)/side*36,0,36)});
});
document.addEventListener('keydown',event=>{
  if($('manual').open||$('debrief').open||$('hq').open||event.ctrlKey||event.metaKey||event.altKey||/INPUT|TEXTAREA|SELECT/.test(event.target.tagName))return;
  const key=event.key.toLowerCase();
  if(key==='?'&&!event.repeat){openManual();return;}
  // Keep native keyboard activation (especially Space on Deploy) in menus.
  if(game.phase!=='active')return;
  if([' ','w','a','s','d','arrowup','arrowdown','arrowleft','arrowright','escape'].includes(key))event.preventDefault();
  if(event.repeat)return;
  if(!renderer||graphicsLost)return;
  keys.add(key);
  if(key===' ')setPause();
  else if(/^[1-4]$/.test(key)){selectAgents(game,[Number(key)-1],event.shiftKey);updateUI();}
  else if(key==='q'){selectAgents(game,game.agents.map(a=>a.id));updateUI();}
  else if(key==='f')focusSquad();
  else if(key==='t')cutaway();
  else if(key==='m')heal();
  else if(key==='x')emp();
  else if(key==='h')hold();
  else if(key==='p')panic();
  else if(key==='b')augMode();
  else if(key==='c')escort();
  else if(key==='escape')stopAgents(game);
  else if(key==='+'||key==='=')renderer.zoomBy(1.2);
  else if(key==='-')renderer.zoomBy(1/1.2);
});
document.addEventListener('keyup',event=>keys.delete(event.key.toLowerCase()));
window.addEventListener('blur',autoPause);
window.addEventListener('focus',()=>sound.audible(!document.hidden));
document.addEventListener('visibilitychange',()=>{if(document.hidden)autoPause();else sound.audible(true);});

const map=$('minimap').getContext('2d'),mapBackground=new MinimapBackground(document.createElement('canvas'));
function drawMap() {
  if(!map||!renderer)return;const s=6;mapBackground.draw(map,game);
  map.fillStyle='#d1816c';
  for(const e of game.guards)if(visibleGuard(game,e))map.fillRect(e.x*s-2,e.y*s-2,4,4);
  for(const a of game.agents)if(a.hp>0){map.fillStyle=game.selected.has(a.id)?'#ead48a':'#acbca4';map.fillRect(a.x*s-2,a.y*s-2,4,4);}
  if(game.courier){
    const c=game.courier;map.fillStyle=c.hp<=0?'#657c80':c.active?'#80d7df':'#527b88';
    map.fillRect(c.x*s-2.5,c.y*s-2.5,5,5);
    map.strokeStyle='#c7eff1';map.strokeRect(c.x*s-3.5,c.y*s-3.5,7,7);
  }
  map.strokeStyle='#cfbf7955';map.lineWidth=1;map.beginPath();
  let p=renderer.unproject(0,0);map.moveTo(p.x*s,p.y*s);
  p=renderer.unproject(renderer.width,0);map.lineTo(p.x*s,p.y*s);
  p=renderer.unproject(renderer.width,renderer.height);map.lineTo(p.x*s,p.y*s);
  p=renderer.unproject(0,renderer.height);map.lineTo(p.x*s,p.y*s);
  map.closePath();map.stroke();
}
function timeText(time){return `${String(Math.floor(time/60)).padStart(2,'0')}:${String(Math.floor(time%60)).padStart(2,'0')}`;}
function showDebrief() {
  if(finished)return;finished=true;const won=game.phase==='won',alive=game.agents.filter(a=>a.hp>0).length;
  $('result-title').textContent=won?'CONTRACT FULFILLED.':'ASSETS LIQUIDATED.';
  const reward=settleMission(campaign,game.missionIndex,game.phase);recordChallenges(campaign,game);saveCampaign();
  $('result-copy').textContent=won?`${game.mission.district} contract complete. ${reward?`${reward.toLocaleString('en-AU')} credits paid.`:'Replay complete; this contract has already paid out.'} ${campaign.completed.length===MISSIONS.length?'All six districts are free of corporate control.':'Return to headquarters to refit for the next district.'}`:game.courier?.hp<=0?'The courier was lost. Your equipment is retained. Refit and retry.':game.lockdownRemaining===0?'The corporate lockdown sealed the district. Your equipment is retained. Refit and retry.':'The district remains under corporate control. Your equipment is retained. Refit and retry.';
  $('result-stats').innerHTML=`<span><b>${timeText(game.time)}</b>ELAPSED</span><span><b>${alive}/4</b>EXTRACTED</span><span><b>${game.kills}</b>HOSTILES</span>`;
  const challenges=challengeResults(game),earned=challenges.filter(c=>c.earned).length;
  $('challenge-summary').textContent=`OPTIONAL CHALLENGES · ${earned}/${challenges.length} EARNED · ${game.difficulty.name.toUpperCase()}`;
  $('challenge-results').replaceChildren(...challenges.map(challenge=>{
    const card=document.createElement('li');card.id=`challenge-${challenge.id}`;card.className='challenge-result';card.classList.toggle('earned',challenge.earned);card.dataset.earned=String(challenge.earned);
    const name=document.createElement('strong'),description=document.createElement('span');
    name.textContent=`${challenge.earned?'✓':'—'} ${challenge.name}`;description.textContent=challenge.description;card.append(name,description);return card;
  }));
  $('best-result').textContent='';
  if(won)try {
    const key=`corpowars-best-v2-${game.mission.id}-${game.difficulty.name}`,stored=Number(localStorage.getItem(key)),best=stored>0&&Number.isFinite(stored)?Math.min(stored,game.time):game.time;
    localStorage.setItem(key,String(best));$('best-result').textContent=`LOCAL BEST: ${timeText(best)} · This browser only.`;
  } catch {$('best-result').textContent='Local record saving is unavailable in this browser.';}
  $('debrief').showModal();
}

function updateUI() {
  prop($('operation-id'),'textContent',`OPERATION 00${game.missionIndex+1} / ${game.mission.district.toUpperCase()} / ${game.difficulty.name.toUpperCase()}`);
  prop($('operation-name'),'textContent',game.mission.name.toUpperCase());prop($('mission-directive'),'textContent',game.mission.brief);
  prop($('brief-copy'),'textContent',game.mission.brief);prop($('brief-cash'),'textContent',campaign.cash.toLocaleString('en-AU'));
  prop($('brief-title'),'textContent',game.mission.kind==='hold'?'KEEP THE SIGNAL.':game.mission.kind==='escort'?'GET THEM OUT.':game.mission.kind==='lockdown'?'BEAT THE LOCKDOWN.':'POWER IS A HOSTILE ASSET.');
  prop($('brief-challenges'),'textContent',`OPTIONAL: ALL FOUR HOME · NO ABILITIES · UNDER ${timeText(game.mission.parTime)}`);
  prop($('headquarters'),'disabled',game.phase!=='briefing');
  prop($('clock'),'textContent',timeText(game.time));
  prop($('phase'),'textContent',game.phase==='briefing'?'AWAITING DEPLOYMENT':game.phase==='won'?'CONTRACT COMPLETE':game.phase==='lost'?'CONTRACT TERMINATED':game.paused?'TACTICAL PAUSE':game.alert>0?'SECURITY ALERT':'OPERATION ACTIVE');
  prop($('sector-state'),'textContent',game.alert>0?'SECURITY CONTACT / WEAPONS LIVE':game.mission.district.toUpperCase());
  prop($('pause-banner'),'hidden',!game.paused||game.phase!=='active'||graphicsLost);
  prop($('pause'),'innerHTML',game.paused?'RESUME <kbd>SPACE</kbd>':'PAUSE <kbd>SPACE</kbd>');
  const active=game.phase==='active';prop($('pause'),'disabled',!active);
  updateMissionStatus(active);
  prop($('hold-fire'),'textContent',game.holdFire?'HOLDING FIRE':'FIRE AT WILL');attr($('hold-fire'),'aria-pressed',String(game.holdFire));prop($('hold-fire'),'disabled',!active);
  prop(abilityCounts.medkit,'textContent',String(game.medkits).padStart(2,'0'));prop($('medkit'),'disabled',!active||game.medkits===0||game.paused);
  prop(abilityCounts.pulse,'textContent',String(game.pulses).padStart(2,'0'));prop($('pulse'),'disabled',!active||game.pulses===0||game.paused);
  attr($('panic'),'aria-pressed',String(game.panicEnabled));prop($('panic'),'disabled',!active);
  prop(abilityCounts.panic,'textContent',game.panicCooldown>0?`${Math.ceil(game.panicCooldown)}s`:game.panicEnabled?'ARMED':'OFF');
  prop($('aug-mode'),'disabled',!active||!game.agents.some(a=>a.hp>0&&game.selected.has(a.id)&&a.weapon==='aug'));
  for(const a of game.agents) {
    const ui=agentUI.get(a.id),b=ui.button,selected=game.selected.has(a.id);
    css(b,'selected',selected);css(b,'dead',a.hp<=0);attr(b,'aria-pressed',String(selected));prop(b,'disabled',a.hp<=0);
    style(ui.health.style,'width',`${a.hp/a.maxHp*100}%`);prop(ui.healthText,'textContent',a.hp<=0?'OFFLINE':`${a.hp} HP / ${a.reload>0?'RELOAD':`${a.ammo}/${a.magazine}`}`);
    prop(ui.weapon,'textContent',a.weapon==='aug'?`AUG · ${AUG_MODES[a.mode].name}`:WEAPONS[a.weapon].name);
    attr(b,'aria-label',`${a.name}, ${a.role}, ${a.hp} health${selected?', selected':''}`);
  }
  const objective=game.relay.done?game.vault.done?'exit':'vault':'relay';
  for(const key of ['relay','vault','exit']) {
    const done=key==='exit'?game.phase==='won':game[key].done,ui=objectiveUI[key];
    if(key!=='exit'){
      const index=key==='relay'?0:1;
      prop(ui.title,'textContent',game.mission.objectives[index]);prop(ui.copy,'textContent',game.mission.labels[index]);prop(labels[key],'textContent',`${key==='relay'?'01':'02'} / ${game.mission.labels[index]}`);
    }else{
      prop(ui.title,'textContent',game.courier?'Protect the courier home':'Leave no one behind');
      prop(ui.copy,'textContent',game.courier?'Courier and surviving agents must reach extraction':'Extract every surviving agent');
    }
    css(ui.button,'current',key===objective&&!done);css(ui.button,'done',done);prop(ui.button,'disabled',!active);
    prop(ui.number,'textContent',done?'✓':key==='relay'?'01':key==='vault'?'02':'03');
    const percent=(key==='exit'?game.extraction:game[key].progress)/objectiveDuration(game,key);
    style(ui.progress.style,'width',`${Math.min(100,percent*100)}%`);
  }
  const logKey=game.log.map(l=>`${l.time}:${l.text}`).join('|');
  if(lastLog!==logKey){lastLog=logKey;$('comms').replaceChildren(...game.log.slice(0,3).map(l=>{const el=document.createElement('li');el.textContent=l.text;return el;}));if(game.log[0])announce(game.log[0].text);}
  let selected=0;for(const a of game.agents)if(a.hp>0&&game.selected.has(a.id))selected++;
  prop($('context-hint'),'textContent',active?`${selected} SELECTED / WASD CAMERA / Q SELECT ALL / SPACE PAUSE`:'SELECT · RESEARCH · DEPLOY');
  if(game.phase==='won'||game.phase==='lost')showDebrief();
}
function updateMissionStatus(active) {
  const mission=game.mission,courier=game.courier;
  prop($('mission-console'),'hidden',!mission.kind);
  prop($('escort-order'),'hidden',!courier?.active);
  prop($('escort-order'),'disabled',!active||!courier||courier.hp<=0||!game.agents.some(a=>a.hp>0&&game.selected.has(a.id)));
  attr($('escort-order'),'aria-pressed',String(!!game.escortFollowing));
  prop($('courier-key'),'hidden',!courier);
  css($('radar'),'escort-radar',!!courier);
  let text='',urgent=false;
  if(mission.kind==='hold'){
    text=!game.relay.done?'SIEGE · DISABLE THE RELAY TO OPEN THE TRANSMITTER':game.vault.done?'TRANSMISSION COMPLETE · EXTRACT EVERY SURVIVING AGENT':game.holdContested?'TRANSMITTER CONTESTED · CLEAR NEARBY SECURITY TO CONTINUE':`HOLD TRANSMITTER · ${Math.floor(game.vault.progress)}/${objectiveDuration(game,'vault')}s · KEEP AN AGENT BESIDE THE TERMINAL`;
    urgent=!!game.holdContested;
  }else if(mission.kind==='escort'&&courier){
    text=!courier.active?'WITNESS SECURED · REACH AND RELEASE THE COURIER':courier.hp<=0?'COURIER LOST':`COURIER ${Math.ceil(courier.hp)}/${courier.maxHp} HP · ${game.escortFollowing?'ESCORT DETAIL ACTIVE':'STAY CLOSE · ASSIGN AN ESCORT DETAIL'}`;
    urgent=courier.active&&courier.hp<courier.maxHp*.35;
  }else if(mission.kind==='lockdown'){
    text=game.lockdownRemaining===null?'LOCKDOWN DORMANT · RELAY SABOTAGE STARTS THE EXTRACTION CLOCK':`LOCKDOWN IN ${timeText(Math.ceil(game.lockdownRemaining))} · ${game.vault.done?'REACH EXTRACTION':'SEIZE THE GOLDEN PARACHUTE'}`;
    urgent=game.lockdownRemaining!==null&&game.lockdownRemaining<=30;
  }
  prop($('mission-status'),'textContent',text);attr($('mission-status'),'title',text);css($('mission-console'),'urgent',urgent);
}
function updateLabels() {
  for(const key of ['relay','vault','exit']) {
    const p=game[key],s=renderer.project(p.x,p.y,key==='exit'?.2:1.2),label=labels[key];
    style(label.style,'left',`${s.x}px`);style(label.style,'top',`${s.y}px`);
    prop(label,'hidden',s.x<0||s.y<40||s.x>renderer.width||s.y>renderer.height-30);
    css(label,'inactive',key==='relay'?game.relay.done:key==='vault'?!game.relay.done||game.vault.done:!game.vault.done);
  }
  const courier=game.courier,label=labels.courier;
  if(!courier){prop(label,'hidden',true);return;}
  const s=renderer.project(courier.x,courier.y,1.4);
  style(label.style,'left',`${s.x}px`);style(label.style,'top',`${s.y}px`);
  prop(label,'hidden',s.x<0||s.y<40||s.x>renderer.width||s.y>renderer.height-30);
  prop(label,'textContent',courier.hp<=0?'COURIER LOST':courier.active?`COURIER / ${Math.ceil(courier.hp)} HP`:'COURIER / AWAITING RELEASE');
  css(label,'inactive',!courier.active||courier.hp<=0);
}
function frame(now) {
  if(document.hidden){last=0;requestAnimationFrame(frame);return;}
  const elapsed=last?Math.max(0,(now-last)/1000):0,delta=Math.min(elapsed,.1);last=now;
  if(renderer&&!graphicsLost) {
    const speed=400*delta;
    const dx=Number(keys.has('d')||keys.has('arrowright'))-Number(keys.has('a')||keys.has('arrowleft'))+(panDirection?.[0]||0);
    const dy=Number(keys.has('s')||keys.has('arrowdown'))-Number(keys.has('w')||keys.has('arrowup'))+(panDirection?.[1]||0);
    if(dx||dy){setFollow(false);renderer.pan(dx*speed,dy*speed);}else if(follow&&game.phase==='active')focusSquad();
    if(game.phase==='active'&&!game.paused){accumulator+=delta;while(accumulator>=STEP){tick(game);accumulator-=STEP;}}
    else accumulator=0;
    for(const event of game.events)sound.play(event.type);game.events=[];
    sound.mood(game.phase!=='active'?'briefing':game.paused?'paused':game.alert>0?'combat':'patrol');
    renderer.render(game,hover,game.phase==='active'&&!game.paused?accumulator/STEP:1,delta);updateLabels();
    fpsFrames++;fpsElapsed+=elapsed;if(fpsElapsed>=1){prop($('render-status'),'textContent',`WEBGL2 / ${Math.round(fpsFrames/fpsElapsed)} FPS`);fpsFrames=0;fpsElapsed=0;}
    if(now-lastUI>100){updateUI();drawMap();lastUI=now;}
  }
  requestAnimationFrame(frame);
}
updateUI();requestAnimationFrame(frame);
