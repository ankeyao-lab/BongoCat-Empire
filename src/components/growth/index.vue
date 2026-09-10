<script setup lang="ts">
import { open, save } from '@tauri-apps/plugin-dialog'
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'
import { computed, ref, watch } from 'vue'

import type { GrowthSettings } from '@/composables/useGrowth'
import type { WizardInputState } from '@/composables/useWizardInput'
import type { GrowthThemeId, OutfitThemeId } from '@/data/wizard-theme'
import type { PreferenceSection } from '@/pages/preference/sections'

import { getCompositeBody } from '@/components/wizard-pet/composite-body'
import { getPngOutfit } from '@/components/wizard-pet/png-wardrobe'
import { getSceneV6 } from '@/components/wizard-pet/scene-v6'
import WizardPet from '@/components/wizard-pet/WizardPet.vue'
import { useGrowth } from '@/composables/useGrowth'
import { levelAtPresses, validateThresholds } from '@/data/wizard-theme'
import { getLocalizedGrowthThemeRegistry, getLocalizedOutfitThemeOptions } from '@/data/wizard-theme-localized'
import { useEmpireLocale } from '@/locales/empire'
import { translateEmpireError } from '@/locales/empire-errors'
import { useCatStore } from '@/stores/cat'

const props = withDefaults(defineProps<{ section?: PreferenceSection }>(), { section: 'themes' })
const { tr, locale } = useEmpireLocale()
const catStore = useCatStore()
const growthThemeRegistry = computed(() => getLocalizedGrowthThemeRegistry(locale.value))
const outfitThemeOptions = computed(() => getLocalizedOutfitThemeOptions(locale.value))

const defaultThresholds = [0, 750, 2500, 5000, 8750, 12500, 16250, 20500, 25000]
const {
  state,
  initialized,
  error,
  busy,
  isDemo,
  refresh,
  updateSettings,
  equip,
  setOutfitTheme,
  setGrowthTheme,
  setThresholds,
  exportBackup,
  importBackup,
  reset,
  setDemoPresses,
  clearError,
} = useGrowth()
const localBusy = ref(false)
const localError = ref('')
const notice = ref('')
const working = computed(() => busy.value || localBusy.value)
const displayError = computed(() => translateEmpireError(localError.value || error.value || '', locale.value))
const activeTheme = computed(() => growthThemeRegistry.value[state.value?.growthThemeId ?? 'wizard'])
const current = computed(() => activeTheme.value.levels[(state.value?.roundLevel ?? 1) - 1])
const next = computed(() => activeTheme.value.levels[state.value?.roundLevel ?? 1])
const nextThreshold = computed(() => next.value ? state.value?.thresholds[next.value.level - 1] ?? next.value.threshold : 0)
const remaining = computed(() => Math.max(0, nextThreshold.value - (state.value?.roundPresses ?? 0)))
const progress = computed(() => {
  if (!next.value) return 100
  const start = state.value?.thresholds[current.value.level - 1] ?? current.value.threshold
  return Math.max(0, Math.min(100, ((state.value?.roundPresses ?? 0) - start) / Math.max(1, nextThreshold.value - start) * 100))
})
const completedThemes = computed(() => Object.values(state.value?.themes ?? {}).filter(theme => theme.roundLevel === 9).length)
const demoMaximum = computed(() => Math.max(state.value?.thresholds[8] ?? 25000, state.value?.roundPresses ?? 0))
const statusLabel = computed(() => {
  if (isDemo) return state.value?.paused ? tr('演示计数已暂停', 'Demo counting paused') : tr('浏览器演示', 'Browser demo')
  if (state.value?.listenerError || !state.value?.listening) return tr('输入监听未就绪', 'Input listener not ready')
  return state.value.paused ? tr('成长已暂停', 'Growth paused') : tr('正在累计按键', 'Counting keypresses')
})
const lastSaved = computed(() => {
  if (isDemo) return tr('演示数据只留在本页，不修改真实存档。', 'Demo data stays on this page and does not change your real save.')
  const value = state.value?.lastSavedAt
  if (!value) return tr('等待首次保存', 'Waiting for the first save')
  const date = new Date(typeof value === 'number' && value < 10000000000 ? value * 1000 : value)
  return Number.isNaN(date.getTime()) ? tr('存档时间暂不可读', 'Save time is unavailable') : tr(`最近保存于 ${date.toLocaleString(locale.value)}`, `Last saved ${date.toLocaleString(locale.value)}`)
})
const stillInput: WizardInputState = { rightMode: 'keyboard', leftTap: false, rightTap: false, pointer: { x: 0, y: 0 }, pressedKeys: [], mouseButtons: [], pressedButtons: [], scrolling: false, scrollDirection: 0, sticks: { left: { x: 0, y: 0 }, right: { x: 0, y: 0 } } }
const detailThemeId = ref<OutfitThemeId | null>(null)
const detailTheme = computed(() => detailThemeId.value && detailThemeId.value !== 'none' ? growthThemeRegistry.value[detailThemeId.value] : null)
const previewThemeId = ref<GrowthThemeId>('wizard')
const selectedLevel = ref(1)
const selectedArt = computed(() => getPngOutfit(previewThemeId.value, selectedLevel.value))
const selectedBody = computed(() => getSceneV6(previewThemeId.value, selectedLevel.value) ?? getCompositeBody(previewThemeId.value, selectedLevel.value))
const selected = computed(() => {
  const outfit = growthThemeRegistry.value[previewThemeId.value].levels[selectedLevel.value - 1]
  return { ...outfit, threshold: state.value?.themes[previewThemeId.value]?.thresholds[outfit.level - 1] ?? outfit.threshold }
})
const previewDialog = ref<HTMLDialogElement | null>(null)
const confirmDialog = ref<HTMLDialogElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const pendingConfirmation = ref<'reset' | 'import' | null>(null)
const backupDraft = ref<{ name: string, json: string } | null>(null)

const thresholdThemeId = ref<GrowthThemeId>('wizard')
const thresholdTheme = computed(() => growthThemeRegistry.value[thresholdThemeId.value])
const thresholdThemeProgress = computed(() => state.value?.themes[thresholdThemeId.value])
const thresholdDraft = ref(defaultThresholds.map(String))
const thresholdBaseline = ref(JSON.stringify(defaultThresholds))
const thresholdReady = ref(false)
const thresholdConflict = ref(false)
const draftThresholds = computed(() => thresholdDraft.value.map(Number))
const thresholdsDirty = computed(() => JSON.stringify(draftThresholds.value) !== thresholdBaseline.value || thresholdDraft.value.some(value => !value.trim()))
const thresholdError = computed(() => {
  const invalidIndex = thresholdDraft.value.findIndex(value => !/^\d+$/.test(value.trim()))
  if (invalidIndex >= 0) return tr(`LV${invalidIndex + 1} 只接受非负整数，请不要输入小数、负数或留空。`, `LV${invalidIndex + 1} accepts non-negative integers only. Do not leave it blank or use decimals or negative numbers.`)
  const message = validateThresholds(draftThresholds.value)
  return message ? translateEmpireError(message, locale.value) : null
})
const predictedRoundLevel = computed(() => thresholdError.value ? thresholdThemeProgress.value?.roundLevel ?? 1 : Math.max(thresholdThemeProgress.value?.roundLevel ?? 1, levelAtPresses(thresholdThemeProgress.value?.roundPresses ?? 0, draftThresholds.value)))
const predictedLevel = computed(() => Math.max(thresholdThemeProgress.value?.unlockedLevel ?? 1, predictedRoundLevel.value))

