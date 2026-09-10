<script setup lang="ts">
import { LogicalSize } from '@tauri-apps/api/dpi'
import { Menu, PredefinedMenuItem } from '@tauri-apps/api/menu'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

import type { WizardPoint } from '@/composables/useWizardInput'
import type { GrowthThemeId } from '@/data/wizard-theme'

import { useAppMenu } from '@/composables/useAppMenu'
import { useCompanionBehavior } from '@/composables/useCompanionBehavior'
import { useGrowth } from '@/composables/useGrowth'
import { useTauriListen } from '@/composables/useTauriListen'
import { useWizardInput } from '@/composables/useWizardInput'
import { WINDOW_LABEL } from '@/constants'
import { wizardLevels } from '@/data/wizard-theme'
import { getLocalizedGrowthThemeRegistry } from '@/data/wizard-theme-localized'
import { useEmpireLocale } from '@/locales/empire'
import { translateEmpireError } from '@/locales/empire-errors'
import { hideWindow, setAlwaysOnTop, setTaskbarVisibility, showWindow } from '@/plugins/window'
import { useAppStore } from '@/stores/app'
import { useCatStore } from '@/stores/cat'
import { useGeneralStore } from '@/stores/general'
import { isMac, isWindows } from '@/utils/platform'

import WizardPet from './WizardPet.vue'

const { tr, locale } = useEmpireLocale()
const growthThemeRegistry = computed(() => getLocalizedGrowthThemeRegistry(locale.value))
const appWindow = getCurrentWebviewWindow()
const appStore = useAppStore()
const catStore = useCatStore()
const generalStore = useGeneralStore()
const { getBaseMenu, getExitMenu } = useAppMenu()
const { state } = useGrowth()
const { motion, expression, error: behaviorError } = useCompanionBehavior()
const interactionMode = computed(() => catStore.model.interactionMode)
const wearingTheme = computed(() => growthThemeRegistry.value[state.value?.outfitThemeId === 'none' ? 'wizard' : state.value?.outfitThemeId ?? 'wizard'])
const equipped = computed(() => wearingTheme.value.levels[(state.value?.themes[wearingTheme.value.id]?.equippedLevel ?? 1) - 1])
const progress = computed(() => {
  const level = state.value?.roundLevel ?? 1
  if (level === 9) return 1
  const thresholds = state.value?.thresholds ?? wizardLevels.map(item => item.threshold)
  const current = thresholds[level - 1]
  const next = thresholds[level]
  return Math.max(0, Math.min(1, ((state.value?.roundPresses ?? 0) - current) / (next - current)))
})
const announcement = ref('')
let announcementTimer: ReturnType<typeof setTimeout> | undefined
let hoverTimer: ReturnType<typeof setTimeout> | undefined
let insideWindow = false
let scaleFactor = 1
let stopScaleListener: (() => void) | undefined
let disposed = false

function restorePointer() {
  clearTimeout(hoverTimer)
  document.body.style.removeProperty('opacity')
  void appWindow.setIgnoreCursorEvents(catStore.window.passThrough)
  insideWindow = false
}

function cursorMoved(point: WizardPoint) {
  if (!catStore.window.hideOnHover) return
  const bounds = appStore.windowState[WINDOW_LABEL.MAIN]
  if (!bounds || bounds.x == null || bounds.y == null || !bounds.width || !bounds.height) return
  const x = point.x * scaleFactor
  const y = point.y * scaleFactor
  const inside = x >= bounds.x && x <= bounds.x + bounds.width && y >= bounds.y && y <= bounds.y + bounds.height
  if (inside === insideWindow) return
  clearTimeout(hoverTimer)
  if (inside) {
    hoverTimer = setTimeout(() => {
      document.body.style.opacity = '0'
      void appWindow.setIgnoreCursorEvents(true)
    }, catStore.window.hideOnHoverDelay * 1000)
  } else {
    restorePointer()
  }
  insideWindow = inside
}

const { input } = useWizardInput({
  mode: interactionMode,
  listenGamepad: true,
  ignorePointer: () => catStore.model.ignoreMouse,
  onCursorMove: cursorMoved,
  maxFPS: () => catStore.model.maxFPS,
})

onMounted(async () => {
  if (isMac) scaleFactor = await appWindow.scaleFactor()
  const stop = await appWindow.onScaleChanged(({ payload }) => {
    if (isMac) scaleFactor = payload.scaleFactor
  })
  if (disposed) stop()
  else stopScaleListener = stop
})

