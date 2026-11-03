// SPDX-License-Identifier: Apache-2.0
// Pure campaign/economy data. Weapon values are fictional game balance.
import { CHALLENGES } from './challenges.js';
export const STARTING_CASH = 6000;
export const SAVE_KEY = 'corpowars-campaign-v1';
export const DIFFICULTIES = {
  relaxed: { name: 'Relaxed', hp: 65, damage: 4, speed: 1.65, interval: 1.25, fearScale: 1, extraGuards: 0 },
  hostile: { name: 'Hostile', hp: 100, damage: 7, speed: 2.1, interval: .9, fearScale: .65, extraGuards: 4 },
};
// hp/damage/speed/interval multiply the selected difficulty's base guard values.
// Range, detection and armour are absolute, so original guards retain v0.3 values.
export const ENEMY_TYPES = {
  guard: { name: 'Security', hp: 1, damage: 1, speed: 1, interval: 1, range: 5.8, detection: 9, armour: 0 },
  bulwark: { name: 'Bulwark', hp: 1.8, damage: 1.25, speed: .72, interval: 1.15, range: 4.8, detection: 9, armour: .25 },
  marksman: { name: 'Marksman', hp: .8, damage: 2, speed: .85, interval: 1.65, range: 9, detection: 11, armour: 0 },
};
export const WEAPONS = {
  issued: { name: 'Issued PDW', calibre: 'Standard', cost: 0, magazine: 12, interval: .52, reloadTime: 1.8, damage: 10, range: 6.5 },
  owen: { name: 'Owen Gun', calibre: '9mm · SMG', cost: 700, magazine: 33, interval: .20, reloadTime: 1.65, damage: 7, range: 6.2 },
  aug: { name: 'AUG', calibre: '.223 / 9mm / .300 BLK', cost: 1400, magazine: 30, interval: .32, reloadTime: 1.9, damage: 12, range: 8 },
  shotgun: { name: 'Over & Under', calibre: '12g · fast reload', cost: 950, magazine: 2, interval: .23, reloadTime: .7, damage: 32, range: 4.8 },
};
export const AUG_MODES = [
  { name: '.223', magazine: 30, interval: .32, reloadTime: 1.9, damage: 12, range: 8 },
  { name: '9mm', magazine: 32, interval: .17, reloadTime: 1.5, damage: 7, range: 6 },
  { name: '.300 Blackout', magazine: 20, interval: .55, reloadTime: 2, damage: 23, range: 8.5 },
];
export const RESEARCH = [
  { id: 'med1', branch: 'MEDICAL', name: 'Trauma chemistry', cost: 800, requires: [], description: 'Med kits restore 85 HP to each selected living agent.' },
  { id: 'med2', branch: 'MEDICAL', name: 'Field surgery', cost: 1100, requires: ['med1'], description: 'Four med kits per mission, restoring 110 HP each.' },
  { id: 'head', branch: 'AUGMENTATIONS', name: 'Head · threat optics', cost: 850, requires: [], description: '+1 weapon range. Faster terminal hacking.' },
  { id: 'arms', branch: 'AUGMENTATIONS', name: 'Arms · recoil servos', cost: 900, requires: ['head'], description: '18% shorter firing interval; 15% faster reloads.' },
  { id: 'torso', branch: 'AUGMENTATIONS', name: 'Torso · subdermal mesh', cost: 1200, requires: [], description: '+30 maximum HP and 20% incoming damage reduction.' },
  { id: 'legs', branch: 'AUGMENTATIONS', name: 'Legs · kinetic tendons', cost: 900, requires: ['torso'], description: '+18% movement speed for the whole squad.' },
  { id: 'panic1', branch: 'PANIC', name: 'Dread amplifier', cost: 800, requires: [], description: 'Panic reaches 9 tiles, lasts 8 seconds; recharges in 18 seconds.' },
  { id: 'panic2', branch: 'PANIC', name: 'Neural aftershock', cost: 1300, requires: ['panic1', 'head'], description: 'Panic lasts 11 seconds and recharges in 14 seconds.' },
];
export const MISSIONS = [
  { id: 'breakwater', name: 'Hostile Takeover', district: 'Breakwater', seed: 2091, layout: 0, reward: 2400, parTime: 100,
    brief: 'Sever the district relay, steal the debt ledger, and extract every survivor.',
    relay: [11.5,18.5], vault: [28.5,11.5], exit: [5.5,29.5], spawn: [4.5,29.5],
    objectives: ['Sever the uplink','Acquire the ledger'], labels: ['RELAY','LEDGER'],
    guards: [[16.5,29.5],[11.5,20.5],[20.5,20.5],[29.5,20.5],[29.5,11.5],[24.5,11.5],[20.5,6.5],[11.5,8.5]],
    reinforcements: [[29.5,2.5],[2.5,20.5],[20.5,29.5]] },
  { id: 'foundry', name: 'Ghost Shift', district: 'Blackglass Foundry', seed: 3187, layout: 1, reward: 3200, parTime: 115,
    brief: 'Enter from the north. Cut the foundry alarm, recover the worker release codes, then reach the southern freight gate.',
    relay: [20.5,11.5], vault: [11.5,28.5], exit: [29.5,29.5], spawn: [4.5,2.5],
    objectives: ['Silence the foundry','Free the shift workers'], labels: ['ALARM','RELEASE CODES'],
    guards: [[11.5,2.5],[20.5,8.5],[20.5,16.5],[11.5,20.5],[8.5,29.5],[17.5,29.5],[29.5,20.5],[29.5,29.5],[2.5,20.5],[29.5,11.5]],
    reinforcements: [[20.5,29.5],[29.5,20.5],[2.5,29.5]] },
  { id: 'spire', name: 'Boardroom Blackout', district: 'Meridian Spire', seed: 5407, layout: 2, reward: 4000, parTime: 130,
    brief: 'Breach from the east. Kill the executive shield, seize the ownership registry, and escape through the western service route.',
    relay: [29.5,20.5], vault: [11.5,11.5], exit: [2.5,20.5], spawn: [28.5,2.5],
    objectives: ['Drop the executive shield','Seize the ownership registry'], labels: ['SHIELD','REGISTRY'],
    guards: [[29.5,8.5],[29.5,14.5],[24.5,20.5],[20.5,20.5],[20.5,11.5],[11.5,11.5],[11.5,16.5],[8.5,20.5],[2.5,20.5],[11.5,2.5],[20.5,2.5],[2.5,11.5]],
    reinforcements: [[2.5,11.5],[11.5,20.5],[20.5,11.5],[2.5,29.5]] },
  { id: 'copperline', name: 'Signal Siege', district: 'Copperline Grid', seed: 7229, layout: 3, reward: 4800, parTime: 45,
    kind: 'hold', relayDuration: 3, vaultDuration: 12,
    brief: 'Restore the copperline relay, hold the transmitter for twelve uncontested seconds against two security waves, then extract to the north-east.',
    relay: [11.5,29.5], vault: [20.5,20.5], exit: [29.5,2.5], spawn: [2.5,29.5],
    objectives: ['Restore the carrier','Hold the transmitter'], labels: ['CARRIER','TRANSMITTER'],
    guards: [[11.5,26.5],[20.5,29.5,'bulwark'],[20.5,23.5],[23.5,20.5,'marksman'],[29.5,11.5],[29.5,5.5,'marksman']],
    waves: [
      { at: 0, guards: [[20.5,11.5,'guard'],[29.5,20.5,'marksman']] },
      { at: 6, guards: [[11.5,20.5,'bulwark'],[29.5,29.5,'guard']] },
    ],
    reinforcements: [[29.5,2.5,'guard'],[20.5,2.5,'marksman']] },
  { id: 'coldstore', name: 'Witness Protection', district: 'Cold Storage', seed: 8317, layout: 4, reward: 5600, parTime: 35,
    kind: 'escort', relayDuration: 3, vaultDuration: 4, courier: { hp: 120, speed: 2.8 },
    brief: 'Disable the cryostore lock, release the courier, and escort them west to the transfer gate. Keep a living agent within six unobstructed tiles so the courier can follow the exit route; courier death terminates the contract.',
    relay: [29.5,20.5], vault: [20.5,11.5], exit: [2.5,11.5], spawn: [28.5,29.5],
    objectives: ['Disable the cryolock','Release the courier'], labels: ['CRYOLOCK','COURIER'],
    guards: [[29.5,24.5,'bulwark'],[29.5,14.5],[26.5,11.5,'marksman'],[20.5,8.5],[17.5,11.5],[11.5,11.5,'bulwark'],[8.5,11.5,'marksman'],[2.5,20.5]],
    reinforcements: [[11.5,2.5,'marksman'],[2.5,11.5,'guard']] },
  { id: 'exchange', name: 'Golden Parachute', district: 'Obsidian Exchange', seed: 9613, layout: 5, reward: 7200, parTime: 45,
    kind: 'lockdown', relayDuration: 3, vaultDuration: 6, lockdown: { relaxed: 180, hostile: 120 },
    brief: 'Cut the exchange failsafe, seize the severance fund, then reach the north-west exit before lockdown. The countdown starts only when the failsafe is disabled: 180 seconds in Relaxed, 120 in Hostile.',
    relay: [11.5,20.5], vault: [29.5,11.5], exit: [2.5,2.5], spawn: [1.5,29.5],
    objectives: ['Disable the failsafe','Seize the severance fund'], labels: ['FAILSAFE','SEVERANCE FUND'],
    guards: [[8.5,29.5],[11.5,23.5,'bulwark'],[14.5,20.5,'marksman'],[20.5,20.5],[29.5,17.5,'bulwark'],[29.5,11.5],[23.5,11.5,'marksman'],[20.5,2.5],[11.5,2.5,'bulwark'],[2.5,8.5,'marksman']],
    reinforcements: [[29.5,2.5,'marksman'],[20.5,11.5,'bulwark'],[2.5,11.5,'guard']] },
];

