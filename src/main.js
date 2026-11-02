// SPDX-License-Identifier: Apache-2.0
import { createGame, startGame, tick, STEP, selectAgents, orderMove, orderAttack, stopAgents, medkit, pulse, visibleGuard, clamp, cycleMode, togglePanic } from './simulation.js';
import { createCampaign, decodeCampaign, SAVE_KEY, WEAPONS, AUG_MODES, settleMission } from './campaign.js';
import { headquarters } from './headquarters.js';
import { Renderer } from './renderer.js';
import { Audio } from './audio.js';

const $=id=>document.getElementById(id),canvas=$('battlefield'),sound=new Audio(),keys=new Set();
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
}
const labels={};
for(const [key,text] of [['relay','01 / RELAY'],['vault','02 / LEDGER'],['exit','03 / EXTRACT']]) {
  const label=document.createElement('span');label.className='world-label';label.textContent=text;$('world-labels').append(label);labels[key]=label;
}

function focusSquad() {
  if(!renderer)return;
  let living=game.agents.filter(a=>a.hp>0&&game.selected.has(a.id));if(!living.length)living=game.agents.filter(a=>a.hp>0);if(!living.length)return;
  renderer.focus({x:living.reduce((sum,a)=>sum+a.x,0)/living.length,y:living.reduce((sum,a)=>sum+a.y,0)/living.length});
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
function autoPause() {keys.clear();panDirection=null;cancelDrag();sound.audible(false);if(game.phase==='active'){game.paused=true;accumulator=0;updateUI();}}
function openManual() {helpWasPaused=game.paused;if(game.phase==='active')game.paused=true;keys.clear();$('manual').showModal();updateUI();}
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
function cutaway() {if(!renderer)return;renderer.cutaway=!renderer.cutaway;$('cutaway').setAttribute('aria-pressed',String(renderer.cutaway));}
$('medkit').addEventListener('click',heal);$('pulse').addEventListener('click',emp);$('hold-fire').addEventListener('click',hold);
$('panic').addEventListener('click',panic);$('aug-mode').addEventListener('click',augMode);
$('focus').addEventListener('click',focusSquad);$('cutaway').addEventListener('click',cutaway);
$('quality').addEventListener('click',()=>{if(!renderer)return;renderer.pixelRatio=renderer.pixelRatio===2?1:2;$('quality').setAttribute('aria-pressed',String(renderer.pixelRatio===1));});
function setFollow(value) {follow=value;$('follow').setAttribute('aria-pressed',String(value));}
$('follow').addEventListener('click',()=>{setFollow(!follow);if(follow)focusSquad();});
for(const [direction,vector] of Object.entries({up:[0,-1],left:[-1,0],down:[0,1],right:[1,0]})) {
  const button=$(`pan-${direction}`);
  button.addEventListener('pointerdown',event=>{setFollow(false);panDirection=vector;button.setPointerCapture(event.pointerId);event.preventDefault();});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,()=>{panDirection=null;});
  button.addEventListener('click',event=>{if(event.detail===0){setFollow(false);renderer?.pan(vector[0]*80,vector[1]*80);}});
}
$('zoom-in').addEventListener('click',()=>renderer?.zoomBy(1.2));$('zoom-out').addEventListener('click',()=>renderer?.zoomBy(1/1.2));
for(const key of ['relay','vault','exit']) $(`${key}-order`).addEventListener('click',()=>{
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
    const box=$('selection-box');box.hidden=false;box.style.left=`${Math.min(p.x,drag.start.x)}px`;box.style.top=`${Math.min(p.y,drag.start.y)}px`;box.style.width=`${Math.abs(p.x-drag.start.x)}px`;box.style.height=`${Math.abs(p.y-drag.start.y)}px`;
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
  else if(key==='escape')stopAgents(game);
  else if(key==='+'||key==='=')renderer.zoomBy(1.2);
  else if(key==='-')renderer.zoomBy(1/1.2);
});
document.addEventListener('keyup',event=>keys.delete(event.key.toLowerCase()));
window.addEventListener('blur',autoPause);
window.addEventListener('focus',()=>sound.audible(!document.hidden));
document.addEventListener('visibilitychange',()=>{if(document.hidden)autoPause();else sound.audible(true);});

