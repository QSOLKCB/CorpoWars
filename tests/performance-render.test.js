// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import {rendererParity} from '../scripts/performance-render.mjs';
import {WORKLOADS} from '../scripts/performance-render-fixtures.mjs';
for(const workload of WORKLOADS)test(`renderer preserves exact v0.3.0 environment and tactical layers: ${workload}`,()=>rendererParity(workload));
