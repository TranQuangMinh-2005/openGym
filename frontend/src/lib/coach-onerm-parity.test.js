import { describe, it, expect } from 'vitest';
import { estimate1RM as app } from './onerm.js';
import { estimate1RM as agent, FORMULAS } from '../../../api/coach/agent/tools/onerm.js';

describe('agent 1RM formula parity', () => {
  it('matches every formula over valid and missing sets', () => {
    for (const formula of [...Object.keys(FORMULAS), 'weighted', 'unknown']) {
      for (const weight of [undefined, null, 0, -5, 20, 100, Infinity]) {
        for (const reps of [undefined, 0, 1, 5, 8.5, 12, 15, 16]) {
          for (const rir of [null, 0, 2, 5]) {
            expect(agent(weight, reps, formula, rir)).toEqual(app(weight, reps, formula, rir));
          }
        }
      }
    }
  });
});
