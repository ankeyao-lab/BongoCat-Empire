/* eslint-disable test/no-import-node-test -- Uses the established Node built-in runner. */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import englishCopy from './wardrobe-copy.en.json'
import { growthThemeIds, growthThemeRegistry, outfitThemeOptions } from './wizard-theme'
import { getLocalizedGrowthThemeRegistry, getLocalizedOutfitThemeOptions } from './wizard-theme-localized'

const proseFields = ['name', 'subtitle', 'chapter', 'hat', 'cape', 'prop', 'motion', 'story'] as const
const chineseText = /\p{Script=Han}/u

function withoutFields(value: object, omitted: readonly string[]): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([field]) => !omitted.includes(field)))
}

test('english copy covers the exact 12 themes and all 108 levels without Chinese prose', () => {
  assert.deepEqual(Object.keys(englishCopy).sort(), [...growthThemeIds].sort())
  const english = getLocalizedGrowthThemeRegistry('en-US')
  let levels = 0
  for (const id of growthThemeIds) {
    const theme = english[id]
    assert.equal(theme.levels.length, 9, id)
    for (const field of ['name', 'title'] as const) {
      assert.ok(theme[field].trim(), `${id}.${field}`)
      assert.ok(!chineseText.test(theme[field]), `${id}.${field}`)
    }
    assert.deepEqual(theme.levels.map(level => level.level), [1, 2, 3, 4, 5, 6, 7, 8, 9])
    for (const level of theme.levels) {
      levels += 1
      for (const field of proseFields) {
        assert.ok(level[field].trim(), `${id}.${level.level}.${field}`)
        assert.ok(!chineseText.test(level[field]), `${id}.${level.level}.${field}`)
      }
    }
  }
  assert.equal(levels, 108)
})

test('localization preserves every non-prose field in the canonical registry', () => {
  const english = getLocalizedGrowthThemeRegistry('en')
  for (const id of growthThemeIds) {
    const original = growthThemeRegistry[id]
    const localized = english[id]
    assert.deepEqual(withoutFields(localized, ['name', 'title', 'levels']), withoutFields(original, ['name', 'title', 'levels']), id)
    for (let index = 0; index < original.levels.length; index += 1) {
      assert.deepEqual(withoutFields(localized.levels[index], proseFields), withoutFields(original.levels[index], proseFields), `${id}.${index + 1}`)
    }
  }
})

test('chinese locales preserve the original registry and outfit options exactly', () => {
  for (const locale of ['zh', 'zh-CN', 'zh-TW', 'zh-HK', 'ZH-cn']) {
    assert.equal(getLocalizedGrowthThemeRegistry(locale), growthThemeRegistry)
    assert.equal(getLocalizedOutfitThemeOptions(locale), outfitThemeOptions)
  }
  assert.equal(growthThemeRegistry.wizard.name, '魔法师')
  assert.equal(growthThemeRegistry.wizard.levels[0].name, '初级魔法师')
})

test('all other locales use complete English outfit options with stable IDs', () => {
  for (const locale of ['en', 'en-US', 'en-GB', 'ja-JP', '']) {
    const options = getLocalizedOutfitThemeOptions(locale)
    assert.deepEqual(options.map(option => option.id), ['none', ...growthThemeIds])
    assert.equal(options[0].name, 'Original appearance')
    assert.equal(options.length, 13)
    for (const option of options) {
      assert.ok(option.name.trim())
      assert.ok(option.description.trim())
      assert.ok(!chineseText.test(`${option.name} ${option.description}`))
      if (option.id !== 'none') assert.equal(option.name, getLocalizedGrowthThemeRegistry(locale)[option.id].name)
    }
  }
})
