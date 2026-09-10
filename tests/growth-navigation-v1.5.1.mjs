// Business-flow checks use the real browser demo composable and a single Growth
// instance under the production preference shell. No native app or save is used.
import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { mkdir } from 'node:fs/promises'
import process from 'node:process'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'

const baseURL = process.env.BONGO_PREVIEW_URL ?? 'http://127.0.0.1:1420'
const outputDirectory = new URL('./results/growth-navigation-v1.5.1/', import.meta.url)
const defaults = [0, 750, 2500, 5000, 8750, 12500, 16250, 20500, 25000]
let browser
before(async () => {
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? '/Users/Harry/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs')
  await mkdir(outputDirectory, { recursive: true })
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
})
after(async () => browser?.close())

async function openDemo(width = 1100) {
  const page = await browser.newPage({ viewport: { width, height: 900 } })
  const pageErrors = []
  page.on('pageerror', error => pageErrors.push(error.message))
  const growthResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/src/composables/useGrowth.ts')
  const componentResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/src/components/growth/index.vue')
  await page.goto(`${baseURL}/?preview=growth`)
  await page.locator('.theme-grid').waitFor()
  const growthModuleURL = (await growthResponse).url()
  const componentModuleURL = (await componentResponse).url()
  await page.evaluate(async ({ growthModuleURL, componentModuleURL }) => {
    const { createApp, h, ref, nextTick } = await import('/node_modules/.vite/deps/vue.js')
    const { i18n } = await import('/src/locales/index.ts')
    i18n.global.locale.value = 'zh-CN'
    const { default: Growth } = await import(componentModuleURL)
    const { default: Shell } = await import('/src/pages/preference/components/PreferenceShell.vue')
    const growth = (await import(growthModuleURL)).useGrowth()
    if (!growth.isDemo) throw new Error('Navigation checks must only run in the browser demo')
    document.querySelector('#app').__vue_app__?.unmount()
    document.body.style.cssText = 'margin:0;padding:0;background:#f9f7f1'
    const section = ref('themes')
    createApp({ setup() {
      return () => h(Shell, { 'modelValue': section.value, 'nativeMac': true, 'onUpdate:modelValue': (value) => {
        section.value = value
      } }, { default: () => h(Growth, { section: section.value }, { 'more-settings': () => h('button', { 'data-testid': 'more-settings-stub', 'type': 'button' }, '猫咪交互设置') }) })
    } }).mount('#app')
    window.__realDemoGrowth = growth
    await nextTick()
    await growth.init()
    await growth.reset()
    await growth.updateSettings({ autoCycle: false })
    window.__growthElement = document.querySelector('.growth-panel')
  }, { growthModuleURL, componentModuleURL })
  await page.locator('.theme-grid').waitFor()
  assert.deepEqual(pageErrors, [])
  page.__pageErrors = pageErrors
  return page
}

async function snapshot(page) {
  return page.evaluate(() => JSON.parse(JSON.stringify(window.__realDemoGrowth.state.value)))
}
async function go(page, section) {
  await page.locator(`.preference-navigation [data-section="${section}"]`).click()
  await page.locator(`[data-growth-section="${section}"]`).waitFor()
  assert.equal(await page.evaluate(() => document.querySelector('.growth-panel') === window.__growthElement), true)
}
async function assertCardsContainContent(page, selector) {
  const escaped = await page.locator(selector).evaluateAll(cards => cards.flatMap((card, index) => {
    const outer = card.getBoundingClientRect()
    return [...card.querySelectorAll('.theme-art, .theme-status, strong, .wardrobe-render, .outfit-caption')].filter((element) => {
      const inner = element.getBoundingClientRect()
      return inner.left < outer.left - 1 || inner.right > outer.right + 1 || inner.top < outer.top - 1 || inner.bottom > outer.bottom + 1
    }).map(element => ({ index, element: element.className || element.tagName, text: element.textContent }))
  }))
  assert.deepEqual(escaped, [])
}

async function finish(page) {
  assert.deepEqual(page.__pageErrors, [])
  await page.close()
}

test('five sections keep one instance; theme details and locked preview never change wearing', async () => {
  const page = await openDemo()
  assert.equal(await page.locator('.preference-navigation button').count(), 5)
  assert.equal(await page.locator('.theme-card').count(), 13)
  await assertCardsContainContent(page, '.theme-card')
  assert.equal(await page.locator('.outfit-card').count(), 0)
  const before = await snapshot(page)
  await page.locator('button[data-theme="performer"]').click()
  assert.equal(await page.locator('.outfit-card').count(), 9)
  await assertCardsContainContent(page, '.outfit-card')
  assert.equal((await snapshot(page)).outfitThemeId, before.outfitThemeId)
  await page.locator('button[data-level="9"]').click()
  await page.getByRole('dialog', { name: '装扮预览', exact: true }).waitFor()
  assert.equal(await page.getByRole('button', { name: '尚未解锁', exact: true }).isDisabled(), true)
  assert.equal((await snapshot(page)).outfitThemeId, before.outfitThemeId)
  await page.getByRole('button', { name: '关闭装扮预览' }).click()
  await page.getByRole('button', { name: '← 返回主题', exact: true }).click()
  assert.equal(await page.locator('.theme-card').count(), 13)
  for (const section of ['progress', 'thresholds', 'settings', 'backup', 'themes']) {
    await go(page, section)
    assert.equal(await page.locator('[data-growth-section]').count(), 1)
    assert.doesNotMatch(await page.locator('.growth-panel').textContent(), /每日预算|每日预计|活跃日|一周节奏|一周一套|ONE WEEK|BONGO \/ ARCANA/)
  }
  await finish(page)
})

