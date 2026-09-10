/* eslint-disable test/no-import-node-test -- Uses the established Node built-in runner. */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { defaultWeeklyThresholds, weeklyThresholds } from './growth-plan'

test('weekly defaults mean 25,000 cumulative presses to level nine', () => {
  assert.deepEqual(defaultWeeklyThresholds, [0, 750, 2500, 5000, 8750, 12500, 16250, 20500, 25000])
  assert.equal(weeklyThresholds(5000, 7)[8], 35000)
})

test('tiny plans retain nine distinct levels and invalid plans fail', () => {
  assert.deepEqual(weeklyThresholds(8, 1), [0, 1, 2, 3, 4, 5, 6, 7, 8])
  for (const args of [[7, 1], [0, 5], [5000, 0], [5000, 8], [0.5, 5], [5000, 2.5], [Number.NaN, 5], [Number.MAX_SAFE_INTEGER, 7]]) {
    assert.throws(() => weeklyThresholds(args[0], args[1]))
  }
})

test('large safe plans match exact integer rounding without multiplication precision loss', () => {
  const daily = Math.floor(Number.MAX_SAFE_INTEGER / 7)
  const percentages = [0n, 3n, 10n, 20n, 35n, 50n, 65n, 82n, 100n]
  for (let days = 1; days <= 7; days += 1) {
    for (const budget of [daily, daily - 1, daily - 41]) {
      const target = BigInt(budget) * BigInt(days)
      const exact = percentages.map(percent => Number((target * percent + 50n) / 100n))
      assert.deepEqual(weeklyThresholds(budget, days), exact)
    }
  }
})