const map=$('minimap').getContext('2d');
function drawMap() {
  if(!map||!renderer)return;const s=6;map.fillStyle='#10191b';map.fillRect(0,0,216,216);
  for(const b of game.world.buildings){map.fillStyle='#394846';map.fillRect(b.x*s,b.y*s,b.w*s,b.d*s);}
  for(const p of [game.relay,game.vault,game.exit]){map.strokeStyle='#91af9e';map.strokeRect(p.x*s-3,p.y*s-3,6,6);}
  for(const e of game.guards)if(visibleGuard(game,e)){map.fillStyle='#d1816c';map.fillRect(e.x*s-2,e.y*s-2,4,4);}
  for(const a of game.agents)if(a.hp>0){map.fillStyle=game.selected.has(a.id)?'#ead48a':'#acbca4';map.fillRect(a.x*s-2,a.y*s-2,4,4);}
  const corners=[[0,0],[renderer.width,0],[renderer.width,renderer.height],[0,renderer.height]].map(([x,y])=>renderer.unproject(x,y));
  map.strokeStyle='#cfbf7955';map.lineWidth=1;map.beginPath();corners.forEach((p,i)=>i?map.lineTo(p.x*s,p.y*s):map.moveTo(p.x*s,p.y*s));map.closePath();map.stroke();
}
function timeText(time){return `${String(Math.floor(time/60)).padStart(2,'0')}:${String(Math.floor(time%60)).padStart(2,'0')}`;}
function showDebrief() {
  if(finished)return;finished=true;const won=game.phase==='won',alive=game.agents.filter(a=>a.hp>0).length;
  $('result-title').textContent=won?'CONTRACT FULFILLED.':'ASSETS LIQUIDATED.';
  const reward=settleMission(campaign,game.missionIndex,game.phase);saveCampaign();
  $('result-copy').textContent=won?`${game.mission.district} contract complete. ${reward?`${reward.toLocaleString('en-AU')} credits paid.`:'Replay complete; this contract has already paid out.'} ${campaign.completed.length===3?'All three districts are free of corporate control.':'Return to headquarters to refit for the next district.'}`:'The district remains under corporate control. Your equipment is retained. Refit and retry.';
  $('result-stats').innerHTML=`<span><b>${timeText(game.time)}</b>ELAPSED</span><span><b>${alive}/4</b>EXTRACTED</span><span><b>${game.kills}</b>HOSTILES</span>`;
  $('best-result').textContent='';
  if(won)try {
    const key=`corpowars-best-v2-${game.mission.id}-${game.difficulty.name}`,stored=Number(localStorage.getItem(key)),best=stored>0&&Number.isFinite(stored)?Math.min(stored,game.time):game.time;
    localStorage.setItem(key,String(best));$('best-result').textContent=`LOCAL BEST: ${timeText(best)} · This browser only.`;
  } catch {$('best-result').textContent='Local record saving is unavailable in this browser.';}
  $('debrief').showModal();
}