function loadSavedThresholds(themeId: GrowthThemeId = thresholdThemeId.value) {
  const values = state.value?.themes[themeId]?.thresholds ?? defaultThresholds
  thresholdThemeId.value = themeId
  thresholdDraft.value = values.map(String)
  thresholdBaseline.value = JSON.stringify(values)
  thresholdConflict.value = false
}

watch(() => state.value?.themes[thresholdThemeId.value]?.thresholds, (values) => {
  if (!values) return
  if (!thresholdReady.value) {
    thresholdReady.value = true
    loadSavedThresholds(state.value?.growthThemeId ?? 'wizard')
  } else if (!thresholdsDirty.value && !thresholdConflict.value) {
    loadSavedThresholds()
  } else if (JSON.stringify(values) !== thresholdBaseline.value) {
    thresholdConflict.value = true
  }
}, { immediate: true, deep: true })

function selectThresholdTheme(event: Event) {
  const select = event.target as HTMLSelectElement
  if (thresholdsDirty.value || thresholdConflict.value) {
    select.value = thresholdThemeId.value
    return
  }
  loadSavedThresholds(select.value as GrowthThemeId)
  notice.value = ''
}

function fillDefaultThresholds() {
  thresholdDraft.value = defaultThresholds.map(String)
  notice.value = tr('默认值已填入草稿，保存后才会生效。', 'Defaults added to the draft. Save to apply them.')
}

async function saveThresholdDraft() {
  await attempt(async () => {
    if (thresholdError.value) throw new Error(thresholdError.value)
    const theme = thresholdTheme.value
    if (thresholdConflict.value || JSON.stringify(state.value?.themes[theme.id]?.thresholds) !== thresholdBaseline.value) throw new Error(tr('这个主题的门槛已更新，请先重新载入已保存值。', 'These thresholds changed elsewhere. Reload the saved values first.'))
    await setThresholds(theme.id, [...draftThresholds.value])
    loadSavedThresholds(theme.id)
    const themeName = growthThemeRegistry.value[theme.id].name
    notice.value = tr(`${themeName}的门槛已保存，已有次数和永久收藏保留。`, `Thresholds saved for ${themeName}. Existing counts and permanent outfits are preserved.`)
  })
}

function openTheme(themeId: OutfitThemeId) {
  detailThemeId.value = themeId
  notice.value = ''
}

function preview(level: number, themeId: GrowthThemeId) {
  previewThemeId.value = themeId
  selectedLevel.value = level
  previewDialog.value?.showModal()
}

async function chooseOutfitTheme(themeId: OutfitThemeId) {
  await attempt(async () => {
    await setOutfitTheme(themeId)
    notice.value = themeId === 'none' ? tr('已使用原始外观，培养继续。', 'Original appearance is active. Growth continues.') : tr(`已穿上${growthThemeRegistry.value[themeId].name}装扮，培养主题保持不变。`, `Now wearing ${growthThemeRegistry.value[themeId].name}. The growth theme is unchanged.`)
  })
}

async function chooseGrowthTheme(themeId: GrowthThemeId) {
  await attempt(async () => {
    await setGrowthTheme(themeId)
    notice.value = tr(`正在培养${growthThemeRegistry.value[themeId].name}，当前穿戴保持不变。`, `Now growing ${growthThemeRegistry.value[themeId].name}. Your outfit is unchanged.`)
  })
}

function selectGrowthTheme(event: Event) {
  return chooseGrowthTheme((event.target as HTMLSelectElement).value as GrowthThemeId)
}

async function wearSelected() {
  await attempt(async () => {
    await equip(selected.value.level, previewThemeId.value)
    notice.value = tr(`已穿上${selected.value.name}，培养主题保持不变。`, `Now wearing ${selected.value.name}. The growth theme is unchanged.`)
  })
}

function isEquipped(level: number, themeId: GrowthThemeId) {
  return state.value?.outfitThemeId === themeId && state.value.themes[themeId]?.equippedLevel === level
}

function isUnlocked(level: number, themeId: GrowthThemeId) {
  return level <= (state.value?.themes[themeId]?.unlockedLevel ?? 1)
}

const settings = computed(() => [
  { key: 'autoCycle', title: tr('满级后自动循环', 'Cycle themes at max level'), description: tr('满级后培养并穿上下一主题；全部完成后开启新一轮，永久收藏保留。', 'At max level, grow and wear the next theme. Completing all themes starts a new cycle and keeps your permanent collection.') },
  { key: 'autoEquip', title: tr('升级自动换装', 'Equip outfits on level-up'), description: tr('穿戴当前培养系列时，随升级换上新装。', 'Automatically wear newly unlocked outfits when wearing the active growth theme.') },
  { key: 'decorationsEnabled', title: tr('显示主题装饰', 'Show theme decorations'), description: tr('控制帽子、衣饰和道具，保留猫爪与输入反馈。', 'Show hats, clothing, and props while keeping paw and input feedback active.') },
  { key: 'showProgress', title: tr('显示等级圆环', 'Show level ring'), description: tr('在桌面角落显示小圆环和等级数字。', 'Show a small progress ring and level number in the desk corner.') },
  { key: 'reducedMotion', title: tr('低动效', 'Reduced motion'), description: tr('减少装扮动效，保留猫爪响应。', 'Reduce outfit animation while keeping paw responses.') },
  { key: 'quietMode', title: tr('安静模式', 'Quiet mode'), description: tr('升级不弹提示，解锁和进度照常保留。', 'Hide level-up notices while keeping unlocks and progress.') },
] as const)

function format(value: number) {
  return value.toLocaleString(locale.value)
}

// A toast belongs to the completed action in its original language. Clear
// transient UI on a locale change; persisted service errors translate live.
watch(locale, () => {
  notice.value = ''
  localError.value = ''
})

async function attempt(action: () => Promise<void>) {
  localError.value = ''
  notice.value = ''
  clearError()
  try {
    await action()
  } catch (reason) {
    localError.value = reason instanceof Error ? reason.message : String(reason)
  }
}

