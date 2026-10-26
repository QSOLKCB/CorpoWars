// SPDX-License-Identifier: Apache-2.0
import { createGame, startGame, tick, STEP, selectAgents, orderMove, orderAttack, stopAgents, medkit, pulse, visibleGuard, clamp } from './simulation.js';
import { Renderer } from './renderer.js';
import { Audio } from './audio.js';

const $=id=>document.getElementById(id),canvas=$('battlefield'),sound=new Audio(),keys=new Set();
let game=createGame(),renderer,hover=null,drag=null,last=0,accumulator=0,lastUI=-1,finished=false,graphicsLost=false,helpWasPaused=false,lastLog='';
function graphicsError(message) {$('graphics-error').hidden=false;$('graphics-message').textContent=message;$('deploy').disabled=true;game.paused=true;}
try {renderer=new Renderer(canvas,game);} catch(error) {graphicsError(error.message);}
$('reload').addEventListener('click',()=>location.reload());
canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();graphicsLost=true;graphicsError('The graphics context was interrupted. Reconnect to restart the mission, or wait for your browser to restore it.');});
canvas.addEventListener('webglcontextrestored',()=>{
  try {const old=renderer;renderer=new Renderer(canvas,game);if(old){renderer.camera={...old.camera};renderer.zoom=old.zoom;}graphicsLost=false;$('graphics-error').hidden=true;$('deploy').disabled=false;}
  catch(error){graphicsError(error.message);}
});

