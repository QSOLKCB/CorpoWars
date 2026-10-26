// SPDX-License-Identifier: Apache-2.0
import { readdir, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
for(const directory of ['src','scripts','tests'])for(const file of await readdir(directory)) {
  if(/\.(js|mjs|cjs)$/.test(file))execFileSync(process.execPath,['--check',`${directory}/${file}`]);
}
const html=await readFile('index.html','utf8');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
assert.equal(new Set(ids).size,ids.length,'HTML IDs must be unique');
for(const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
  if(/^(https?:|\.\/$)/.test(match[1]))continue;
  await readFile(match[1]);
}
for(const file of await readdir('src')) {
  const text=await readFile(`src/${file}`,'utf8');
  assert.doesNotMatch(text,/\b(?:fetch|XMLHttpRequest|WebSocket)\s*\(/,`Unexpected runtime network dependency in ${file}`);
}
console.log('JavaScript syntax, HTML references, unique IDs, and offline runtime checks passed.');
