// Integration checks against the real browser-only useGrowth implementation.
// No native API interception, installed app, or real growth file is used.
import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { mkdir } from 'node:fs/promises'
import process from 'node:process'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'

const baseURL = process.env.BONGO_PREVIEW_URL ?? 'http://127.0.0.1:1420'
const outputDirectory = new URL('./results/growth-weekly/', import.meta.url)
let browser

before(async () => {
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? '/Users/Harry/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs')
  await mkdir(outputDirectory, { recursive: true })
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
})
after(async () => browser?.close())

async function openDemo() {
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } })
  const pageErrors = []
  page.on('pageerror', error => pageErrors.push(error.message))
  const growthResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/src/composables/useGrowth.ts')
  await page.goto(`${baseURL}/?preview=growth`)
  await page.locator('#weekly-daily-budget').waitFor()
  const growthModuleURL = (await growthResponse).url()
  await page.evaluate(async (moduleURL) => {
    // Use the exact HMR-qualified module imported by the component, so the test
    // observes its singleton rather than creating a second demo store.
    const growth = (await import(moduleURL)).useGrowth()
    if (!growth.isDemo) throw new Error('This test must run only in the browser demo')
    window.__realDemoGrowth = growth
    await growth.reset()
  }, growthModuleURL)
  assert.deepEqual(pageErrors, [])
  return page
}

async function snapshot(page) {
  return page.evaluate(() => JSON.parse(JSON.stringify(window.__realDemoGrowth.state.value)))
}

