// Real Vue renderer + real input composable in browser demo mode only.
// This test never loads a native app, persists growth, or uses OS input.
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import process from 'node:process'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'

const baseURL = process.env.BONGO_PREVIEW_URL ?? 'http://127.0.0.1:1420'
const output = new URL('./results/original-fallback-v1.8.0/', import.meta.url)
let browser
before(async () => {
  const { chromium } = await import('/Users/Harry/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs')
  await mkdir(output, { recursive: true })
  browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
})
after(async () => browser?.close())

async function mount(mode) {
  const page = await browser.newPage({ viewport: { width: 650, height: 620 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const response = page.waitForResponse(value => new URL(value.url()).pathname === '/src/composables/useWizardInput.ts')
  const component = page.waitForResponse(value => new URL(value.url()).pathname === '/src/components/wizard-pet/WizardPet.vue')
  await page.goto(`${baseURL}/?preview=pet`)
  await page.locator('[data-testid="outfit-select"]').waitFor()
  await page.evaluate(async ({ mode, inputURL, componentURL }) => {
    const { createApp, h, ref, nextTick } = await import('/node_modules/.vite/deps/vue.js')
    const { default: WizardPet } = await import(componentURL)
    const { useWizardInput } = await import(inputURL)
    document.querySelector('#app').__vue_app__?.unmount()
    document.body.style.cssText = 'margin:0;padding:16px;background:#d9d2da'
    document.querySelector('#app').style.cssText = 'width:612px;height:580px'
    createApp({ setup() {
      const modeRef = ref(mode)
      const blink = ref(true)
      const mirror = ref(false)
      const input = useWizardInput({ demo: true, mode: modeRef })
      window.__originalQA = {
        input,
        key: (kind, value) => input.handleEvent({ kind, value }),
        pad: (kind, name, value) => input.handleGamepadEvent({ kind, name, value }),
        blink: async (value) => {
          blink.value = value
          await nextTick()
        },
        mirror: async (value) => {
          mirror.value = value
          await nextTick()
        },
      }
      return () => h(WizardPet, { level: 1, mode: modeRef.value, input: input.input, outfitThemeId: 'none', decorationsEnabled: true, showProgress: true, reducedMotion: true, blinkEyes: blink.value, mirror: mirror.value, pointerMirror: false })
    } }).mount('#app')
    await nextTick()
  }, { mode, inputURL: (await response).url(), componentURL: (await component).url() })
  await page.locator('.original-cat').waitFor()
  assert.equal(await page.locator('.scene-v6, .scene-v6-body, .sleeve-arm, .composite-body').count(), 0)
  assert.equal(await page.locator('image[href="/interaction/original/face.png"]').count(), 1)
  assert.equal(await page.locator('.pet-eyes image').count(), 2)
  const failed = await page.locator('svg image').evaluateAll(async (images) => {
    const sources = [...new Set(images.map(image => image.getAttribute('href')))]
    return (await Promise.all(sources.map(source => new Promise((resolve) => {
      const image = new Image()
      image.onload = () => resolve(null)
      image.onerror = () => resolve(source)
      image.src = source
    })))).filter(Boolean)
  })
  assert.deepEqual(failed, [])
  page.__errors = errors
  return page
}

async function event(page, kind, value) {
  await page.evaluate(({ kind, value }) => window.__originalQA.key(kind, value), { kind, value })
}
async function finish(page, name) {
  assert.deepEqual(page.__errors, [])
  await page.locator('.wizard-pet').screenshot({ path: fileURLToPath(new URL(`${name}.png`, output)) })
  await page.close()
}

for (const mode of ['standard', 'keyboard', 'trackpad']) {
  test(`original ${mode}: exact key feedback, release, side selection and device isolation`, async () => {
    const page = await mount(mode)
    for (const key of ['Num1', 'Num6', 'Num9', 'Num0', 'KeyQ', 'Space']) {
      await event(page, 'KeyboardPress', key)
      const glow = page.locator(`.key-glow-overlay[data-key="${key}"]`)
      await glow.waitFor()
      assert.match(await glow.getAttribute('href'), new RegExp(`/interaction-separated/${mode === 'trackpad' ? 'standard' : mode}/left-pressed/${key}.png$`))
      assert.equal(await page.locator('.key-overlay[data-paw="left"]').count(), 1)
      assert.equal(await page.locator('.rest-paw.left-paw').count(), 0)
      assert.equal(await page.locator('.key-stage').getAttribute('transform'), 'translate(0 0)')
      await event(page, 'KeyboardRelease', key)
      assert.equal(await page.locator('.key-glow-overlay').count(), 0)
    }
    await event(page, 'KeyboardPress', 'ArrowUp')
    assert.equal(await page.locator('.key-overlay[data-paw="right"]').count(), mode === 'keyboard' ? 1 : 0)
    await event(page, 'KeyboardRelease', 'ArrowUp')
    await event(page, 'KeyboardPress', 'KeyQ')
    await event(page, 'KeyboardPress', 'Space')
    assert.equal(await page.locator('.key-glow-overlay').count(), 2)
    assert.equal(await page.locator('.key-overlay').count(), 1)
    await event(page, 'KeyboardRelease', 'KeyQ')
    await event(page, 'KeyboardRelease', 'Space')
    if (mode === 'keyboard') {
      await event(page, 'MouseMove', { x: 0, y: 0 })
      await event(page, 'MouseMove', { x: 500, y: -350 })
      await event(page, 'MousePress', 'Left')
      assert.equal(await page.locator('.pointer-paw, .original-mouse, .touchpad-click-glow').count(), 0)
    } else {
      await event(page, 'MouseMove', { x: 0, y: 0 })
      await event(page, 'MouseMove', { x: 500, y: -350 })
      const path = await page.locator('.pointer-paw path').getAttribute('d')
      assert.match(path, /C 154 338 21 376 9 405/)
      await event(page, 'MousePress', 'Left')
      if (mode === 'standard') {
        assert.equal(await page.locator('image[href="/interaction/original/mouse-left-glow.png"]').count(), 1)
      } else {
        assert.equal(await page.locator('.touchpad-click-glow').getAttribute('cx'), '45')
        await event(page, 'PointerScroll', { x: 0, y: -4 })
        assert.equal(await page.locator('.scroll-waves').count(), 1)
      }
      await event(page, 'MouseRelease', 'Left')
    }
    await finish(page, mode)
  })
}

test('original gamepad: original button sides, both sticks and keyboard isolation', async () => {
  const page = await mount('gamepad')
  await event(page, 'KeyboardPress', 'KeyQ')
  assert.equal(await page.locator('.key-overlay').count(), 0)
  for (const [name, side] of [['DPadLeft', 'left'], ['South', 'right'], ['LeftTrigger2', 'left'], ['RightTrigger2', 'right']]) {
    await page.evaluate(name => window.__originalQA.pad('ButtonChanged', name, 1), name)
    assert.equal(await page.locator(`.key-overlay[data-paw="${side}"]`).count(), 1)
    assert.equal(await page.locator(`.key-glow-overlay[data-key="${name}"]`).count(), 1)
    await page.evaluate(name => window.__originalQA.pad('ButtonChanged', name, 0), name)
    assert.equal(await page.locator('.key-overlay').count(), 0)
  }
  await page.evaluate(() => {
    window.__originalQA.pad('AxisChanged', 'LeftStickX', 1)
    window.__originalQA.pad('AxisChanged', 'RightStickY', -1)
  })
  assert.equal(await page.locator('.gamepad-sticks ellipse').count(), 2)
  assert.equal(await page.locator('.gamepad-sticks > g').nth(0).getAttribute('transform'), 'translate(455 477)')
  assert.equal(await page.locator('.gamepad-sticks > g').nth(1).getAttribute('transform'), 'translate(83 421)')
  assert.equal(await page.locator('.pointer-paw, .original-mouse, .touchpad').count(), 0)
  await finish(page, 'gamepad')
})

test('original eye bitmaps blink independently of key movement and can be disabled', async () => {
  const page = await mount('trackpad')
  assert.equal(await page.locator('.pet-eyes animateTransform').count(), 2)
  const scale = async time => page.evaluate((time) => {
    const svg = document.querySelector('svg.pet-stage')
    svg.pauseAnimations()
    svg.setCurrentTime(time)
    return [...document.querySelectorAll('.eye-blink')].map(eye => eye.transform.animVal.getItem(0).matrix.d)
  }, time)
  assert.deepEqual(await scale(1), [1, 1])
  const closed = await scale(5.348)
  assert.ok(closed.every(value => value < 0.1), String(closed))
  const sources = await page.locator('.pet-eyes image').evaluateAll(images => images.map(image => image.getAttribute('href')))
  await event(page, 'KeyboardPress', 'Num1')
  assert.deepEqual(await scale(5.348), closed)
  assert.deepEqual(await page.locator('.pet-eyes image').evaluateAll(images => images.map(image => image.getAttribute('href'))), sources)
  await page.evaluate(() => window.__originalQA.blink(false))
  assert.equal(await page.locator('.pet-eyes animateTransform').count(), 0)
  assert.equal(await page.locator('.pet-eyes image').count(), 2)
  await page.evaluate(() => window.__originalQA.mirror(true))
  assert.equal(await page.locator('g[transform="translate(612 0) scale(-1 1)"]').count(), 1)
  await finish(page, 'independent-eyes-mirrored')
})
