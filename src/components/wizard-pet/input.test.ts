/* eslint-disable test/no-import-node-test -- Uses Node's built-in runner without a test dependency. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createRenderer, h, nextTick, ref } from 'vue'

import type { InteractionMode } from '../../composables/useWizardInput'

import { normalizeDeviceKey, resolveInteractionKey, useWizardInput } from '../../composables/useWizardInput'
import { interactionKeys } from './interaction-assets'

function mountInput(initialMode: InteractionMode = 'trackpad') {
  let api!: ReturnType<typeof useWizardInput>
  const ignore = ref(false)
  const mode = ref<InteractionMode>(initialMode)
  const maxFPS = ref(0)
  const renderer = createRenderer<object, object>({
    patchProp() {},
    insert() {},
    remove() {},
    setText() {},
    setElementText() {},
    createElement: () => ({}),
    createText: () => ({}),
    createComment: () => ({}),
    parentNode: () => null,
    nextSibling: () => null,
  })
  const app = renderer.createApp({ setup() {
    api = useWizardInput({ demo: true, mode, ignorePointer: ignore, maxFPS })
    return () => h('div')
  } })
  app.mount({})
  return { api, ignore, mode, maxFPS, dispose: () => app.unmount() }
}
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

it('restores every upstream mapping and leaves original background and per-key pixels unchanged', () => {
  const root = fileURLToPath(new URL('../../../', import.meta.url))
  for (const mode of ['standard', 'keyboard', 'gamepad'] as const) {
    for (const file of ['background.png', 'cover.png']) {
      assert.deepEqual(readFileSync(`${root}public/interaction/${mode}/${file}`), readFileSync(`${root}src-tauri/assets/models/${mode}/resources/${file}`))
    }
    for (const side of ['left', 'right'] as const) {
      for (const key of interactionKeys[mode][side]) {
        const mapping = resolveInteractionKey(mode, key)
        assert.equal(mapping?.side, side)
        assert.equal(mapping?.key, key)
        assert.deepEqual(readFileSync(`${root}public${mapping!.src}`), readFileSync(`${root}src-tauri/assets/models/${mode}/resources/${side}-keys/${key}.png`))
      }
    }
  }
})

it('exact keys win over modifier aliases and modes retain original keyboard and arrow sides', () => {
  assert.equal(resolveInteractionKey('trackpad', 'KeyJ')?.side, 'left')
  assert.equal(resolveInteractionKey('trackpad', 'KeyA')?.side, 'left')
  assert.equal(resolveInteractionKey('keyboard', 'ArrowUp')?.side, 'right')
  assert.equal(resolveInteractionKey('standard', 'ArrowUp'), undefined)
  assert.equal(resolveInteractionKey('keyboard', 'ShiftRight')?.key, 'ShiftRight')
  assert.equal(resolveInteractionKey('keyboard', 'MetaRight')?.key, 'Meta')
  assert.equal(resolveInteractionKey('keyboard', 'F12')?.key, 'Fn')
  assert.equal(resolveInteractionKey('keyboard', 'Function')?.key, 'Fn')
  assert.equal(normalizeDeviceKey('Digit8'), 'Num8')
  assert.equal(normalizeDeviceKey('Enter'), 'Return')
})

it('held keys keep their blue overlay state but only tap once; chords retain both keys until release', async () => {
  const { api, dispose } = mountInput()
  try {
    api.handleEvent({ kind: 'KeyboardPress', value: 'ControlLeft' })
    api.handleEvent({ kind: 'KeyboardPress', value: 'KeyC' })
    assert.deepEqual([...api.input.pressedKeys], ['ControlLeft', 'KeyC'])
    await delay(130)
    assert.equal(api.input.leftTap, false)
    api.handleEvent({ kind: 'KeyboardPress', value: 'KeyC' })
    assert.equal(api.input.leftTap, false)
    assert.equal(api.input.pressedKeys.length, 2)
    api.handleEvent({ kind: 'KeyboardRelease', value: 'KeyC' })
    assert.deepEqual([...api.input.pressedKeys], ['ControlLeft'])
    api.handleEvent({ kind: 'KeyboardRelease', value: 'ControlLeft' })
    assert.deepEqual([...api.input.pressedKeys], [])
  } finally {
    dispose()
  }
})

it('multi-monitor pointer movement is bounded and responds only in pointer modes', async () => {
  const { api, mode, dispose } = mountInput()
  try {
    api.handleEvent({ kind: 'MouseMove', value: { x: -9000, y: -500 } })
    api.handleEvent({ kind: 'MouseMove', value: { x: 9000, y: 5000 } })
    assert.deepEqual({ ...api.input.pointer }, { x: 1, y: 1 })
    mode.value = 'keyboard'
    await nextTick()
    api.handleEvent({ kind: 'MouseMove', value: { x: -9000, y: -500 } })
    assert.deepEqual({ ...api.input.pointer }, { x: 1, y: 1 })
  } finally {
    dispose()
  }
})

it('scroll and tap use trackpad; ignoring pointer clears click and scroll state', async () => {
  const { api, ignore, dispose } = mountInput()
  try {
    api.handleEvent({ kind: 'PointerScroll', value: { x: 0, y: -4 } })
    api.handleEvent({ kind: 'MousePress', value: 'Left' })
    assert.equal(api.input.scrolling, true)
    assert.equal(api.input.scrollDirection, -1)
    assert.deepEqual([...api.input.mouseButtons], ['Left'])
    ignore.value = true
    await nextTick()
    assert.equal(api.input.scrolling, false)
    assert.equal(api.input.rightMode, 'keyboard')
    assert.deepEqual([...api.input.mouseButtons], [])
  } finally {
    dispose()
  }
})

it('pointer and scroll contact returns to idle after a short quiet period', async () => {
  const { api, dispose } = mountInput()
  try {
    assert.equal(api.input.rightMode, 'keyboard')
    api.handleEvent({ kind: 'MouseMove', value: { x: 100, y: 100 } })
    assert.equal(api.input.rightMode, 'trackpad')
    await delay(350)
    api.handleEvent({ kind: 'PointerScroll', value: { x: 0, y: 2 } })
    await delay(350)
    assert.equal(api.input.scrolling, false)
    assert.equal(api.input.rightMode, 'trackpad', 'scroll extends contact beyond the original movement timeout')
    await delay(300)
    assert.equal(api.input.rightMode, 'keyboard')
  } finally {
    dispose()
  }
})

it('stationary held mouse buttons retain contact until the final release becomes idle', async () => {
  const { api, dispose } = mountInput()
  try {
    api.handleEvent({ kind: 'MousePress', value: 'Left' })
    api.handleEvent({ kind: 'MousePress', value: 'Right' })
    await delay(650)
    assert.equal(api.input.rightMode, 'trackpad')
    api.handleEvent({ kind: 'MouseRelease', value: 'Left' })
    await delay(650)
    assert.equal(api.input.rightMode, 'trackpad', 'the other held button keeps the paw down')
    api.handleEvent({ kind: 'MouseRelease', value: 'Right' })
    assert.equal(api.input.rightMode, 'trackpad')
    await delay(650)
    assert.equal(api.input.rightMode, 'keyboard')
  } finally {
    dispose()
  }
})

it('changing interaction modes clears old contact and does not revive it on a late release', async () => {
  const { api, mode, dispose } = mountInput()
  try {
    api.handleEvent({ kind: 'KeyboardPress', value: 'KeyA' })
    api.handleEvent({ kind: 'MousePress', value: 'Left' })
    api.handleEvent({ kind: 'PointerScroll', value: { x: 0, y: -4 } })
    mode.value = 'keyboard'
    await nextTick()
    assert.equal(api.input.rightMode, 'keyboard')
    assert.equal(api.input.leftTap, false)
    assert.equal(api.input.rightTap, false)
    assert.equal(api.input.scrolling, false)
    assert.deepEqual([...api.input.pressedKeys], [])
    assert.deepEqual([...api.input.mouseButtons], [])
    api.handleEvent({ kind: 'MouseRelease', value: 'Left' })
    mode.value = 'trackpad'
    await nextTick()
    assert.equal(api.input.rightMode, 'keyboard')
  } finally {
    dispose()
  }
})

it('gamepad buttons and axes are isolated from keyboard and pointer modes', async () => {
  const { api, mode, dispose } = mountInput('gamepad')
  try {
    api.handleGamepadEvent({ kind: 'ButtonChanged', name: 'South', value: 1 })
    api.handleGamepadEvent({ kind: 'AxisChanged', name: 'LeftStickX', value: 8 })
    assert.deepEqual([...api.input.pressedButtons], ['South'])
    assert.equal(api.input.sticks.left.x, 1)
    api.handleGamepadEvent({ kind: 'ButtonChanged', name: 'South', value: 0 })
    assert.deepEqual([...api.input.pressedButtons], [])
    mode.value = 'standard'
    await nextTick()
    assert.equal(api.input.sticks.left.x, 0)
    api.handleGamepadEvent({ kind: 'ButtonChanged', name: 'South', value: 1 })
    assert.deepEqual([...api.input.pressedButtons], [])
  } finally {
    dispose()
  }
})

it('pointer frame limiting accumulates movement without delaying keyboard down or up', async () => {
  const { api, maxFPS, dispose } = mountInput()
  try {
    maxFPS.value = 20
    api.handleEvent({ kind: 'MouseMove', value: { x: 0, y: 0 } })
    for (let x = 10; x <= 50; x += 10) api.handleEvent({ kind: 'MouseMove', value: { x, y: 0 } })
    api.handleEvent({ kind: 'KeyboardPress', value: 'KeyA' })
    assert.deepEqual([...api.input.pressedKeys], ['KeyA'])
    api.handleEvent({ kind: 'KeyboardRelease', value: 'KeyA' })
    assert.deepEqual([...api.input.pressedKeys], [])
    assert.ok(api.input.pointer.x < 0.1)
    await delay(70)
    assert.ok(Math.abs(api.input.pointer.x - 0.1) < 0.0001)
    maxFPS.value = 0
    api.handleEvent({ kind: 'MouseMove', value: { x: 100, y: 0 } })
    assert.ok(Math.abs(api.input.pointer.x - 0.2) < 0.0001)
  } finally {
    dispose()
  }
})