test('cultivation, wearing and original appearance require their own explicit actions', async () => {
  const page = await openDemo()
  await page.locator('button[data-theme="pirate"]').click()
  await page.getByRole('button', { name: '培养这个主题', exact: true }).click()
  let result = await snapshot(page)
  assert.equal(result.growthThemeId, 'pirate')
  assert.equal(result.outfitThemeId, 'wizard')
  await page.getByRole('button', { name: '穿戴 LV1 套装', exact: true }).click()
  result = await snapshot(page)
  assert.equal(result.growthThemeId, 'pirate')
  assert.equal(result.outfitThemeId, 'pirate')
  await page.getByRole('button', { name: '← 返回主题', exact: true }).click()
  await page.locator('button[data-theme="none"]').click()
  assert.equal((await snapshot(page)).outfitThemeId, 'pirate')
  await page.getByRole('button', { name: '使用原始外观', exact: true }).click()
  result = await snapshot(page)
  assert.equal(result.outfitThemeId, 'none')
  assert.equal(result.growthThemeId, 'pirate')
  await finish(page)
})

test('an unlocked outfit preview only equips after the explicit wear button', async () => {
  const page = await openDemo()
  await page.evaluate(async () => {
    await window.__realDemoGrowth.setDemoPresses(8750)
    await window.__realDemoGrowth.equip(1, 'wizard')
  })
  await page.locator('button[data-theme="wizard"]').click()
  await page.locator('button[data-level="5"]').click()
  assert.equal((await snapshot(page)).equippedLevel, 1)
  await page.getByRole('button', { name: '穿上这套', exact: true }).click()
  assert.equal((await snapshot(page)).equippedLevel, 5)
  assert.equal((await snapshot(page)).growthThemeId, 'wizard')
  await finish(page)
})

test('threshold selection is independent; default values remain a draft until saved', async () => {
  const page = await openDemo()
  const custom = [0, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000]
  await page.evaluate(async values => window.__realDemoGrowth.setThresholds('astronaut', values), custom)
  await go(page, 'thresholds')
  await page.locator('#threshold-theme').selectOption('astronaut')
  const before = await snapshot(page)
  await page.getByRole('button', { name: '填入默认值', exact: true }).click()
  assert.deepEqual(await page.locator('.threshold-grid input').evaluateAll(inputs => inputs.map(input => Number(input.value))), defaults)
  assert.deepEqual((await snapshot(page)).themes.astronaut.thresholds, custom)
  assert.equal((await snapshot(page)).growthThemeId, 'wizard')
  await page.getByRole('button', { name: '保存门槛', exact: true }).click()
  await page.waitForFunction(() => window.__realDemoGrowth.state.value.themes.astronaut.thresholds[1] === 750)
  const saved = await snapshot(page)
  assert.deepEqual(saved.themes.astronaut.thresholds, defaults)
  assert.equal(saved.themes.astronaut.thresholdMode, 'custom')
  for (const key of ['growthThemeId', 'outfitThemeId', 'dailyPressBudget', 'activeDaysPerWeek', 'weeklyTargetPresses']) assert.equal(saved[key], before[key])
  assert.equal(await page.getByRole('button', { name: '保存门槛', exact: true }).isDisabled(), true)
  await finish(page)
})

test('invalid thresholds and external changes cannot silently overwrite a retained draft', async () => {
  const page = await openDemo()
  await go(page, 'thresholds')
  const save = page.getByRole('button', { name: '保存门槛', exact: true })
  for (const invalid of ['2.5', '-1', '', '9007199254740992', '2600']) {
    await page.locator('#threshold-2').fill(invalid)
    assert.equal(await save.isDisabled(), true)
    assert.equal((await snapshot(page)).thresholds[1], 750)
  }
  await page.locator('#threshold-2').fill('900')
  assert.equal(await save.isEnabled(), true)
  const changed = [0, 800, 2600, 5100, 8800, 12600, 16300, 20600, 25100]
  await page.evaluate(async values => window.__realDemoGrowth.setThresholds('wizard', values), changed)
  await page.getByText('这个主题的门槛已在别处更新，草稿仍保留。请重新载入已保存值再编辑。', { exact: true }).waitFor()
  assert.equal(await page.locator('#threshold-2').inputValue(), '900')
  assert.equal(await save.isDisabled(), true)
  await page.getByRole('button', { name: '重新载入已保存值', exact: true }).click()
  assert.equal(await page.locator('#threshold-2').inputValue(), '800')
  await page.locator('#threshold-2').fill('850')
  await save.click()
  assert.equal((await snapshot(page)).thresholds[1], 850)
  await finish(page)
})

