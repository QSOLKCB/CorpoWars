// SPDX-License-Identifier: Apache-2.0
import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
await rm(`${root}dist`,{recursive:true,force:true});
await mkdir(`${root}dist`,{recursive:true});
for(const path of ['index.html','style.css','favicon.svg','src','LICENSE','NOTICE']) {
  await cp(`${root}${path}`,`${root}dist/${path}`,{recursive:true});
}
await cp(`${root}.nojekyll`,`${root}dist/.nojekyll`);
console.log('Static game prepared in dist/ (no runtime dependencies).');