export function createCampaign() {
  return { version: 1, cash: STARTING_CASH, difficulty: 'relaxed', research: [], owned: Array.from({length:4},()=>['issued']), loadout: ['issued','issued','issued','issued'], modes: [0,0,0,0], completed: [], mission: 0, challenges: {} };
}
export function canResearch(c, id) {
  const item = RESEARCH.find(n=>n.id===id);
  return !!item && !c.research.includes(id) && item.requires.every(p=>c.research.includes(p)) && c.cash>=item.cost;
}
export function research(c, id) {
  if(!canResearch(c,id))return false;
  c.cash-=RESEARCH.find(n=>n.id===id).cost;c.research.push(id);return true;
}
export function equip(c, agent, id) {
  if(!Number.isInteger(agent)||agent<0||agent>3||!Object.hasOwn(WEAPONS,id))return false;
  if(!c.owned[agent].includes(id)) {
    if(c.cash<WEAPONS[id].cost)return false;
    c.cash-=WEAPONS[id].cost;c.owned[agent].push(id);
  }
  c.loadout[agent]=id;return true;
}
export function settleMission(c, mission, result) {
  if(result!=='won'||!Number.isInteger(mission)||mission<0||mission>=MISSIONS.length||!missionUnlocked(c,mission)||c.completed.includes(mission))return 0;
  c.completed.push(mission);c.cash+=MISSIONS[mission].reward;c.mission=Math.min(mission+1,MISSIONS.length-1);return MISSIONS[mission].reward;
}
export function missionUnlocked(c, index) {return Number.isInteger(index)&&index>=0&&index<MISSIONS.length&&(index===0||c.completed.includes(index-1));}