test('the real demo switches both cultivation and wearing at LV9, even with auto-equip disabled', async () => {
  const page = await openDemo()
  await page.evaluate(async () => {
    await window.__realDemoGrowth.updateSettings({ autoEquip: false })
    await window.__realDemoGrowth.setOutfitTheme('none')
    await window.__realDemoGrowth.setDemoPresses(24000)
  })
  assert.equal((await snapshot(page)).growthThemeId, 'wizard')
  await page.locator('#demo-presses').evaluate((input) => {
    input.value = '25000'
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await page.waitForFunction(() => window.__realDemoGrowth.state.value.growthThemeId === 'astronaut')
  const next = await snapshot(page)
  assert.equal(next.outfitThemeId, 'astronaut')
  assert.equal(next.roundLevel, 1)
  assert.equal(next.roundPresses, 0)
  assert.equal(next.themes.wizard.unlockedLevel, 9)
  assert.equal(next.themes.wizard.presses, 25000)
  assert.match(await page.locator('.wearing-label').textContent(), /LV 1/)
  assert.match(await page.locator('.theme-badge').textContent(), /宇航/)
  await page.close()
})

test('completing all twelve themes starts round two while preserving all collections and totals', async () => {
  const page = await openDemo()
  await page.evaluate(async () => {
    for (let index = 0; index < 12; index += 1) await window.__realDemoGrowth.setDemoPresses(25000)
  })
  const result = await snapshot(page)
  assert.equal(result.cycleRound, 2)
  assert.equal(result.growthThemeId, 'wizard')
  assert.equal(result.outfitThemeId, 'wizard')
  assert.equal(result.roundLevel, 1)
  assert.equal(result.roundPresses, 0)
  assert.equal(result.equippedLevel, 1)
  assert.equal(result.totalPresses, 300000)
  for (const theme of Object.values(result.themes)) {
    assert.equal(theme.unlockedLevel, 9)
    assert.equal(theme.presses, 25000)
    assert.equal(theme.roundLevel, 1)
    assert.equal(theme.roundPresses, 0)
  }
  assert.equal(await page.locator('.outfit-card.locked').count(), 0)
  assert.match(await page.locator('.journey-content h2').textContent(), /LV 1/)
  assert.match(await page.locator('.chapter-label').textContent(), /第 2 轮/)
  await page.locator('.journey-card').screenshot({ path: fileURLToPath(new URL('real-demo-round-two.png', outputDirectory)) })
  await page.close()
})

test('changing the weekly plan preserves custom thresholds and the UI can restore weekly mode', async () => {
  const page = await openDemo()
  const custom = [0, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000]
  await page.evaluate(async (values) => {
    await window.__realDemoGrowth.updateSettings({ autoCycle: false })
    await window.__realDemoGrowth.setThresholds('wizard', values)
  }, custom)
  await page.locator('#weekly-daily-budget').fill('6000')
  await page.locator('#weekly-active-days').selectOption('7')
  await page.getByRole('button', { name: '保存每周节奏', exact: true }).click()
  await page.locator('.alert-success').waitFor()
  const changed = await snapshot(page)
  assert.equal(changed.weeklyTargetPresses, 42000)
  assert.deepEqual(changed.themes.wizard.thresholds, custom)
  assert.equal(changed.themes.wizard.thresholdMode, 'custom')
  assert.equal(changed.themes.astronaut.thresholds[8], 42000)
  await page.getByRole('button', { name: '当前主题恢复一周节奏', exact: true }).click()
  await page.getByText('魔法师已恢复一周节奏；本轮次数与永久收藏保留。').waitFor()
  const restored = await snapshot(page)
  assert.equal(restored.themes.wizard.thresholdMode, 'weekly')
  assert.deepEqual(restored.thresholds, [0, 1260, 4200, 8400, 14700, 21000, 27300, 34440, 42000])
  await page.close()
})

test('schema4 demo export restores weekly plan, round, custom mode, history and settings through the import UI', async () => {
  const page = await openDemo()
  const backup = await page.evaluate(async () => {
    const growth = window.__realDemoGrowth
    await growth.updateSettings({ autoCycle: false, autoEquip: false, quietMode: true })
    await growth.setWeeklyPlan(6000, 7)
    await growth.setThresholds('wizard', [0, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000])
    await growth.setDemoPresses(4500)
    return growth.exportBackup()
  })
  const saved = JSON.parse(backup)
  assert.equal(saved.demo, true)
  assert.equal(saved.state.schemaVersion, 4)
  const before = await snapshot(page)
  await page.evaluate(async () => {
    await window.__realDemoGrowth.reset()
    await window.__realDemoGrowth.setWeeklyPlan(5000, 5)
  })
  await page.locator('input[type=file]').setInputFiles({ name: 'schema4-demo.json', mimeType: 'application/json', buffer: Buffer.from(backup) })
  await page.getByRole('button', { name: '确认恢复', exact: true }).click()
  await page.getByText('已恢复所选备份，成长记录和穿戴状态已更新。').waitFor()
  const afterImport = await snapshot(page)
  for (const key of ['totalPresses', 'growthThemeId', 'outfitThemeId', 'dailyPressBudget', 'activeDaysPerWeek', 'weeklyTargetPresses', 'cycleRound', 'roundPresses', 'roundLevel', 'autoCycle', 'autoEquip', 'quietMode', 'themes']) {
    assert.deepEqual(afterImport[key], before[key], key)
  }
  await page.close()
})

test('schema3 demo migration preserves counts and settings, maps old defaults to weekly, and retains custom thresholds', async () => {
  const page = await openDemo()
  const previous = await page.evaluate(async () => JSON.parse(await window.__realDemoGrowth.exportBackup()))
  const legacy = previous.state
  legacy.schemaVersion = 3
  for (const key of ['dailyPressBudget', 'activeDaysPerWeek', 'weeklyTargetPresses', 'autoCycle', 'cycleRound']) delete legacy[key]
  const oldDefault = [0, 2000, 8000, 20000, 45000, 85000, 140000, 220000, 320000]
  for (const theme of Object.values(legacy.themes)) {
    delete theme.thresholdMode
    delete theme.roundPresses
    delete theme.roundLevel
    theme.thresholds = [...oldDefault]
  }
  const custom = [0, 3000, 9000, 22000, 46000, 86000, 141000, 221000, 321000]
  legacy.themes.pirate.thresholds = custom
  Object.assign(legacy.themes.wizard, { presses: 6000, unlockedLevel: 2, equippedLevel: 2 })
  legacy.totalPresses = 6000
  legacy.paused = true
  legacy.autoEquip = false
  legacy.quietMode = true
  legacy.decorationsEnabled = false
  await page.locator('input[type=file]').setInputFiles({ name: 'schema3-demo.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(previous)) })
  await page.getByRole('button', { name: '确认恢复', exact: true }).click()
  await page.getByText('已恢复所选备份，成长记录和穿戴状态已更新。').waitFor()
  const migrated = await snapshot(page)
  assert.equal(migrated.schemaVersion, 4)
  assert.equal(migrated.dailyPressBudget, 5000)
  assert.equal(migrated.activeDaysPerWeek, 5)
  assert.equal(migrated.autoCycle, true)
  assert.equal(migrated.cycleRound, 1)
  assert.equal(migrated.totalPresses, 6000)
  assert.equal(migrated.roundPresses, 6000)
  assert.equal(migrated.themes.wizard.equippedLevel, 2)
  assert.equal(migrated.themes.wizard.thresholdMode, 'weekly')
  assert.equal(migrated.themes.wizard.thresholds[8], 25000)
  assert.equal(migrated.themes.pirate.thresholdMode, 'custom')
  assert.deepEqual(migrated.themes.pirate.thresholds, custom)
  for (const key of ['paused', 'autoEquip', 'quietMode', 'decorationsEnabled']) assert.equal(migrated[key], legacy[key], key)
  assert.match(await page.locator('.journey-content h2').textContent(), /LV 4/)
  await page.close()
})

test('a simulated new press preserves the round level retained after raising thresholds', async () => {
  const page = await openDemo()
  const result = await page.evaluate(async () => {
    const growth = window.__realDemoGrowth
    await growth.updateSettings({ autoCycle: false })
    await growth.setDemoPresses(5000)
    await growth.setThresholds('wizard', [0, 10000, 20000, 30000, 40000, 50000, 60000, 70000, 80000])
    const retainedLevel = growth.state.value.roundLevel
    await growth.setDemoPresses(5001)
    return { retainedLevel, level: growth.state.value.roundLevel }
  })
  assert.equal(result.retainedLevel, 4)
  assert.equal(result.level, result.retainedLevel)
  await page.close()
})

test('simulated new presses respect pause without adding to round or history', async () => {
  const page = await openDemo()
  await page.evaluate(async () => {
    await window.__realDemoGrowth.updateSettings({ paused: true })
    await window.__realDemoGrowth.setDemoPresses(1)
  })
  const result = await snapshot(page)
  assert.equal(result.totalPresses, 0)
  assert.equal(result.roundPresses, 0)
  assert.equal(result.themePresses, 0)
  await page.close()
})

test('a press without an upgrade preserves a manually selected collected outfit', async () => {
  const page = await openDemo()
  await page.evaluate(async () => {
    const growth = window.__realDemoGrowth
    await growth.updateSettings({ autoCycle: false, autoEquip: true })
    await growth.setDemoPresses(5000)
    await growth.equip(1, 'wizard')
    await growth.setDemoPresses(5001)
  })
  const result = await snapshot(page)
  assert.equal(result.roundLevel, 4)
  assert.equal(result.equippedLevel, 1)
  await page.close()
})

test('editing an inactive theme cannot advance a completed current theme', async () => {
  const page = await openDemo()
  await page.evaluate(async () => {
    const growth = window.__realDemoGrowth
    await growth.updateSettings({ autoCycle: false })
    await growth.setDemoPresses(25000)
    const backup = JSON.parse(await growth.exportBackup())
    backup.state.autoCycle = true
    await growth.importBackup(JSON.stringify(backup))
    await growth.setThresholds('pirate', [0, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000])
  })
  const result = await snapshot(page)
  assert.equal(result.growthThemeId, 'wizard')
  assert.equal(result.outfitThemeId, 'wizard')
  assert.equal(result.themes.pirate.thresholdMode, 'custom')
  await page.close()
})

test('legacy import rejects missing required settings and unknown fields while allowing absent decorations', async () => {
  const page = await openDemo()
  const source = await page.evaluate(async () => JSON.parse(await window.__realDemoGrowth.exportBackup()))
  source.state.schemaVersion = 3
  for (const key of ['dailyPressBudget', 'activeDaysPerWeek', 'autoCycle', 'cycleRound']) delete source.state[key]
  for (const theme of Object.values(source.state.themes)) {
    delete theme.thresholdMode
    delete theme.roundPresses
    delete theme.roundLevel
    theme.thresholds = [0, 2000, 8000, 20000, 45000, 85000, 140000, 220000, 320000]
  }
  const invalids = []
  const missingSetting = structuredClone(source)
  delete missingSetting.state.paused
  invalids.push(missingSetting)
  const unknownField = structuredClone(source)
  unknownField.state.extra = true
  invalids.push(unknownField)
  const unknownTheme = structuredClone(source)
  unknownTheme.state.themes.unknown = { ...unknownTheme.state.themes.wizard }
  invalids.push(unknownTheme)
  const unknownThemeField = structuredClone(source)
  unknownThemeField.state.themes.wizard.extra = true
  invalids.push(unknownThemeField)
  for (const invalid of invalids) {
    const rejected = await page.evaluate(async (json) => {
      try {
        await window.__realDemoGrowth.importBackup(json)
        return false
      } catch {
        return true
      }
    }, JSON.stringify(invalid))
    assert.equal(rejected, true)
    assert.equal((await snapshot(page)).totalPresses, 0)
  }
  delete source.state.decorationsEnabled
  await page.evaluate(async json => window.__realDemoGrowth.importBackup(json), JSON.stringify(source))
  assert.equal((await snapshot(page)).decorationsEnabled, true)
  await page.close()
})