async function toggleSetting(key: keyof GrowthSettings) {
  await attempt(async () => {
    await updateSettings({ [key]: !state.value?.[key] })
  })
}

function downloadDemoBackup(json: string, name: string) {
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

async function handleExport() {
  localBusy.value = true
  await attempt(async () => {
    const json = await exportBackup()
    const name = `bongocat-empire-${isDemo ? 'demo-' : ''}${new Date().toISOString().slice(0, 10)}.json`
    if (isDemo) {
      downloadDemoBackup(json, name)
      notice.value = tr('已生成演示备份，不包含真实成长进度。', 'Demo backup created. It contains no real growth progress.')
      return
    }
    const path = await save({ title: tr('导出成长备份', 'Export growth backup'), defaultPath: name, filters: [{ name: tr('JSON 成长备份', 'JSON growth backup'), extensions: ['json'] }] })
    if (!path) return
    await writeTextFile(path, json)
    notice.value = tr(`备份已保存：${path}`, `Backup saved: ${path}`)
  })
  localBusy.value = false
}

function prepareImport(name: string, json: string) {
  if (json.length > 2 * 1024 * 1024) throw new Error(tr('备份文件超过 2 MB，请选择由本应用导出的成长备份。', 'The file exceeds 2 MB. Choose a growth backup exported by this app.'))
  try {
    JSON.parse(json)
  } catch {
    throw new Error(tr('备份不是有效的 JSON 文件。', 'This backup is not valid JSON.'))
  }
  backupDraft.value = { name, json }
  pendingConfirmation.value = 'import'
  confirmDialog.value?.showModal()
}

async function handleImport() {
  if (isDemo) {
    fileInput.value?.click()
    return
  }
  localBusy.value = true
  await attempt(async () => {
    const path = await open({ title: tr('选择成长备份', 'Choose a growth backup'), multiple: false, directory: false, filters: [{ name: tr('JSON 成长备份', 'JSON growth backup'), extensions: ['json'] }] })
    if (!path || Array.isArray(path)) return
    prepareImport(path.split(/[\\/]/).pop() ?? path, await readTextFile(path))
  })
  localBusy.value = false
}

async function onDemoFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  localBusy.value = true
  await attempt(async () => {
    if (file.size > 2 * 1024 * 1024) throw new Error(tr('请使用小于 2 MB 的演示备份。', 'Choose a demo backup smaller than 2 MB.'))
    prepareImport(file.name, await file.text())
  })
  input.value = ''
  localBusy.value = false
}

function requestReset() {
  localError.value = ''
  clearError()
  pendingConfirmation.value = 'reset'
  confirmDialog.value?.showModal()
}

function cancelConfirmation() {
  if (working.value) return
  confirmDialog.value?.close()
  pendingConfirmation.value = null
  backupDraft.value = null
}

async function confirmAction() {
  await attempt(async () => {
    if (pendingConfirmation.value === 'import' && backupDraft.value) {
      await importBackup(backupDraft.value.json)
      notice.value = tr('已恢复所选备份，成长记录和穿戴状态已更新。', 'Backup restored. Growth records and equipped outfits are updated.')
    } else if (pendingConfirmation.value === 'reset') {
      await reset()
      notice.value = tr('成长进度已清空，各系列从第一级重新出发。', 'Growth progress cleared. Every theme starts again at level 1.')
    }
    confirmDialog.value?.close()
    pendingConfirmation.value = null
    backupDraft.value = null
  })
}

async function changeDemo(event: Event) {
  const value = Number((event.target as HTMLInputElement).value)
  await attempt(async () => setDemoPresses(value))
}
</script>

