// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import {polishBudget} from '../scripts/visual-polish-performance.mjs';
import {WORKLOADS} from '../scripts/visual-polish-fixtures.mjs';
for(const workload of WORKLOADS)test(`visual polish preserves v0.4 render budgets and unchanged layers: ${workload}`,()=>polishBudget(workload));
