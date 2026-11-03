// SPDX-License-Identifier: Apache-2.0
// Optional recognition only: challenge badges never mint credits or unlocks.
export const CHALLENGES = [
  { id: 'clean', name: 'Clean Extraction', description: 'Extract all four agents alive.' },
  { id: 'restraint', name: 'Economy of Force', description: 'Win without medical patches, EMP or panic bursts.' },
  { id: 'swift', name: 'Against the Clock', description: 'Complete the contract within its displayed par time.' },
];

export function challengeResults(game) {
  const won=game?.phase==='won',metrics=game?.metrics;
  const unused=metrics&&['medkitsUsed','empsUsed','panicBursts'].every(key=>Number.isSafeInteger(metrics[key])&&metrics[key]===0);
  const earned={
    clean: won&&game.agents?.length===4&&game.agents.every(a=>Number.isFinite(a.hp)&&a.hp>0),
    restraint: Boolean(won&&unused),
    swift: Boolean(won&&Number.isFinite(game.time)&&game.time>=0&&Number.isFinite(game.mission?.parTime)&&game.mission.parTime>0&&game.time<=game.mission.parTime),
  };
  return CHALLENGES.map(challenge=>({...challenge,earned:Boolean(earned[challenge.id])}));
}

export function recordChallenges(campaign,game) {
  if(game?.phase!=='won'||!Number.isInteger(game.missionIndex)||!campaign.completed.includes(game.missionIndex))return [];
  const difficulty=game.difficulty?.name?.toLowerCase(),id=game.mission?.id;
  if(!['relaxed','hostile'].includes(difficulty)||typeof id!=='string'||!/^[a-z0-9-]+$/.test(id))return [];
  const earned=challengeResults(game).filter(challenge=>challenge.earned).map(challenge=>challenge.id);
  const key=`${id}:${difficulty}`,previous=campaign.challenges?.[key]??[];
  campaign.challenges??={};
  campaign.challenges[key]=CHALLENGES.filter(challenge=>previous.includes(challenge.id)||earned.includes(challenge.id)).map(challenge=>challenge.id);
  return earned;
}
