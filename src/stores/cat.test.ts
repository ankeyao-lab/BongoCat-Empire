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

it('new and pre-feature saves default to both idle paws raised', () => {
  const { cat } = fixtures()
  assert.equal(cat.model.idlePointerRaised, true)
  // The Tauri Pinia plugin hydrates through $patch before App calls init.
  cat.$patch({ model: { interactionMode: 'standard' }, interactionMigrated: true })
  cat.init()
  assert.equal(cat.model.idlePointerRaised, true)
  assert.equal(cat.model.interactionMode, 'standard')
})

it('missing and invalid hydrated idle-paw values recover to both paws even after older migrations', () => {
  for (const value of [undefined, null, 'false', 0, 1, {}]) {
    const { cat } = fixtures()
    cat.interactionMigrated = true
    cat.model.idlePointerRaised = value as boolean
    cat.init()
    assert.equal(cat.model.idlePointerRaised, true)
  }
})

it('the single-paw preference survives save hydration and repeated initialization', () => {
  const { cat } = fixtures()
  cat.init()
  cat.model.idlePointerRaised = false
  cat.window.scale = 75
  const saved = JSON.parse(JSON.stringify(cat.$state))
  const { cat: restored } = fixtures()
  restored.$patch(saved)
  restored.init()
  restored.init()
  assert.equal(restored.model.idlePointerRaised, false)
  assert.equal(restored.window.scale, 75)
  for (const mode of ['keyboard', 'gamepad', 'standard', 'trackpad'] as const) {
    restored.setInteractionMode(mode)
    assert.equal(restored.model.idlePointerRaised, false)
  }
})