<template>
  <main
    class="growth-panel"
    :data-section="props.section"
  >
    <p
      v-if="isDemo"
      class="demo-banner"
      role="status"
    >
      {{ tr('浏览器演示 · 不读取键盘或修改真实存档', 'Browser demo · No keyboard monitoring or changes to real saves') }}
    </p>
    <div
      v-if="displayError"
      class="alert alert-error"
      role="alert"
    >
      <p>{{ displayError }}</p><button
        class="button button-small"
        :disabled="working"
        type="button"
        @click="attempt(refresh)"
      >
        {{ tr('重新加载', 'Reload') }}
      </button>
    </div>
    <div
      v-if="state?.saveError"
      class="alert alert-error"
      role="alert"
    >
      <p>{{ tr('记录尚未保存：', 'Progress not saved: ') }}{{ translateEmpireError(state.saveError, locale) }}</p>
    </div>
    <div
      v-if="!isDemo && state && (state.listenerError || !state.listening)"
      class="alert alert-warning"
      role="alert"
    >
      <p>{{ translateEmpireError(state.listenerError || '', locale) || tr('输入监听尚未就绪，请在更多设置中检查权限。', 'The input listener is not ready. Check permissions under More settings.') }}</p><button
        class="button button-small"
        :disabled="working"
        type="button"
        @click="attempt(refresh)"
      >
        {{ tr('刷新状态', 'Refresh status') }}
      </button>
    </div>
    <div
      v-if="notice"
      class="alert alert-success"
      role="status"
    >
      <p>{{ notice }}</p><button
        :aria-label="tr('关闭提示', 'Dismiss notice')"
        class="dismiss"
        type="button"
        @click="notice = ''"
      >
        ×
      </button>
    </div>
    <div
      v-if="!state"
      class="loading-state"
      role="status"
    >
      <p>{{ error ? tr('暂时无法读取成长记录。', 'Growth records are temporarily unavailable.') : tr('正在读取成长记录…', 'Loading growth records…') }}</p>
      <button
        v-if="error"
        class="button"
        :disabled="working"
        type="button"
        @click="attempt(refresh)"
      >
        {{ tr('重新加载', 'Reload') }}
      </button>
    </div>
    <template v-else>
      <section
        v-if="props.section === 'themes'"
        :aria-label="tr('主题装扮', 'Theme outfits')"
        data-growth-section="themes"
      >
        <template v-if="detailThemeId === null">
          <p class="section-copy">
            {{ tr('选择主题查看九套装扮，预览不会改变穿戴。', 'Choose a theme to view its nine outfits. Previewing leaves your equipped outfit unchanged.') }}
          </p>
          <div class="theme-grid">
            <button
              v-for="option in outfitThemeOptions"
              :key="option.id"
              :aria-label="tr(`查看${option.name}主题`, `View ${option.name} theme`)"
              class="theme-card"
              :data-theme="option.id"
              type="button"
              @click="openTheme(option.id)"
            >
              <WizardPet
                :blink-eyes="false"
                class="theme-art"
                :idle-pointer-raised="catStore.model.idlePointerRaised"
                :input="stillInput"
                :level="option.id === 'none' ? 1 : 5"
                :outfit-theme-id="option.id"
                reduced-motion
                :show-progress="false"
              />
              <strong>{{ option.name }}</strong><span class="theme-status">{{ state.outfitThemeId === option.id ? tr('当前穿戴', 'Currently equipped') : option.id !== 'none' && state.growthThemeId === option.id ? tr('正在培养', 'Growing now') : option.id === 'none' ? tr('原来的白猫', 'The original white cat') : tr('九套装扮', 'Nine outfits') }}</span>
            </button>
          </div>
        </template>
        <template v-else>
          <button
            class="button button-subtle back-to-themes"
            type="button"
            @click="detailThemeId = null"
          >
            {{ tr('← 返回主题', '← Back to themes') }}
          </button>
          <template v-if="detailTheme">
            <div class="detail-heading">
              <div><h2>{{ detailTheme.name }}</h2><p>{{ tr(`已收藏 ${state.themes[detailTheme.id].unlockedLevel} / 9 · 点击任意等级预览`, `Collected ${state.themes[detailTheme.id].unlockedLevel} / 9 · Select a level to preview`) }}</p></div>
              <div class="detail-actions">
                <button
                  class="button"
                  :disabled="working || !initialized || state.growthThemeId === detailTheme.id"
                  type="button"
                  @click="chooseGrowthTheme(detailTheme.id)"
                >
                  {{ state.growthThemeId === detailTheme.id ? tr('正在培养', 'Growing now') : tr('培养这个主题', 'Grow this theme') }}
                </button><button
                  class="button button-primary"
                  :disabled="working || !initialized || state.outfitThemeId === detailTheme.id"
                  type="button"
                  @click="chooseOutfitTheme(detailTheme.id)"
                >
                  {{ state.outfitThemeId === detailTheme.id ? tr(`正在穿戴 LV${state.themes[detailTheme.id].equippedLevel}`, `Wearing LV${state.themes[detailTheme.id].equippedLevel}`) : tr(`穿戴 LV${state.themes[detailTheme.id].equippedLevel} 套装`, `Wear LV${state.themes[detailTheme.id].equippedLevel} outfit`) }}
                </button>
              </div>
            </div>
            <div class="outfit-grid">
              <button
                v-for="outfit in detailTheme.levels"
                :key="outfit.level"
                :aria-label="tr(`预览 LV ${outfit.level} ${outfit.name}，${isUnlocked(outfit.level, detailTheme.id) ? tr('已解锁', 'Unlocked') : tr('尚未解锁', 'Locked')}`, `Preview LV ${outfit.level} ${outfit.name}, ${isUnlocked(outfit.level, detailTheme.id) ? 'Unlocked' : 'Locked'}`)"
                class="outfit-card"
                :class="{ equipped: isEquipped(outfit.level, detailTheme.id), locked: !isUnlocked(outfit.level, detailTheme.id) }"
                :data-level="outfit.level"
                type="button"
                @click="preview(outfit.level, detailTheme.id)"
              >
                <WizardPet
                  :blink-eyes="false"
                  class="wardrobe-render"
                  :idle-pointer-raised="catStore.model.idlePointerRaised"
                  :input="stillInput"
                  :level="outfit.level"
                  :name="outfit.name"
                  :outfit-theme-id="detailTheme.id"
                  reduced-motion
                  :show-progress="false"
                />
                <div class="outfit-caption">
                  <span class="level-token">LV {{ outfit.level }}</span><strong>{{ outfit.name }}</strong><small>{{ isEquipped(outfit.level, detailTheme.id) ? tr('正在穿戴', 'Equipped') : isUnlocked(outfit.level, detailTheme.id) ? tr('已收藏', 'Collected') : tr(`${format(state.themes[detailTheme.id].thresholds[outfit.level - 1])} 次解锁`, `Unlock at ${format(state.themes[detailTheme.id].thresholds[outfit.level - 1])} keypresses`) }}</small>
                </div>
              </button>
            </div>
          </template>
          <div
            v-else
            class="original-detail"
          >
            <WizardPet
              :blink-eyes="false"
              class="original-preview"
              :idle-pointer-raised="catStore.model.idlePointerRaised"
              :input="stillInput"
              :level="1"
              outfit-theme-id="none"
              reduced-motion
              :show-progress="false"
            /><h2>{{ tr('原始外观', 'Original appearance') }}</h2><p>{{ tr('脱下配饰，当前主题继续成长。', 'Remove accessories while your current theme keeps growing.') }}</p><button
              class="button button-primary"
              :disabled="working || !initialized || state.outfitThemeId === 'none'"
              type="button"
              @click="chooseOutfitTheme('none')"
            >
              {{ state.outfitThemeId === 'none' ? tr('正在使用', 'In use') : tr('使用原始外观', 'Use original appearance') }}
            </button>
          </div>
        </template>
      </section>

      <section
        v-else-if="props.section === 'progress'"
        :aria-label="tr('养成进度', 'Growth progress')"
        data-growth-section="progress"
      >
        <div class="selection-row">
          <label for="growth-theme">{{ tr('正在培养', 'Growing now') }}</label><select
            id="growth-theme"
            :disabled="working || !initialized"
            :value="state.growthThemeId"
            @change="selectGrowthTheme"
          >
            <option
              v-for="theme in growthThemeRegistry"
              :key="theme.id"
              :value="theme.id"
            >
              {{ theme.name }}
            </option>
          </select>
        </div>
        <p class="section-copy">
          {{ tr('手动切换培养主题不改变穿戴，每个主题分别记录进度。', 'Changing the growth theme leaves your outfit unchanged. Each theme tracks its own progress.') }}
        </p>
        <div class="journey-card">
          <div class="journey-topline">
            <span>{{ tr(`第 ${state.cycleRound} 轮`, `Cycle ${state.cycleRound}`) }} · {{ activeTheme.name }}</span><span>{{ statusLabel }}</span>
          </div><h2><span>LV {{ current.level }}</span> {{ current.name }}</h2><p class="journey-story">
            {{ current.story }}
          </p>
          <div class="progress-label">
            <span>{{ next ? tr(`下一阶 · ${next.name}`, `Next level · ${next.name}`) : tr('本轮九级已完成', 'All nine levels completed this cycle') }}</span><strong>{{ Math.floor(progress) }}%</strong>
          </div><div
            :aria-label="tr('升阶进度', 'Level progress')"
            aria-valuemax="100"
            aria-valuemin="0"
            :aria-valuenow="Math.floor(progress)"
            class="progress-track"
            role="progressbar"
          >
            <span :style="{ width: `${progress}%` }" />
          </div><p class="section-copy">
            {{ next ? tr(`再按 ${format(remaining)} 次，到达下一阶。`, `${format(remaining)} more keypresses to the next level.`) : state.autoCycle ? tr('满级后自动培养并穿戴下一主题。', 'At max level, the next theme will be grown and equipped automatically.') : tr('可以换个主题继续培养，或在设置中开启自动循环。', 'Choose another theme to grow, or turn on automatic cycling in settings.') }}
          </p>
          <div class="progress-actions">
            <span>{{ state.autoCycle ? tr('自动循环已开启', 'Automatic cycling on') : tr('自动循环已关闭', 'Automatic cycling off') }}</span><button
              class="button"
              :disabled="working || !initialized"
              type="button"
              @click="toggleSetting('paused')"
            >
              {{ state.paused ? tr('继续成长', 'Resume growth') : tr('暂停计数', 'Pause counting') }}
            </button>
          </div>
        </div>
        <div class="metrics-grid">
          <div><strong>{{ format(state.roundPresses) }}</strong><span>{{ tr('本主题本轮按键', 'Theme keypresses this cycle') }}</span></div><div><strong>{{ format(state.themePresses) }}</strong><span>{{ tr('本主题历史按键', 'Theme lifetime keypresses') }}</span></div><div><strong>{{ format(state.totalPresses) }}</strong><span>{{ tr('全部累计按键', 'Total lifetime keypresses') }}</span></div><div><strong>{{ state.unlockedLevels.length }} / 9</strong><span>{{ tr('本主题永久收藏', 'Permanent theme collection') }}</span></div><div><strong>{{ completedThemes }} / 12</strong><span>{{ tr('本轮完成主题', 'Themes completed this cycle') }}</span></div>
        </div>
        <div
          v-if="isDemo"
          class="demo-controls"
        >
          <label for="demo-presses">{{ tr(`本轮模拟按键 · ${format(state.roundPresses)} 次`, `Simulated keypresses this cycle · ${format(state.roundPresses)}`) }}</label><input
            id="demo-presses"
            :disabled="working"
            :max="demoMaximum"
            min="0"
            step="100"
            type="range"
            :value="state.roundPresses"
            @change="changeDemo"
          ><small>{{ tr('只模拟本页，永久收藏不会减少。', 'Simulates this page only. Your permanent collection never decreases.') }}</small>
        </div>
        <p class="fine-print">
          {{ tr('只记录有效按下次数，不保存输入内容。长按记一次，触摸板、鼠标和手柄不增加成长计数。', 'Only valid keypress counts are recorded, never typed content. Holding a key counts once. Trackpad, mouse, and gamepad input do not add growth points.') }}
        </p>
      </section>

      <section
        v-else-if="props.section === 'thresholds'"
        :aria-label="tr('升级门槛', 'Level thresholds')"
        data-growth-section="thresholds"
      >
        <div class="selection-row">
          <label for="threshold-theme">{{ tr('编辑主题', 'Edit theme') }}</label><select
            id="threshold-theme"
            :disabled="working || !initialized || thresholdsDirty || thresholdConflict"
            :value="thresholdThemeId"
            @change="selectThresholdTheme"
          >
            <option
              v-for="theme in growthThemeRegistry"
              :key="theme.id"
              :value="theme.id"
            >
              {{ theme.name }}
            </option>
          </select>
        </div>
        <p class="section-copy">
          {{ tr('填写九级累计按键数，后一级要大于前一级。保存只影响所选主题，已有收藏不会收回。', 'Enter nine increasing cumulative keypress thresholds. Saving affects this theme only and keeps all collected outfits.') }}
        </p>
        <form
          class="threshold-editor"
          @submit.prevent="saveThresholdDraft"
        >
          <div class="threshold-grid">
            <label
              v-for="(outfit, index) in thresholdTheme.levels"
              :key="outfit.level"
              :for="`threshold-${outfit.level}`"
            ><span>LV {{ outfit.level }} · {{ outfit.name }}</span><input
              :id="`threshold-${outfit.level}`"
              v-model="thresholdDraft[index]"
              :aria-invalid="!!thresholdError"
              :aria-label="tr(`LV${outfit.level}累计门槛`, `LV${outfit.level} cumulative threshold`)"
              autocomplete="off"
              :disabled="working || !initialized"
              inputmode="numeric"
              :readonly="index === 0"
              type="text"
            ><small>{{ index === 0 ? tr('初始开放，固定为 0', 'Unlocked at the start; fixed at 0') : tr(`已保存 ${format(thresholdThemeProgress?.thresholds[index] ?? outfit.threshold)} 次`, `Saved: ${format(thresholdThemeProgress?.thresholds[index] ?? outfit.threshold)} keypresses`) }}</small></label>
          </div>
          <p
            v-if="thresholdError"
            class="threshold-validation"
            role="alert"
          >
            {{ thresholdError }}
          </p><p
            v-if="thresholdConflict"
            class="threshold-validation"
            role="alert"
          >
            {{ tr('这个主题的门槛已在别处更新，草稿仍保留。请重新载入已保存值再编辑。', 'These thresholds changed elsewhere. Your draft is preserved. Reload the saved values before editing again.') }}
          </p>
          <div
            v-if="!thresholdError"
            aria-live="polite"
            class="threshold-effect"
          >
            <strong>{{ tr('保存后的预览', 'Preview after saving') }}</strong><p>{{ tr(`本轮 ${format(thresholdThemeProgress?.roundPresses ?? 0)} 次，对应 LV${predictedRoundLevel}；永久收藏保留至 LV${predictedLevel}。`, `${format(thresholdThemeProgress?.roundPresses ?? 0)} keypresses this cycle: LV${predictedRoundLevel}. Permanent collection remains through LV${predictedLevel}.`) }}</p><p v-if="predictedRoundLevel === 9 && thresholdThemeId === state.growthThemeId && state.autoCycle">
              {{ tr('当前培养主题满级后会自动切换到下一主题。', 'The active growth theme will switch to the next theme at max level.') }}
            </p>
          </div>
          <p class="fine-print">
            {{ thresholdsDirty ? tr('草稿尚未保存。先保存或重新载入，再切换编辑主题。', 'Unsaved draft. Save or reload before editing another theme.') : tr('更改只进入草稿，点击保存后生效。', 'Changes stay in the draft until you save.') }}
          </p>
          <div class="threshold-actions">
            <button
              class="button button-subtle"
              :disabled="working || !initialized"
              type="button"
              @click="fillDefaultThresholds"
            >
              {{ tr('填入默认值', 'Fill defaults') }}
            </button><button
              v-if="thresholdsDirty || thresholdConflict"
              class="button"
              :disabled="working"
              type="button"
              @click="loadSavedThresholds()"
            >
              {{ tr('重新载入已保存值', 'Reload saved values') }}
            </button><button
              class="button button-primary"
              :disabled="working || !initialized || !thresholdsDirty || !!thresholdError || thresholdConflict"
              type="submit"
            >
              {{ working ? tr('正在保存…', 'Saving…') : tr('保存门槛', 'Save thresholds') }}
            </button>
          </div>
        </form>
      </section>

      <section
        v-else-if="props.section === 'settings'"
        :aria-label="tr('成长设置', 'Growth settings')"
        data-growth-section="settings"
      >
        <div class="settings-list">
          <div
            v-for="setting in settings"
            :key="setting.key"
            class="setting-row"
          >
            <div>
              <h3 :id="`label-${setting.key}`">
                {{ setting.title }}
              </h3><p :id="`description-${setting.key}`">
                {{ setting.description }}
              </p>
            </div><button
              :aria-checked="state[setting.key]"
              :aria-describedby="`description-${setting.key}`"
              :aria-labelledby="`label-${setting.key}`"
              class="toggle"
              :disabled="working || !initialized"
              role="switch"
              type="button"
              @click="toggleSetting(setting.key)"
            >
              <span />
            </button>
          </div>
        </div>
        <div class="more-settings">
          <slot name="more-settings" />
        </div>
      </section>

      <section
        v-else-if="props.section === 'backup'"
        :aria-label="tr('成长备份', 'Growth backup')"
        data-growth-section="backup"
      >
        <p class="section-copy">
          {{ tr('成长记录留在本机。可以导出一份备份，在需要时恢复。', 'Growth records stay on this device. Export a backup to restore them later.') }}
        </p><p class="saved-at">
          {{ lastSaved }}
        </p><p class="backup-count">
          {{ tr('当前累计', 'Lifetime total:') }} <strong>{{ format(state.totalPresses) }}</strong> {{ tr('次按键。', 'keypresses.') }}
        </p><div class="backup-actions">
          <button
            class="button button-primary"
            :disabled="working || !initialized"
            type="button"
            @click="handleExport"
          >
            {{ tr('导出备份', 'Export backup') }}
          </button><button
            class="button"
            :disabled="working || !initialized"
            type="button"
            @click="handleImport"
          >
            {{ tr('恢复备份', 'Restore backup') }}
          </button><button
            class="button button-danger"
            :disabled="working || !initialized"
            type="button"
            @click="requestReset"
          >
            {{ tr('清空进度', 'Clear progress') }}
          </button>
        </div>
      </section>
    </template>
    <input
      ref="fileInput"
      accept=".json,application/json"
      aria-hidden="true"
      class="visually-hidden"
      tabindex="-1"
      type="file"
      @change="onDemoFile"
    >
    <dialog
      ref="previewDialog"
      :aria-label="tr('装扮预览', 'Outfit preview')"
      class="growth-dialog preview-dialog"
    >
      <button
        :aria-label="tr('关闭装扮预览', 'Close outfit preview')"
        class="dialog-close"
        type="button"
        @click="previewDialog?.close()"
      >
        ×
      </button><div class="preview-layout">
        <WizardPet
          :blink-eyes="false"
          class="preview-art"
          :idle-pointer-raised="catStore.model.idlePointerRaised"
          :input="stillInput"
          :level="selected.level"
          :name="selected.name"
          :outfit-theme-id="previewThemeId"
          reduced-motion
          :show-progress="false"
        /><div class="preview-details">
          <p class="level-label">
            LV {{ selected.level }} · {{ growthThemeRegistry[previewThemeId].name }}
          </p><h2>{{ selected.name }}</h2>
          <div
            v-if="!selectedBody"
            :aria-label="tr('完整服饰细节', 'Full outfit details')"
            class="outfit-pieces"
          >
            <figure
              v-for="piece in [{ label: tr('头饰', 'Headwear'), art: selectedArt?.hat, description: selected.hat }, { label: tr('衣饰', 'Clothing'), art: selectedArt?.robe, description: selected.cape }, { label: tr('道具', 'Props'), art: selectedArt?.prop, description: selected.prop }]"
              :key="piece.label"
            >
              <img
                v-if="piece.art"
                :alt="piece.description"
                :src="piece.art.src"
              >
              <span
                v-else
                class="empty-piece"
              >{{ tr('原猫', 'Original cat') }}</span>
              <figcaption>{{ piece.label }}</figcaption>
            </figure>
          </div>
          <dl><div><dt>{{ tr('头饰', 'Headwear') }}</dt><dd>{{ selected.hat }}</dd></div><div><dt>{{ tr('衣饰', 'Clothing') }}</dt><dd>{{ selected.cape }}</dd></div><div><dt>{{ tr('道具', 'Props') }}</dt><dd>{{ selected.prop }}</dd></div></dl><p class="preview-story">
            {{ selected.story }}
          </p><p class="fine-print">
            {{ isUnlocked(selected.level, previewThemeId) ? tr('已加入永久收藏，可以随时穿戴。', 'Permanently collected. Wear it whenever you like.') : tr(`本轮累计 ${format(selected.threshold)} 次解锁。`, `Unlock at ${format(selected.threshold)} keypresses this cycle.`) }}
          </p><button
            class="button button-primary"
            :disabled="working || !initialized || !isUnlocked(selected.level, previewThemeId) || isEquipped(selected.level, previewThemeId)"
            type="button"
            @click="wearSelected"
          >
            {{ isEquipped(selected.level, previewThemeId) ? tr('正在穿戴', 'Equipped') : isUnlocked(selected.level, previewThemeId) ? tr('穿上这套', 'Wear this outfit') : tr('尚未解锁', 'Locked') }}
          </button>
        </div>
      </div>
    </dialog>
    <dialog
      ref="confirmDialog"
      :aria-label="tr('确认备份操作', 'Confirm backup action')"
      class="growth-dialog confirm-dialog"
      @cancel.prevent="cancelConfirmation"
    >
      <h2>{{ pendingConfirmation === 'import' ? tr('恢复这份备份？', 'Restore this backup?') : tr('清空成长进度？', 'Clear growth progress?') }}</h2><template v-if="pendingConfirmation === 'import'">
        <p class="backup-filename">
          {{ backupDraft?.name }}
        </p><p>{{ tr('将用备份中的记录替换当前进度和穿戴状态。', 'This backup will replace your current progress and equipped outfits.') }}</p>
      </template><p v-else>
        {{ tr('将清空累计次数和收藏，从第一级重新开始。此操作无法撤销，建议先导出备份。', 'This clears all counts and collected outfits and restarts at level 1. This cannot be undone. Export a backup first.') }}
      </p><p
        v-if="displayError"
        class="threshold-validation"
        role="alert"
      >
        {{ displayError }}
      </p><div class="confirm-actions">
        <button
          class="button"
          :disabled="working"
          type="button"
          @click="cancelConfirmation"
        >
          {{ tr('取消', 'Cancel') }}
        </button><button
          class="button button-danger"
          :disabled="working"
          type="button"
          @click="confirmAction"
        >
          {{ pendingConfirmation === 'import' ? tr('确认恢复', 'Restore backup') : tr('确认清空', 'Clear progress') }}
        </button>
      </div>
    </dialog>
  </main>