function updateUI() {
  $('operation-id').textContent=`OPERATION 00${game.missionIndex+1} / ${game.mission.district.toUpperCase()} / ${game.difficulty.name.toUpperCase()}`;
  $('operation-name').textContent=game.mission.name.toUpperCase();$('mission-directive').textContent=game.mission.brief;
  $('brief-copy').textContent=game.mission.brief;$('brief-cash').textContent=campaign.cash.toLocaleString('en-AU');
  $('headquarters').disabled=game.phase!=='briefing';
  $('clock').textContent=timeText(game.time);
  $('phase').textContent=game.phase==='briefing'?'AWAITING DEPLOYMENT':game.phase==='won'?'CONTRACT COMPLETE':game.phase==='lost'?'CONTRACT TERMINATED':game.paused?'TACTICAL PAUSE':game.alert>0?'SECURITY ALERT':'OPERATION ACTIVE';
  $('sector-state').textContent=game.alert>0?'SECURITY CONTACT / WEAPONS LIVE':game.mission.district.toUpperCase();
  $('pause-banner').hidden=!game.paused||game.phase!=='active'||graphicsLost;
  $('pause').innerHTML=game.paused?'RESUME <kbd>SPACE</kbd>':'PAUSE <kbd>SPACE</kbd>';
  const active=game.phase==='active';$('pause').disabled=!active;
  $('hold-fire').textContent=game.holdFire?'HOLDING FIRE':'FIRE AT WILL';$('hold-fire').setAttribute('aria-pressed',String(game.holdFire));$('hold-fire').disabled=!active;
  $('medkit').querySelector('span').textContent=String(game.medkits).padStart(2,'0');$('medkit').disabled=!active||game.medkits===0||game.paused;
  $('pulse').querySelector('span').textContent=String(game.pulses).padStart(2,'0');$('pulse').disabled=!active||game.pulses===0||game.paused;
  $('panic').setAttribute('aria-pressed',String(game.panicEnabled));$('panic').disabled=!active;
  $('panic').querySelector('span').textContent=game.panicCooldown>0?`${Math.ceil(game.panicCooldown)}s`:game.panicEnabled?'ARMED':'OFF';
  $('aug-mode').disabled=!active||!game.agents.some(a=>a.hp>0&&game.selected.has(a.id)&&a.weapon==='aug');
  for(const a of game.agents) {
    const b=$(`agent-${a.id}`);b.classList.toggle('selected',game.selected.has(a.id));b.classList.toggle('dead',a.hp<=0);b.setAttribute('aria-pressed',String(game.selected.has(a.id)));b.disabled=a.hp<=0;
    b.querySelector('.health-track span').style.width=`${a.hp/a.maxHp*100}%`;b.querySelector('.health-text').textContent=a.hp<=0?'OFFLINE':`${a.hp} HP / ${a.reload>0?'RELOAD':`${a.ammo}/${a.magazine}`}`;
    b.querySelector('.weapon-name').textContent=a.weapon==='aug'?`AUG · ${AUG_MODES[a.mode].name}`:WEAPONS[a.weapon].name;
    b.setAttribute('aria-label',`${a.name}, ${a.role}, ${a.hp} health${game.selected.has(a.id)?', selected':''}`);
  }
  const objective=game.relay.done?game.vault.done?'exit':'vault':'relay';
  for(const key of ['relay','vault','exit']) {
    const done=key==='exit'?game.phase==='won':game[key].done;
    if(key!=='exit'){$(`${key}-order`).querySelector('strong').textContent=game.mission.objectives[key==='relay'?0:1];$(`${key}-order`).querySelector('small').textContent=game.mission.labels[key==='relay'?0:1];labels[key].textContent=`${key==='relay'?'01':'02'} / ${game.mission.labels[key==='relay'?0:1]}`;}
    $(`${key}-order`).classList.toggle('current',key===objective&&!done);$(`${key}-order`).classList.toggle('done',done);$(`${key}-order`).disabled=!active;
    $(`${key}-order`).querySelector('.objective-num').textContent=done?'✓':key==='relay'?'01':key==='vault'?'02':'03';
    const percent=key==='relay'?game.relay.progress/3:key==='vault'?game.vault.progress/5:game.extraction/2;
    $(`${key}-progress`).style.width=`${Math.min(100,percent*100)}%`;
  }
  const logKey=game.log.map(l=>`${l.time}:${l.text}`).join('|');
  if(lastLog!==logKey){lastLog=logKey;$('comms').replaceChildren(...game.log.slice(0,3).map(l=>{const el=document.createElement('li');el.textContent=l.text;return el;}));if(game.log[0])announce(game.log[0].text);}
  const selected=game.agents.filter(a=>a.hp>0&&game.selected.has(a.id)).length;
  $('context-hint').textContent=active?`${selected} SELECTED / WASD CAMERA / Q SELECT ALL / SPACE PAUSE`:'SELECT · RESEARCH · DEPLOY';
  if(game.phase==='won'||game.phase==='lost')showDebrief();
}
function updateLabels() {
  for(const key of ['relay','vault','exit']) {
    const p=game[key],s=renderer.project(p.x,p.y,key==='exit'?.2:1.2),label=labels[key];
    label.style.left=`${s.x}px`;label.style.top=`${s.y}px`;
    label.hidden=s.x<0||s.y<40||s.x>renderer.width||s.y>renderer.height-30;
    label.classList.toggle('inactive',key==='relay'?game.relay.done:key==='vault'?!game.relay.done||game.vault.done:!game.vault.done);
  }
}
function frame(now) {
  const elapsed=(now-last)/1000||0,delta=Math.min(elapsed,.1);last=now;
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
    fpsFrames++;fpsElapsed+=elapsed;if(fpsElapsed>=1){$('render-status').textContent=`WEBGL2 / ${Math.round(fpsFrames/fpsElapsed)} FPS`;fpsFrames=0;fpsElapsed=0;}
    if(now-lastUI>100){updateUI();drawMap();lastUI=now;}
  }
  requestAnimationFrame(frame);
}
updateUI();requestAnimationFrame(frame);