for(const a of game.agents) {
  const button=document.createElement('button');button.className='agent selected';button.id=`agent-${a.id}`;button.setAttribute('aria-pressed','true');
  button.innerHTML=`<span class="agent-number">0${a.id+1}</span><span class="agent-info"><strong>${a.name}</strong><small>${a.role}</small><span class="health-track"><span></span></span><small class="health-text"></small></span>`;
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
function reset() {
  $('debrief').close();$('manual').close();game=createGame();finished=false;hover=null;lastLog='';accumulator=0;keys.clear();
  $('briefing').hidden=false;if(renderer){renderer.focus({x:14,y:22});renderer.zoom=1;renderer.cutaway=false;}
  $('cutaway').setAttribute('aria-pressed','false');updateUI();$('deploy').focus();
}
function setPause() {
  if(game.phase!=='active'||graphicsLost)return;
  game.paused=!game.paused;accumulator=0;updateUI();announce(game.paused?'Tactical pause. Orders can be issued.':'Simulation resumed.');
}
function autoPause() {keys.clear();cancelDrag();if(game.phase==='active'){game.paused=true;accumulator=0;updateUI();}}
function openManual() {helpWasPaused=game.paused;if(game.phase==='active')game.paused=true;keys.clear();$('manual').showModal();updateUI();}
$('manual').addEventListener('close',()=>{if(game.phase==='active'&&!graphicsLost){game.paused=helpWasPaused||document.hidden;updateUI();}canvas.focus();});
$('debrief').addEventListener('cancel',event=>event.preventDefault());
$('deploy').addEventListener('click',()=>{if(!renderer||graphicsLost)return;startGame(game);game.paused=false;$('briefing').hidden=true;focusSquad();renderer.zoom=1.15;canvas.focus();updateUI();});
$('sound').addEventListener('click',async()=>{const enabled=await sound.toggle();$('sound').setAttribute('aria-pressed',String(enabled));$('sound').querySelector('span').textContent=enabled?'ON':'OFF';});
$('help').addEventListener('click',openManual);
$('restart').addEventListener('click',reset);$('retry').addEventListener('click',reset);
$('select-all').addEventListener('click',()=>{selectAgents(game,game.agents.map(a=>a.id));updateUI();});
$('pause').addEventListener('click',setPause);
function heal() {if(!medkit(game))announce(game.paused?'Resume time to use a patch.':'Select an injured living agent.');updateUI();}
function emp() {if(!pulse(game))announce(game.paused?'Resume time to use EMP.':'Select a living agent with EMP charges available.');updateUI();}
function hold() {if(game.phase!=='active')return;game.holdFire=!game.holdFire;updateUI();}
function cutaway() {if(!renderer)return;renderer.cutaway=!renderer.cutaway;$('cutaway').setAttribute('aria-pressed',String(renderer.cutaway));}
$('medkit').addEventListener('click',heal);$('pulse').addEventListener('click',emp);$('hold-fire').addEventListener('click',hold);
$('focus').addEventListener('click',focusSquad);$('cutaway').addEventListener('click',cutaway);
$('zoom-in').addEventListener('click',()=>renderer?.zoomBy(1.2));$('zoom-out').addEventListener('click',()=>renderer?.zoomBy(1/1.2));
for(const key of ['relay','vault','exit']) $(`${key}-order`).addEventListener('click',()=>{
  const p=game[key];if(orderMove(game,p.x,p.y)){renderer?.focus(p);announce(`Squad ordered to ${key==='exit'?'extraction':key}.`);}updateUI();
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
  if(drag.button===1)renderer.pan(drag.last.x-p.x,drag.last.y-p.y);
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
  // The square drawing is letterboxed by object-fit in the desktop layout.
  const side=Math.min(rect.width,rect.height),ox=(rect.width-side)/2,oy=(rect.height-side)/2;
  renderer.focus({x:clamp((event.clientX-rect.left-ox)/side*36,0,36),y:clamp((event.clientY-rect.top-oy)/side*36,0,36)});
});
document.addEventListener('keydown',event=>{
  if($('manual').open||$('debrief').open||event.ctrlKey||event.metaKey||event.altKey||/INPUT|TEXTAREA|SELECT/.test(event.target.tagName))return;
  const key=event.key.toLowerCase();
  if([' ','arrowup','arrowdown','arrowleft','arrowright','escape'].includes(key))event.preventDefault();
  if(event.repeat)return;
  if(key==='?'){openManual();return;}
  if(!renderer||graphicsLost)return;
  keys.add(key);
  if(key===' ')setPause();
  else if(/^[1-4]$/.test(key)){selectAgents(game,[Number(key)-1],event.shiftKey);updateUI();}
  else if(key==='a'){selectAgents(game,game.agents.map(a=>a.id));updateUI();}
  else if(key==='f')focusSquad();
  else if(key==='t')cutaway();
  else if(key==='m')heal();
  else if(key==='x')emp();
  else if(key==='h')hold();
  else if(key==='escape')stopAgents(game);
  else if(key==='+'||key==='=')renderer.zoomBy(1.2);
  else if(key==='-')renderer.zoomBy(1/1.2);
});
document.addEventListener('keyup',event=>keys.delete(event.key.toLowerCase()));
window.addEventListener('blur',autoPause);
document.addEventListener('visibilitychange',()=>{if(document.hidden)autoPause();});

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
  $('result-copy').textContent=won?'The ledger is yours. Breakwater has a new creditor. Your agents are off the grid.':'The district remains under corporate control. Review your approach, keep the squad together, and use tactical pause.';
  $('result-stats').innerHTML=`<span><b>${timeText(game.time)}</b>ELAPSED</span><span><b>${alive}/4</b>EXTRACTED</span><span><b>${game.kills}</b>HOSTILES</span>`;
  $('best-result').textContent='';
  if(won)try {
    const key='corpowars-best-v1',stored=Number(localStorage.getItem(key)),best=stored>0&&Number.isFinite(stored)?Math.min(stored,game.time):game.time;
    localStorage.setItem(key,String(best));$('best-result').textContent=`LOCAL BEST: ${timeText(best)} · This browser only.`;
  } catch {$('best-result').textContent='Local record saving is unavailable in this browser.';}
  $('debrief').showModal();
}