</template>

<style scoped>
.growth-panel {
  --g-ink: #453e37;
  --g-muted: #837a70;
  --g-line: #e6ded2;
  --g-accent: #786448;
  --g-surface: #fffdf8;
  width: 100%;
  min-width: 0;
  color: var(--g-ink);
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif;
  font-size: 13px;
  line-height: 1.6;
}
.growth-panel * {
  box-sizing: border-box;
}
.growth-panel p,
.growth-panel h2,
.growth-panel h3 {
  margin: 0;
}
.growth-panel h2 {
  font-size: 20px;
  font-weight: 650;
}
.growth-panel button,
.growth-panel input,
.growth-panel select {
  font: inherit;
}
.growth-panel button {
  cursor: pointer;
}
.growth-panel button:disabled {
  cursor: default;
  opacity: 0.45;
}
.growth-panel button:focus-visible,
.growth-panel input:focus-visible,
.growth-panel select:focus-visible,
.growth-dialog:focus-visible {
  outline: 3px solid #b4a184;
  outline-offset: 3px;
}
.growth-panel select {
  min-height: 40px;
  max-width: 100%;
  border: 1px solid #d9cfbf;
  border-radius: 9px;
  padding: 8px 30px 8px 12px;
  background: var(--g-surface);
  color: var(--g-ink);
}
.button {
  min-height: 38px;
  border: 1px solid #d9cfbf;
  border-radius: 9px;
  padding: 8px 14px;
  color: var(--g-ink);
  background: var(--g-surface);
  font-weight: 550;
  line-height: 1.4;
}
.button-primary {
  background: #776348;
  border-color: #776348;
  color: #fffdf8;
}
.button-subtle {
  background: transparent;
}
.button-small {
  min-height: 30px;
  padding: 5px 10px;
  font-size: 12px;
}
.button-danger {
  color: #995247;
  border-color: #dbc3bb;
  background: #fff9f5;
}
.section-copy,
.fine-print,
.saved-at {
  color: var(--g-muted);
}
.section-copy {
  margin-bottom: 18px !important;
}
.fine-print {
  font-size: 12px;
  margin-top: 15px !important;
}
.demo-banner {
  padding: 9px 12px;
  background: #f1ece1;
  border-radius: 8px;
  color: #7f705c;
  font-size: 12px;
  margin-bottom: 16px !important;
}
.alert {
  display: flex;
  align-items: center;
  gap: 12px;
  justify-content: space-between;
  padding: 11px 13px;
  border: 1px solid #ddd3c2;
  border-radius: 9px;
  margin-bottom: 14px;
}
.alert p {
  overflow-wrap: anywhere;
}
.alert-error {
  background: #fff1eb;
  border-color: #edc9bc;
  color: #925447;
}
.alert-warning {
  background: #fff5df;
}
.alert-success {
  background: #f0f3e8;
  color: #586846;
}
.dismiss {
  padding: 0 5px;
  border: 0;
  background: transparent;
  font-size: 21px;
  color: inherit;
}
.loading-state {
  padding: 30px;
  text-align: center;
}
.theme-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(145px, 1fr));
  gap: 14px;
}
.theme-card {
  min-width: 0;
  border: 1px solid var(--g-line);
  border-radius: 13px;
  padding: 10px 12px 13px;
  background: var(--g-surface);
  color: var(--g-ink);
  text-align: left;
  transition: border-color 0.15s;
}
.theme-card:hover {
  border-color: #ad9877;
}
.theme-art {
  width: 100%;
  aspect-ratio: 612/580;
  pointer-events: none;
  margin-bottom: 8px;
}
.theme-card strong {
  display: block;
  font-size: 14px;
}
.theme-status {
  display: block;
  font-size: 12px;
  color: var(--g-muted);
  margin-top: 2px;
}
.back-to-themes {
  margin-bottom: 20px;
}
.detail-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 22px;
}
.detail-heading p {
  margin-top: 4px;
  color: var(--g-muted);
  font-size: 12px;
}
.detail-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.outfit-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}
.outfit-card {
  min-width: 0;
  padding: 10px;
  border: 1px solid var(--g-line);
  border-radius: 12px;
  background: var(--g-surface);
  text-align: left;
  color: var(--g-ink);
}
.outfit-card:hover {
  border-color: #ad9877;
}
.outfit-card.equipped {
  border-color: #8c7758;
  background: #f7f1e6;
}
.wardrobe-render {
  width: 100%;
  aspect-ratio: 612/580;
  pointer-events: none;
}
.outfit-caption {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 3px 7px;
  padding: 7px 4px 3px;
}
.outfit-caption strong {
  font-size: 13px;
}
.outfit-caption small {
  width: 100%;
  font-size: 11px;
  color: var(--g-muted);
}
.level-token,
.level-label {
  font-size: 11px;
  color: #978365;
}
.locked .outfit-caption small {
  color: #9a8f80;
}
.original-detail {
  text-align: center;
  max-width: 360px;
  margin: 0 auto;
}
.original-preview {
  width: 100%;
  aspect-ratio: 612/580;
  pointer-events: none;
}
.original-detail p {
  color: var(--g-muted);
  margin: 9px 0 18px;
}
.selection-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}
.selection-row label {
  font-weight: 600;
  flex-shrink: 0;
}
.selection-row select {
  flex: 1;
  min-width: 0;
  max-width: 270px;
}
.journey-card {
  background: var(--g-surface);
  border: 1px solid var(--g-line);
  border-radius: 14px;
  padding: 24px;
}
.journey-topline {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  color: var(--g-muted);
  font-size: 12px;
  margin-bottom: 18px;
}
.journey-card h2 span {
  color: #9d855d;
  font-weight: 500;
}
.journey-story {
  color: #756b60;
  margin: 12px 0 24px !important;
}
.progress-label {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  font-size: 12px;
}
.progress-track {
  height: 8px;
  border-radius: 9px;
  background: #eae3d6;
  overflow: hidden;
  margin: 8px 0 9px;
}
.progress-track span {
  display: block;
  height: 100%;
  background: #9b8765;
  border-radius: 9px;
}
.journey-card .section-copy {
  margin: 0 !important;
  font-size: 12px;
}
.progress-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--g-line);
  font-size: 12px;
  color: var(--g-muted);
}
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 12px;
  margin-top: 18px;
}
.metrics-grid > div {
  padding: 16px;
  background: #f2ece1;
  border-radius: 11px;
}
.metrics-grid strong,
.metrics-grid span {
  display: block;
}
.metrics-grid strong {
  font-size: 20px;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}
