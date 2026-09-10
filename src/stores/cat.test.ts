/* eslint-disable test/no-import-node-test -- Uses the Node built-in runner. */
import assert from 'node:assert/strict'
import { it } from 'node:test'
import { createPinia, setActivePinia } from 'pinia'

import { useCatStore } from './cat'
import { useModelStore } from './model'

function fixtures() {
  setActivePinia(createPinia())
  const cat = useCatStore()
  const models = useModelStore()
  models.models = ['standard', 'keyboard', 'gamepad'].map(mode => ({
    id: mode,
    path: `/preset/${mode}`,
    mode: mode as 'standard' | 'keyboard' | 'gamepad',
    isPreset: true,
  }))
  models.currentModel = models.models[0]
  cat.migrated = true
  return { cat, models }
}

it('version 1.2 wizard preference migrates to trackpad without changing saved window settings', () => {
  const { cat } = fixtures()
  cat.window.scale = 50
  cat.window.opacity = 72
  cat.model.ignoreMouse = true
  cat.init()
  assert.equal(cat.model.interactionMode, 'trackpad')
  assert.equal(cat.window.scale, 50)
  assert.equal(cat.window.opacity, 72)
  assert.equal(cat.model.ignoreMouse, true)
  cat.setInteractionMode('keyboard')
  cat.init()
  assert.equal(cat.model.interactionMode, 'keyboard')
})

it('legacy preference migrates its current input mode once', () => {
  const { cat, models } = fixtures()
  cat.model.renderer = 'legacy'
  models.currentModel = models.models[2]
  cat.init()
  assert.equal(cat.model.interactionMode, 'gamepad')
  cat.setInteractionMode('trackpad')
  cat.init()
  assert.equal(cat.model.interactionMode, 'trackpad')
})

it('input mode selection changes the device preset without changing unrelated settings', () => {
  const { cat, models } = fixtures()
  cat.window.scale = 75
  cat.model.mirror = true
  for (const mode of ['keyboard', 'gamepad', 'standard', 'trackpad'] as const) {
    cat.setInteractionMode(mode)
    assert.equal(cat.model.interactionMode, mode)
    assert.equal(models.currentModel?.mode, mode === 'trackpad' ? 'standard' : mode)
    assert.equal(cat.model.mirror, true)
    assert.equal(cat.window.scale, 75)
  }
})