onUnmounted(() => {
  disposed = true
  stopScaleListener?.()
  clearTimeout(announcementTimer)
  restorePointer()
})

useTauriListen<{ themeId: GrowthThemeId, levels: number[], equippedLevel: number }>('growth-unlocked', ({ payload }) => {
  if (state.value?.quietMode !== false) return
  const level = Math.max(...payload.levels.filter(value => Number.isInteger(value) && value >= 2 && value <= 9))
  if (!Number.isFinite(level)) return
  announcement.value = `${tr('解锁', 'Unlocked')} Lv.${level} · ${(growthThemeRegistry.value[payload.themeId] ?? growthThemeRegistry.value.wizard).levels[level - 1].name}`
  clearTimeout(announcementTimer)
  announcementTimer = setTimeout(() => announcement.value = '', 3600)
})
watch(locale, () => {
  announcement.value = ''
})
watch(() => state.value?.quietMode, (quiet) => {
  if (quiet) announcement.value = ''
})
watch(() => catStore.window.hideOnHover, (value) => {
  if (!value) restorePointer()
})
watch(() => catStore.window.scale, (scale) => {
  // The badge occupies existing desk space and never changes window height.
  const factor = Math.max(10, Math.min(500, scale)) / 100
  const width = Math.round(400 * factor)
  void appWindow.setSize(new LogicalSize(width, Math.round(width * 580 / 612)))
}, { immediate: true })
watch(() => catStore.window.visible, value => value ? showWindow() : hideWindow())
watch(() => catStore.window.passThrough, value => void appWindow.setIgnoreCursorEvents(value), { immediate: true })
watch(() => catStore.window.alwaysOnTop, setAlwaysOnTop, { immediate: true })
watch(() => generalStore.app.taskbarVisible, setTaskbarVisibility, { immediate: true })

function drag(event: MouseEvent) {
  if (event.button === 0) void appWindow.startDragging()
}

async function contextmenu(event: MouseEvent) {
  event.preventDefault()
  if (event.shiftKey) return
  const menu = await Menu.new({ items: [...await getBaseMenu(), await PredefinedMenuItem.new({ item: 'Separator' }), ...await getExitMenu()] })
  if (isWindows && catStore.window.alwaysOnTop) setAlwaysOnTop(false)
  try {
    await menu.popup()
  } finally {
    if (isWindows && catStore.window.alwaysOnTop) setAlwaysOnTop(true)
  }
}

function resizeGesture(event: MouseEvent) {
  if (event.buttons !== 2 || !event.shiftKey) return
  const delta = (event.movementX + event.movementY) * 0.5
  catStore.window.scale = Math.round(Math.max(10, Math.min(500, catStore.window.scale + delta)))
}
</script>

<template>
  <main
    class="wizard-desktop"
    :style="{ opacity: catStore.window.opacity / 100, borderRadius: `${catStore.window.radius}%` }"
    @contextmenu="contextmenu"
    @mousedown="drag"
    @mousemove="resizeGesture"
  >
    <WizardPet
      :announcement="announcement"
      :decorations-enabled="state?.decorationsEnabled ?? true"
      :expression="expression"
      :growth-level="state?.roundLevel ?? 1"
      :growth-theme-id="state?.growthThemeId ?? 'wizard'"
      :input="input"
      :level="equipped.level"
      :mirror="catStore.model.mirror"
      :mode="interactionMode"
      :motion="motion"
      :name="equipped.name"
      :outfit-theme-id="state?.outfitThemeId ?? 'wizard'"
      :paused="state?.paused ?? false"
      :pointer-mirror="catStore.model.mouseMirror"
      :progress="progress"
      :reduced-motion="state?.reducedMotion ?? false"
      :show-progress="state?.showProgress ?? true"
    />
    <div
      v-if="behaviorError"
      class="behavior-error"
      role="status"
    >
      {{ translateEmpireError(behaviorError, locale) }}
    </div>
  </main>
</template>

<style scoped>
.wizard-desktop {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: transparent;
  cursor: grab;
}
.wizard-desktop:active {
  cursor: grabbing;
}
.behavior-error {
  position: absolute;
  top: 6px;
  left: 6px;
  right: 6px;
  padding: 6px 8px;
  border-radius: 7px;
  background: #fff3da;
  color: #76552d;
  font:
    11px/1.4 -apple-system,
    sans-serif;
}
</style>