.metrics-grid span {
  font-size: 11px;
  color: var(--g-muted);
  margin-top: 3px;
}
.demo-controls {
  margin-top: 20px;
  padding: 15px;
  background: #f2ece1;
  border-radius: 10px;
}
.demo-controls label,
.demo-controls small {
  display: block;
}
.demo-controls input {
  width: 100%;
  margin: 10px 0;
}
.demo-controls small {
  color: var(--g-muted);
}
.threshold-editor {
  padding: 22px;
  border: 1px solid var(--g-line);
  background: var(--g-surface);
  border-radius: 13px;
}
.threshold-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px 14px;
}
.threshold-grid label {
  min-width: 0;
}
.threshold-grid span {
  display: block;
  font-size: 12px;
  font-weight: 550;
  margin-bottom: 6px;
}
.threshold-grid input {
  width: 100%;
  min-width: 0;
  min-height: 40px;
  border: 1px solid #d9cfbf;
  border-radius: 8px;
  background: #fff;
  padding: 8px 10px;
  color: var(--g-ink);
  font-variant-numeric: tabular-nums;
}
.threshold-grid input[readonly] {
  background: #f1ede5;
  color: #8e857a;
}
.threshold-grid small {
  display: block;
  margin-top: 5px;
  color: var(--g-muted);
  font-size: 11px;
}
.threshold-validation {
  font-size: 12px;
  color: #995247;
  background: #fff0e9;
  border-radius: 8px;
  padding: 11px 12px;
  margin-top: 14px !important;
}
.threshold-effect {
  margin-top: 20px;
  padding: 13px 15px;
  background: #f3eee3;
  border-radius: 9px;
  font-size: 12px;
  color: #7b6c54;
}
.threshold-effect p {
  margin-top: 5px;
}
.threshold-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 19px;
}
.threshold-actions > .button:first-child {
  margin-right: auto;
}
.settings-list {
  border: 1px solid var(--g-line);
  border-radius: 12px;
  padding: 0 20px;
  background: var(--g-surface);
}
.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 22px;
  padding: 18px 0;
  border-bottom: 1px solid var(--g-line);
}
.setting-row:last-child {
  border: 0;
}
.setting-row h3 {
  font-size: 14px;
  font-weight: 600;
}
.setting-row p {
  font-size: 12px;
  color: var(--g-muted);
  margin-top: 4px;
}
.toggle {
  flex-shrink: 0;
  width: 42px;
  height: 25px;
  padding: 3px;
  border: 0;
  border-radius: 15px;
  background: #d9d1c4;
  transition: background 0.15s;
}
.toggle span {
  display: block;
  width: 19px;
  height: 19px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px #0002;
  transition: transform 0.15s;
}
.toggle[aria-checked='true'] {
  background: #8b7759;
}
.toggle[aria-checked='true'] span {
  transform: translateX(17px);
}
.more-settings {
  margin-top: 24px;
}
.backup-count {
  margin-top: 20px !important;
}
.backup-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 22px;
}
.saved-at {
  font-size: 12px;
}
.backup-filename {
  font-weight: 600;
  overflow-wrap: anywhere;
}
.growth-dialog {
  position: fixed;
  width: min(760px, calc(100vw - 40px));
  max-height: calc(100vh - 40px);
  padding: 26px;
  border: 1px solid #ddd2c2;
  border-radius: 16px;
  background: #fffaf0;
  color: var(--g-ink);
  box-shadow: 0 18px 80px #382c242c;
  overflow: auto;
}
.growth-dialog::backdrop {
  background: #2d261f66;
}
.dialog-close {
  position: absolute;
  right: 12px;
  top: 8px;
  width: 32px;
  height: 32px;
  border: 0;
  background: transparent;
  color: #7b7064;
  font-size: 25px;
}
.preview-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 25px;
  align-items: center;
}
.preview-art {
  width: 100%;
  aspect-ratio: 612/580;
  pointer-events: none;
}
.preview-details h2 {
  margin-top: 4px;
}
.outfit-pieces {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin: 14px 0;
}
.outfit-pieces figure {
  margin: 0;
  padding: 8px;
  border-radius: 12px;
  background: #ece6db;
  text-align: center;
}
.outfit-pieces img,
.empty-piece {
  width: 100%;
  height: 76px;
  object-fit: contain;
}
.empty-piece {
  display: grid;
  place-items: center;
  color: var(--g-muted);
}
.outfit-pieces figcaption {
  margin-top: 6px;
  font-size: 11px;
  color: #625b6b;
}
.preview-details dl {
  margin: 18px 0;
  font-size: 12px;
}
.preview-details dl > div {
  display: flex;
  gap: 12px;
  margin: 7px 0;
}
.preview-details dt {
  flex: 0 0 30px;
  color: var(--g-muted);
}
.preview-details dd {
  margin: 0;
}
.preview-story {
  font-size: 12px;
  color: #7c6c55;
  padding: 12px;
  border-radius: 8px;
  background: #f1e9da;
}
.preview-details > .button {
  margin-top: 16px;
}
.confirm-dialog {
  max-width: 430px;
  padding: 26px;
}
.confirm-dialog h2 {
  font-size: 19px;
  margin-bottom: 14px;
}
.confirm-dialog p {
  font-size: 13px;
  margin: 9px 0;
}
.confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 22px;
}
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  overflow: hidden;
  pointer-events: none;
}
@media (max-width: 600px) {
  .theme-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }
  .detail-heading {
    align-items: flex-start;
    flex-direction: column;
    gap: 14px;
  }
  .detail-actions {
    width: 100%;
  }
  .detail-actions > .button {
    flex: 1;
  }
  .outfit-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 11px;
  }
  .threshold-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .threshold-editor,
  .journey-card {
    padding: 17px;
  }
  .threshold-actions > .button {
    flex: 1;
  }
  .threshold-actions > .button:first-child {
    margin-right: 0;
  }
  .metrics-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .preview-layout {
    grid-template-columns: minmax(0, 1fr);
    gap: 8px;
  }
  .preview-art {
    max-width: 260px;
    margin: auto;
  }
  .growth-dialog {
    padding: 22px;
    width: calc(100vw - 28px);
    max-height: calc(100vh - 28px);
  }
  .preview-details h2 {
    font-size: 19px;
  }
  .settings-list {
    padding: 0 15px;
  }
  .setting-row {
    gap: 14px;
  }
  .journey-topline {
    flex-wrap: wrap;
    gap: 5px;
  }
  .theme-card {
    padding: 9px;
  }
  .outfit-caption strong {
    font-size: 12px;
  }
  .preview-details dl {
    margin: 12px 0;
  }
  .backup-actions > .button {
    flex: 1;
  }
}

/* Override the desktop pet's full-height root inside content-sized cards. */
.growth-panel .theme-art,
.growth-panel .wardrobe-render,
.growth-panel .original-preview,
.growth-panel .preview-art {
  height: auto;
}
.theme-card,
.outfit-card {
  display: grid;
  align-content: start;
}

@media (prefers-reduced-motion: reduce) {
  .growth-panel * {
    transition: none !important;
  }
}
</style>
