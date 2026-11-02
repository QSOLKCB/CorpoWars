// SPDX-License-Identifier: Apache-2.0
// Pure campaign/economy data. Weapon values are fictional game balance.
export const STARTING_CASH = 6000;
export const SAVE_KEY = 'corpowars-campaign-v1';
export const DIFFICULTIES = {
  relaxed: { name: 'Relaxed', hp: 65, damage: 4, speed: 1.65, interval: 1.25, fearScale: 1, extraGuards: 0 },
  hostile: { name: 'Hostile', hp: 100, damage: 7, speed: 2.1, interval: .9, fearScale: .65, extraGuards: 4 },
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
  { id: 'breakwater', name: 'Hostile Takeover', district: 'Breakwater', seed: 2091, layout: 0, reward: 2400,
    brief: 'Sever the district relay, steal the debt ledger, and extract every survivor.',
    relay: [11.5,18.5], vault: [28.5,11.5], exit: [5.5,29.5], spawn: [4.5,29.5],
    objectives: ['Sever the uplink','Acquire the ledger'], labels: ['RELAY','LEDGER'],
    guards: [[16.5,29.5],[11.5,20.5],[20.5,20.5],[29.5,20.5],[29.5,11.5],[24.5,11.5],[20.5,6.5],[11.5,8.5]],
    reinforcements: [[29.5,2.5],[2.5,20.5],[20.5,29.5]] },
  { id: 'foundry', name: 'Ghost Shift', district: 'Blackglass Foundry', seed: 3187, layout: 1, reward: 3200,
    brief: 'Enter from the north. Cut the foundry alarm, recover the worker release codes, then reach the southern freight gate.',
    relay: [20.5,11.5], vault: [11.5,28.5], exit: [29.5,29.5], spawn: [4.5,2.5],
    objectives: ['Silence the foundry','Free the shift workers'], labels: ['ALARM','RELEASE CODES'],
    guards: [[11.5,2.5],[20.5,8.5],[20.5,16.5],[11.5,20.5],[8.5,29.5],[17.5,29.5],[29.5,20.5],[29.5,29.5],[2.5,20.5],[29.5,11.5]],
    reinforcements: [[20.5,29.5],[29.5,20.5],[2.5,29.5]] },
  { id: 'spire', name: 'Boardroom Blackout', district: 'Meridian Spire', seed: 5407, layout: 2, reward: 4000,
    brief: 'Breach from the east. Kill the executive shield, seize the ownership registry, and escape through the western service route.',
    relay: [29.5,20.5], vault: [11.5,11.5], exit: [2.5,20.5], spawn: [28.5,2.5],
    objectives: ['Drop the executive shield','Seize the ownership registry'], labels: ['SHIELD','REGISTRY'],
    guards: [[29.5,8.5],[29.5,14.5],[24.5,20.5],[20.5,20.5],[20.5,11.5],[11.5,11.5],[11.5,16.5],[8.5,20.5],[2.5,20.5],[11.5,2.5],[20.5,2.5],[2.5,11.5]],
    reinforcements: [[2.5,11.5],[11.5,20.5],[20.5,11.5],[2.5,29.5]] },
];

export function createCampaign() {
  return { version: 1, cash: STARTING_CASH, difficulty: 'relaxed', research: [], owned: Array.from({length:4},()=>['issued']), loadout: ['issued','issued','issued','issued'], modes: [0,0,0,0], completed: [], mission: 0 };
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
    if(!s||s.version!==1||!Number.isSafeInteger(s.cash)||s.cash<0||s.cash>20000)return null;
    if(!Object.hasOwn(DIFFICULTIES,s.difficulty??'relaxed'))return null;
    c.difficulty=s.difficulty??'relaxed';
    if(!Array.isArray(s.research)||new Set(s.research).size!==s.research.length||s.research.some(id=>!RESEARCH.some(n=>n.id===id)))return null;
    if(s.research.some(id=>!RESEARCH.find(n=>n.id===id).requires.every(p=>s.research.includes(p))))return null;
    if(!Array.isArray(s.completed)||s.completed.length>3||s.completed.some((n,i)=>n!==i))return null;
    if(!Array.isArray(s.owned)||s.owned.length!==4||s.owned.some(a=>!Array.isArray(a)||!a.includes('issued')||new Set(a).size!==a.length||a.some(id=>!Object.hasOwn(WEAPONS,id))))return null;
    if(!Array.isArray(s.loadout)||s.loadout.length!==4||s.loadout.some((id,i)=>!s.owned[i].includes(id)))return null;
    if(!Array.isArray(s.modes)||s.modes.length!==4||s.modes.some(m=>!Number.isInteger(m)||m<0||m>2))return null;
    Object.assign(c,{cash:s.cash,research:[...s.research],completed:[...s.completed],owned:s.owned.map(a=>[...a]),loadout:[...s.loadout],modes:[...s.modes]});
    if(!missionUnlocked(c,s.mission))return null;c.mission=s.mission;
    const spent=c.research.reduce((sum,id)=>sum+RESEARCH.find(n=>n.id===id).cost,0)+c.owned.flat().reduce((sum,id)=>sum+WEAPONS[id].cost,0);
    if(c.cash!==STARTING_CASH+c.completed.reduce((sum,i)=>sum+MISSIONS[i].reward,0)-spent)return null;
    return c;
  } catch {return null;}
}