test('a threshold draft survives section navigation and an independent cultivation change', async () => {
  const page = await openDemo()
  await go(page, 'thresholds')
  await page.locator('#threshold-2').fill('900')
  assert.equal(await page.locator('#threshold-theme').isDisabled(), true)
  await go(page, 'progress')
  await page.locator('#growth-theme').selectOption('pirate')
  assert.equal((await snapshot(page)).growthThemeId, 'pirate')
  await go(page, 'thresholds')
  assert.equal(await page.locator('#threshold-theme').inputValue(), 'wizard')
  assert.equal(await page.locator('#threshold-2').inputValue(), '900')
  assert.equal(await page.getByRole('button', { name: '保存门槛', exact: true }).isEnabled(), true)
  await page.getByRole('button', { name: '保存门槛', exact: true }).click()
  const result = await snapshot(page)
  assert.equal(result.growthThemeId, 'pirate')
  assert.equal(result.themes.wizard.thresholds[1], 900)
  assert.equal(result.themes.pirate.thresholds[1], 750)
  await finish(page)
})

test('canceling backup import and reset leaves all demo data unchanged', async () => {
  const page = await openDemo()
  const originalBackup = await page.evaluate(async () => window.__realDemoGrowth.exportBackup())
  await page.evaluate(async () => window.__realDemoGrowth.setDemoPresses(6000))
  await go(page, 'backup')
  const before = await snapshot(page)
  await page.locator('input[type=file]').setInputFiles({ name: 'cancel-this-import.json', mimeType: 'application/json', buffer: Buffer.from(originalBackup) })
  const dialog = page.getByRole('dialog', { name: '确认备份操作', exact: true })
  await dialog.waitFor()
  assert.match(await dialog.textContent(), /cancel-this-import.json/)
  await dialog.getByRole('button', { name: '取消', exact: true }).click()
  assert.deepEqual(await snapshot(page), before)
  await page.getByRole('button', { name: '清空进度', exact: true }).click()
  await dialog.waitFor()
  await page.keyboard.press('Escape')
  assert.equal(await dialog.isVisible(), false)
  assert.deepEqual(await snapshot(page), before)
  await finish(page)
})

test('growth settings and the additional-settings slot appear only in settings', async () => {
  const page = await openDemo()
  assert.equal(await page.locator('[data-testid="more-settings-stub"]').count(), 0)
  await go(page, 'settings')
  await page.locator('[data-testid="more-settings-stub"]').waitFor()
  assert.equal(await page.getByRole('switch').count(), 6)
  const cycle = page.getByRole('switch', { name: '满级后自动循环', exact: true })
  assert.equal(await cycle.getAttribute('aria-checked'), 'false')
  await cycle.click()
  assert.equal((await snapshot(page)).autoCycle, true)
  await go(page, 'progress')
  assert.equal(await page.locator('[data-testid="more-settings-stub"]').count(), 0)
  await page.getByRole('button', { name: '暂停计数', exact: true }).click()
  assert.equal((await snapshot(page)).paused, true)
  await finish(page)
})

test('all sections and theme details fit the 278px content area inside a 390px window', async () => {
  const page = await openDemo(390)
  for (const section of ['themes', 'progress', 'thresholds', 'settings', 'backup']) {
    await go(page, section)
    const size = await page.locator('.growth-panel').evaluate(element => ({ width: element.clientWidth, scroll: element.scrollWidth, document: document.documentElement.scrollWidth, viewport: window.innerWidth }))
    assert.equal(size.width, 278)
    assert.ok(size.scroll <= size.width + 1, `${section}: ${JSON.stringify(size)}`)
    assert.ok(size.document <= size.viewport + 1, `${section} document overflow`)
    if (section === 'themes') await assertCardsContainContent(page, '.theme-card')
    await page.screenshot({ path: fileURLToPath(new URL(`${section}-390.png`, outputDirectory)) })
  }
  await go(page, 'themes')
  await page.locator('button[data-theme="wizard"]').click()
  const detail = await page.locator('.growth-panel').evaluate(element => ({ width: element.clientWidth, scroll: element.scrollWidth }))
  assert.ok(detail.scroll <= detail.width + 1)
  await assertCardsContainContent(page, '.outfit-card')
  await page.screenshot({ path: fileURLToPath(new URL('theme-detail-390.png', outputDirectory)) })
  await page.locator('button[data-level="1"]').click()
  const bounds = await page.getByRole('dialog', { name: '装扮预览', exact: true }).boundingBox()
  assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 391)
  await page.screenshot({ path: fileURLToPath(new URL('outfit-preview-390.png', outputDirectory)) })
  await finish(page)
})
