// SPDX-License-Identifier: Apache-2.0
import { WEAPONS, AUG_MODES, RESEARCH, MISSIONS, canResearch, research, equip, missionUnlocked } from './campaign.js';
import { CHALLENGES } from './challenges.js';
const $=id=>document.getElementById(id),money=n=>n.toLocaleString('en-AU');
const names=['VEX','NULL','ECHO','IRON'];
export function headquarters(getCampaign, changed, newCampaign) {
  let confirmReset=false;
  function feedback(text) {$('hq-feedback').textContent=text;}
  function refresh() {
    const focused=document.activeElement?.id;
    const c=getCampaign();$('cash').textContent=money(c.cash);
    $('difficulty').value=c.difficulty;
    $('mission-list').replaceChildren(...MISSIONS.map((mission,i)=>{
      const button=document.createElement('button');button.id=`contract-${i}`;button.className='contract-card';button.disabled=!missionUnlocked(c,i);button.setAttribute('aria-pressed',String(c.mission===i));
      const mechanic={hold:'HOLD THE TRANSMITTER',escort:'PROTECT THE COURIER',lockdown:'EXTRACT BEFORE LOCKDOWN'}[mission.kind]??'INFILTRATE · SEIZE · EXTRACT';
      const badges=c.challenges?.[`${mission.id}:${c.difficulty}`]??[];
      button.innerHTML=`<small>CONTRACT 0${i+1} / ${c.completed.includes(i)?'COMPLETE':button.disabled?'LOCKED':'AVAILABLE'}</small><strong>${mission.name}</strong><span>${mission.district}</span><small>${mechanic} · PAR ${mission.parTime}s</small><small>${c.completed.includes(i)?'REPLAY · NO REWARD':`PAYS ${money(mission.reward)} CR`}</small><small class="contract-medals">${badges.length?badges.map(id=>CHALLENGES.find(challenge=>challenge.id===id).name).join(' · '):'0 / 3 CHALLENGE BADGES'} · ${c.difficulty.toUpperCase()}</small>`;
      button.addEventListener('click',()=>{c.mission=i;changed();refresh();feedback(mission.brief);});return button;
    }));
    $('loadouts').replaceChildren(...names.map((name,i)=>{
      const card=document.createElement('article');card.className='loadout-card';
      const weapon=WEAPONS[c.loadout[i]],mode=c.loadout[i]==='aug'?AUG_MODES[c.modes[i]]:weapon;
      card.innerHTML=`<div><span class="eyebrow">AGENT 0${i+1}</span><h3>${name}</h3><span class="equipped">${weapon.name} · ${c.loadout[i]==='aug'?mode.name:weapon.calibre}</span></div><div class="weapon-options"></div><p class="weapon-stats">${mode.magazine} ROUNDS · ${mode.reloadTime}s RELOAD · ${mode.range} RANGE</p>`;
      for(const [id,w] of Object.entries(WEAPONS)) {
        const button=document.createElement('button'),owned=c.owned[i].includes(id);button.id=`equip-${i}-${id}`;button.setAttribute('aria-pressed',String(c.loadout[i]===id));button.disabled=!owned&&c.cash<w.cost;
        button.innerHTML=`${w.name}<small>${owned?'OWNED':`${money(w.cost)} CR`} · ${w.calibre}</small>`;
        button.addEventListener('click',()=>{if(equip(c,i,id)){changed();refresh();feedback(`${name}: ${w.name} equipped.${owned?'':` ${money(w.cost)} credits spent.`}`);}});card.querySelector('.weapon-options').append(button);
      }
      if(c.loadout[i]==='aug') {
        const label=document.createElement('label');label.className='mode-choice';label.textContent='Starting conversion ';
        const select=document.createElement('select');select.setAttribute('aria-label',`${name} AUG starting mode`);
        AUG_MODES.forEach((m,j)=>{const option=document.createElement('option');option.value=j;option.textContent=m.name;select.append(option);});select.value=c.modes[i];
        select.addEventListener('change',()=>{c.modes[i]=Number(select.value);changed();refresh();feedback(`${name}: ${AUG_MODES[c.modes[i]].name} selected.`);});label.append(select);card.append(label);
      }
      return card;
    }));
    $('research-tree').replaceChildren(...['MEDICAL','AUGMENTATIONS','PANIC'].map(branch=>{
      const column=document.createElement('section');column.className='research-branch';column.innerHTML=`<h3>${branch}</h3>`;
      for(const node of RESEARCH.filter(n=>n.branch===branch)) {
        const owned=c.research.includes(node.id),button=document.createElement('button');button.id=`research-${node.id}`;button.className='research-node';button.classList.toggle('installed',owned);button.classList.toggle('root-node',!node.requires.length);button.disabled=!canResearch(c,node.id);
        const missing=node.requires.filter(p=>!c.research.includes(p)).map(id=>RESEARCH.find(n=>n.id===id).name);
        button.innerHTML=`<small>${owned?'✓ INSTALLED':`${money(node.cost)} CR`}</small><strong>${node.name}</strong><span>${node.description}</span><small>${node.requires.length?'REQUIRES: '+node.requires.map(id=>RESEARCH.find(n=>n.id===id).name).join(' + '):'ENTRY NODE'}${!owned&&!missing.length&&c.cash<node.cost?' · INSUFFICIENT CREDITS':''}</small>`;
        button.addEventListener('click',()=>{if(research(c,node.id)){changed();refresh();feedback(`${node.name} installed for the entire squad.`);}});column.append(button);
      }return column;
    }));
    if(focused&&$(focused)&&!$(focused).disabled)$(focused).focus({preventScroll:true});
  }
  function tab(name) {
    for(const id of ['loadout','research']){$(`tab-${id}`).setAttribute('aria-selected',String(id===name));$(`tab-${id}`).tabIndex=id===name?0:-1;$(`${id}-panel`).hidden=id!==name;}
  }
  for(const name of ['loadout','research']) {
    $(`tab-${name}`).addEventListener('click',()=>tab(name));
    $(`tab-${name}`).addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();const next=event.key==='Home'?'loadout':event.key==='End'?'research':name==='loadout'?'research':'loadout';tab(next);$(`tab-${next}`).focus();}});
  }
  $('hq-close').addEventListener('click',()=>$('hq').close());$('hq-ready').addEventListener('click',()=>$('hq').close());
  $('difficulty').addEventListener('change',event=>{getCampaign().difficulty=event.target.value;changed();refresh();feedback(event.target.value==='hostile'?'Hostile: stronger, faster guards, four extra security units and shorter panic retreats.':'Relaxed: the original forgiving combat balance.');});
  $('new-campaign').addEventListener('click',()=>{
    if(!confirmReset){confirmReset=true;$('new-campaign').textContent='CONFIRM RESET — ERASE CAMPAIGN';feedback('This resets credits, purchases and completed contracts. Click again to confirm.');return;}
    newCampaign();confirmReset=false;$('new-campaign').textContent='NEW CAMPAIGN';refresh();feedback('New campaign. Starting budget: 6,000 credits.');
  });
  return {open(){confirmReset=false;$('new-campaign').textContent='NEW CAMPAIGN';feedback('');refresh();$('hq').showModal();},refresh};
}