function updateUI() {
  $('clock').textContent=timeText(game.time);
  $('phase').textContent=game.phase==='briefing'?'AWAITING DEPLOYMENT':game.phase==='won'?'CONTRACT COMPLETE':game.phase==='lost'?'CONTRACT TERMINATED':game.paused?'TACTICAL PAUSE':game.alert>0?'SECURITY ALERT':'OPERATION ACTIVE';
  $('sector-state').textContent=game.alert>0?'SECURITY CONTACT / WEAPONS LIVE':'BREAKWATER / SECTOR 09';
  $('pause-banner').hidden=!game.paused||game.phase!=='active'||graphicsLost;
  $('pause').innerHTML=game.paused?'RESUME <kbd>SPACE</kbd>':'PAUSE <kbd>SPACE</kbd>';
  const active=game.phase==='active';$('pause').disabled=!active;
  $('hold-fire').textContent=game.holdFire?'HOLDING FIRE':'FIRE AT WILL';$('hold-fire').setAttribute('aria-pressed',String(game.holdFire));$('hold-fire').disabled=!active;
  $('medkit').querySelector('span').textContent=String(game.medkits).padStart(2,'0');$('medkit').disabled=!active||game.medkits===0||game.paused;
  $('pulse').querySelector('span').textContent=String(game.pulses).padStart(2,'0');$('pulse').disabled=!active||game.pulses===0||game.paused;
  for(const a of game.agents) {
    const b=$(`agent-${a.id}`);b.classList.toggle('selected',game.selected.has(a.id));b.classList.toggle('dead',a.hp<=0);b.setAttribute('aria-pressed',String(game.selected.has(a.id)));b.disabled=a.hp<=0;
    b.querySelector('.health-track span').style.width=`${a.hp/a.maxHp*100}%`;b.querySelector('.health-text').textContent=a.hp<=0?'OFFLINE':`${a.hp} HP / ${a.reload>0?'RELOAD':`${a.ammo}/12`}`;
    b.setAttribute('aria-label',`${a.name}, ${a.role}, ${a.hp} health${game.selected.has(a.id)?', selected':''}`);
  }
  const objective=game.relay.done?game.vault.done?'exit':'vault':'relay';
  for(const key of ['relay','vault','exit']) {
    const done=key==='exit'?game.phase==='won':game[key].done;
    $(`${key}-order`).classList.toggle('current',key===objective&&!done);$(`${key}-order`).classList.toggle('done',done);$(`${key}-order`).disabled=!active;
    $(`${key}-order`).querySelector('.objective-num').textContent=done?'✓':key==='relay'?'01':key==='vault'?'02':'03';
    const percent=key==='relay'?game.relay.progress/3:key==='vault'?game.vault.progress/5:game.extraction/2;
    $(`${key}-progress`).style.width=`${Math.min(100,percent*100)}%`;
  }
  const logKey=game.log.map(l=>`${l.time}:${l.text}`).join('|');
  if(lastLog!==logKey){lastLog=logKey;$('comms').replaceChildren(...game.log.slice(0,3).map(l=>{const el=document.createElement('li');el.textContent=l.text;return el;}));if(game.log[0])announce(game.log[0].text);}
  const selected=game.agents.filter(a=>a.hp>0&&game.selected.has(a.id)).length;
  $('context-hint').textContent=active?`${selected} SELECTED / CLICK TO MOVE / SPACE TO PLAN`:'SELECT · COMMAND · ACQUIRE';
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
  const delta=Math.min((now-last)/1000||0,.1);last=now;
  if(renderer&&!graphicsLost) {
    const speed=400*delta;
    if(keys.has('arrowleft'))renderer.pan(-speed,0);if(keys.has('arrowright'))renderer.pan(speed,0);if(keys.has('arrowup'))renderer.pan(0,-speed);if(keys.has('arrowdown'))renderer.pan(0,speed);
    if(game.phase==='active'&&!game.paused){accumulator+=delta;while(accumulator>=STEP){tick(game);accumulator-=STEP;}}
    else accumulator=0;
    for(const event of game.events)sound.play(event.type);game.events=[];
    renderer.render(game,hover);updateLabels();
    if(now-lastUI>100){updateUI();drawMap();lastUI=now;}
  }
  requestAnimationFrame(frame);
}
updateUI();requestAnimationFrame(frame);
