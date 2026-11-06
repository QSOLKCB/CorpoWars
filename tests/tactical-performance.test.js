// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import {tacticalParity} from '../scripts/tactical-performance.mjs';
for(let i=0;i<6;i++)test(`map ${i+1}: retained objectives and partial uploads preserve exact complete render output`,()=>tacticalParity(i));
