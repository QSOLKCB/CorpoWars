// SPDX-License-Identifier: Apache-2.0
// Keep the original contract mechanics, then secure every district control node.
export function captureKeys(game) { return game.mission.kind==='escort' ? ['relay', ...(game.captureKeys ?? []), 'vault'] : ['relay', 'vault', ...(game.captureKeys ?? [])]; }
export function objectiveKeys(game) { return [...captureKeys(game), 'exit']; }
export function capturesComplete(game) { return captureKeys(game).every(key => game[key].done); }
export function currentObjectiveKey(game) { return captureKeys(game).find(key => !game[key].done) ?? 'exit'; }
export function objectiveLabel(game, key) {
  return key === 'relay' ? game.mission.labels[0] : key === 'vault' ? game.mission.labels[1] : key === 'exit' ? 'EXTRACT' : game[key].label;
}