// Whitelist/reconstruct local saves; never spread unknown persisted objects into state.
export function decodeCampaign(text) {
  try {
    const s=JSON.parse(text),c=createCampaign();
    const maximumCash=STARTING_CASH+MISSIONS.reduce((sum,m)=>sum+m.reward,0);
    if(!s||s.version!==1||!Number.isSafeInteger(s.cash)||s.cash<0||s.cash>maximumCash)return null;
    if(!Object.hasOwn(DIFFICULTIES,s.difficulty??'relaxed'))return null;
    c.difficulty=s.difficulty??'relaxed';
    if(!Array.isArray(s.research)||new Set(s.research).size!==s.research.length||s.research.some(id=>!RESEARCH.some(n=>n.id===id)))return null;
    if(s.research.some(id=>!RESEARCH.find(n=>n.id===id).requires.every(p=>s.research.includes(p))))return null;
    if(!Array.isArray(s.completed)||s.completed.length>MISSIONS.length||s.completed.some((n,i)=>n!==i))return null;
    if(!Array.isArray(s.owned)||s.owned.length!==4||s.owned.some(a=>!Array.isArray(a)||!a.includes('issued')||new Set(a).size!==a.length||a.some(id=>!Object.hasOwn(WEAPONS,id))))return null;
    if(!Array.isArray(s.loadout)||s.loadout.length!==4||s.loadout.some((id,i)=>!s.owned[i].includes(id)))return null;
    if(!Array.isArray(s.modes)||s.modes.length!==4||s.modes.some(m=>!Number.isInteger(m)||m<0||m>2))return null;
    Object.assign(c,{cash:s.cash,research:[...s.research],completed:[...s.completed],owned:s.owned.map(a=>[...a]),loadout:[...s.loadout],modes:[...s.modes]});
    if(!missionUnlocked(c,s.mission))return null;c.mission=s.mission;
    const spent=c.research.reduce((sum,id)=>sum+RESEARCH.find(n=>n.id===id).cost,0)+c.owned.flat().reduce((sum,id)=>sum+WEAPONS[id].cost,0);
    if(c.cash!==STARTING_CASH+c.completed.reduce((sum,i)=>sum+MISSIONS[i].reward,0)-spent)return null;
    // This optional v1 field keeps prior saves valid, including a finished
    // three-contract campaign. Medals carry no credit value or unlock power.
    if(s.challenges!==undefined) {
      if(!s.challenges||typeof s.challenges!=='object'||Array.isArray(s.challenges))return null;
      const entries=Object.entries(s.challenges);
      if(entries.length>MISSIONS.length*Object.keys(DIFFICULTIES).length)return null;
      for(const [key,ids] of entries) {
        const mission=MISSIONS.findIndex(m=>Object.keys(DIFFICULTIES).some(d=>key===`${m.id}:${d}`));
        if(mission<0||!c.completed.includes(mission)||!Array.isArray(ids)||new Set(ids).size!==ids.length||ids.some(id=>!CHALLENGES.some(challenge=>challenge.id===id)))return null;
        c.challenges[key]=[...ids];
      }
    }
    return c;
  } catch {return null;}
}
