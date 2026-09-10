import { defineStore } from 'pinia'
import { reactive, ref } from 'vue'

import { useModelStore } from './model'

export type InteractionMode = 'standard' | 'keyboard' | 'gamepad' | 'trackpad'

export interface CatStore {
  model: {
    /** Kept only to migrate version 1.2.0 preferences. */
    renderer: 'wizard' | 'legacy'
    interactionMode: InteractionMode
    mirror: boolean
    mouseMirror: boolean
    motionSound: boolean
    behavior: boolean
    autoReleaseDelay: number
    maxFPS: number
    ignoreMouse: boolean
  }
  window: {
    visible: boolean
    passThrough: boolean
    alwaysOnTop: boolean
    scale: number
    opacity: number
    radius: number
    hideOnHover: boolean
    hideOnHoverDelay: number
    keepInScreen: boolean
  }
}

export const useCatStore = defineStore('cat', () => {
  /* ------------ 废弃字段（后续删除） ------------ */

  /** @deprecated 请使用 `model.mirror` */
  const mirrorMode = ref(false)

  /** @deprecated 请使用 `model.mouseMirror` */
  const mouseMirror = ref(false)

  /** @deprecated 请使用 `window.passThrough` */
  const penetrable = ref(false)

  /** @deprecated 请使用 `window.alwaysOnTop` */
  const alwaysOnTop = ref(true)

  /** @deprecated 请使用 `window.scale` */
  const scale = ref(100)

  /** @deprecated 请使用 `window.opacity` */
  const opacity = ref(100)

  /** @deprecated 用于标识数据是否已迁移，后续版本将删除 */
  const migrated = ref(false)
  const interactionMigrated = ref(false)

  const model = reactive<CatStore['model']>({
    renderer: 'wizard',
    interactionMode: 'trackpad',
    mirror: false,
    mouseMirror: false,
    motionSound: false,
    behavior: true,
    autoReleaseDelay: 3,
    maxFPS: 60,
    ignoreMouse: false,
  })

  const window = reactive<CatStore['window']>({
    visible: true,
    passThrough: false,
    alwaysOnTop: false,
    scale: 100,
    opacity: 100,
    radius: 0,
    hideOnHover: false,
    hideOnHoverDelay: 0,
    keepInScreen: true,
  })

  const init = () => {
    if (!interactionMigrated.value) {
      model.interactionMode = model.renderer === 'legacy'
        ? useModelStore().currentModel?.mode ?? 'standard'
        : 'trackpad'
      interactionMigrated.value = true
    }
    if (migrated.value) return

    model.mirror = mirrorMode.value
    model.mouseMirror = mouseMirror.value

    window.visible = true
    window.passThrough = penetrable.value
    window.alwaysOnTop = alwaysOnTop.value
    window.scale = scale.value
    window.opacity = opacity.value

    migrated.value = true
  }

  const setInteractionMode = (mode: InteractionMode) => {
    model.interactionMode = mode
    const models = useModelStore()
    const baseMode = mode === 'trackpad' ? 'standard' : mode
    const preset = models.models.find(item => item.isPreset && item.mode === baseMode)
    if (preset) models.currentModel = preset
    models.modelReady = true
  }

  return {
    migrated,
    interactionMigrated,
    model,
    window,
    init,
    setInteractionMode,
  }
})
