import { invoke, isTauri } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { computed, getCurrentInstance, getCurrentScope, onMounted, onScopeDispose, readonly, ref } from 'vue'

import type { GrowthThemeId, OutfitThemeId } from '@/data/wizard-theme'

import { defaultActiveDaysPerWeek, defaultDailyPressBudget, legacyDefaultThresholds, weeklyThresholds } from '@/data/growth-plan'
import { growthThemeIds, growthThemeRegistry, levelAtPresses, validateThresholds, wizardTheme } from '@/data/wizard-theme'

export interface GrowthThemeProgress {
  presses: number
  thresholds: number[]
  thresholdMode: 'weekly' | 'custom'
  roundPresses: number
  roundLevel: number
  unlockedLevel: number
  equippedLevel: number
}

export interface GrowthSnapshot {
  schemaVersion: number
  ruleVersion: number
  totalPresses: number
  growthThemeId: GrowthThemeId
  outfitThemeId: OutfitThemeId
  themes: Record<GrowthThemeId, GrowthThemeProgress>
  thresholds: number[]
  themePresses: number
  level: number
  equippedLevel: number
  unlockedLevels: number[]
  dailyPressBudget: number
  activeDaysPerWeek: number
  weeklyTargetPresses: number
  autoCycle: boolean
  cycleRound: number
  roundPresses: number
  roundLevel: number
  paused: boolean
  autoEquip: boolean
  reducedMotion: boolean
  showProgress: boolean
  quietMode: boolean
  decorationsEnabled: boolean
  saveError?: string | null
  listening: boolean
  listenerError?: string | null
  lastSavedAt?: string | number | null
}

export type GrowthSettings = Partial<Pick<GrowthSnapshot, 'paused' | 'autoEquip' | 'autoCycle' | 'reducedMotion' | 'showProgress' | 'quietMode' | 'decorationsEnabled'>>

const isDemo = typeof window !== 'undefined' && !isTauri()
const state = ref<GrowthSnapshot | null>(null)
const initialized = ref(false)
const error = ref<string | null>(null)
const pending = ref(0)
const busy = computed(() => pending.value > 0)
let consumers = 0
let generation = 0
let eventRevision = 0
let stopListening: (() => void) | undefined
let initialization: Promise<void> | undefined

function errorMessage(reason: unknown) {
  if (reason instanceof Error) return reason.message
  if (typeof reason === 'string') return reason
  try {
    return JSON.stringify(reason) || '操作未完成，请重试。'
  } catch {
    return '操作未完成，请重试。'
  }
}

function validateTheme(theme: GrowthThemeProgress, total: number) {
  if (!theme || !Number.isSafeInteger(theme.presses) || theme.presses < 0 || theme.presses > total
    || !Array.isArray(theme.thresholds) || validateThresholds(theme.thresholds)
    || !Number.isInteger(theme.unlockedLevel) || theme.unlockedLevel < 1 || theme.unlockedLevel > 9
    || !['weekly', 'custom'].includes(theme.thresholdMode)
    || !Number.isSafeInteger(theme.roundPresses) || theme.roundPresses < 0 || theme.roundPresses > theme.presses
    || !Number.isInteger(theme.roundLevel) || theme.roundLevel < 1 || theme.roundLevel > theme.unlockedLevel
    || theme.roundLevel < levelAtPresses(theme.roundPresses, theme.thresholds)
    || !Number.isInteger(theme.equippedLevel) || theme.equippedLevel < 1 || theme.equippedLevel > theme.unlockedLevel) {
    throw new Error('成长数据不完整，或累计、门槛与已解锁等级不一致。')
  }
}

function validateSettings(snapshot: GrowthSnapshot) {
  for (const key of ['paused', 'autoEquip', 'autoCycle', 'reducedMotion', 'showProgress', 'quietMode', 'decorationsEnabled'] as const) {
    if (typeof snapshot[key] !== 'boolean') throw new Error('成长设置数据不完整。')
  }
}

function applySnapshot(snapshot: GrowthSnapshot) {
  if (!snapshot || snapshot.schemaVersion !== 4 || snapshot.ruleVersion !== 1
    || !Number.isSafeInteger(snapshot.totalPresses) || snapshot.totalPresses < 0
    || !growthThemeIds.includes(snapshot.growthThemeId) || !['none', ...growthThemeIds].includes(snapshot.outfitThemeId)
    || !snapshot.themes?.wizard || Object.keys(snapshot.themes).length !== growthThemeIds.length || typeof snapshot.listening !== 'boolean') {
    throw new Error('收到的成长数据不完整，请重新加载；原存档不会被前端改写。')
  }
  growthThemeIds.forEach(id => validateTheme(snapshot.themes[id], snapshot.totalPresses))
  const weekly = weeklyThresholds(snapshot.dailyPressBudget, snapshot.activeDaysPerWeek)
  if (snapshot.weeklyTargetPresses !== weekly[8] || !Number.isSafeInteger(snapshot.cycleRound) || snapshot.cycleRound < 1
    || growthThemeIds.some(id => snapshot.themes[id].thresholdMode === 'weekly' && JSON.stringify(snapshot.themes[id].thresholds) !== JSON.stringify(weekly))) {
    throw new Error('每周节奏或轮次数据不一致，请重新加载。')
  }
  if (Object.values(snapshot.themes).reduce((sum, t) => sum + t.presses, 0) > snapshot.totalPresses) throw new Error('主题累计总和超过全局累计。')
  validateSettings(snapshot)
  const theme = snapshot.themes[snapshot.growthThemeId]
  if (snapshot.themePresses !== theme.presses || snapshot.level !== theme.unlockedLevel
    || snapshot.roundPresses !== theme.roundPresses || snapshot.roundLevel !== theme.roundLevel
    || snapshot.equippedLevel !== theme.equippedLevel
    || JSON.stringify(snapshot.thresholds) !== JSON.stringify(theme.thresholds)
    || JSON.stringify(snapshot.unlockedLevels) !== JSON.stringify(Array.from({ length: theme.unlockedLevel }, (_, index) => index + 1))) {
    throw new Error('成长状态与主题数据不一致，请重新加载。')
  }
  state.value = snapshot
}

function withTheme(snapshot: GrowthSnapshot, updatedTheme: GrowthThemeProgress, themeId = snapshot.growthThemeId): GrowthSnapshot {
  const themes = { ...snapshot.themes, [themeId]: updatedTheme }
  const theme = themes[snapshot.growthThemeId]
  return {
    ...snapshot,
    themes,
    themePresses: theme.presses,
    thresholds: [...theme.thresholds],
    level: theme.unlockedLevel,
    roundPresses: theme.roundPresses,
    roundLevel: theme.roundLevel,
    equippedLevel: theme.equippedLevel,
    unlockedLevels: Array.from({ length: theme.unlockedLevel }, (_, index) => index + 1),
  }
}

function demoState(presses = 8750): GrowthSnapshot {
  const thresholds = [...wizardTheme.defaultThresholds]
  const level = levelAtPresses(presses, thresholds)
  return {
    schemaVersion: 4,
    ruleVersion: 1,
    totalPresses: presses,
    growthThemeId: 'wizard',
    outfitThemeId: 'wizard',
    themes: Object.fromEntries(growthThemeIds.map(id => [id, { presses: id === 'wizard' ? presses : 0, roundPresses: id === 'wizard' ? presses : 0, roundLevel: id === 'wizard' ? level : 1, thresholdMode: 'weekly', thresholds: [...growthThemeRegistry[id].defaultThresholds], unlockedLevel: id === 'wizard' ? level : 1, equippedLevel: id === 'wizard' ? level : 1 }])) as Record<GrowthThemeId, GrowthThemeProgress>,
    thresholds: [...thresholds],
    themePresses: presses,
    level,
    roundPresses: presses,
    roundLevel: level,
    dailyPressBudget: defaultDailyPressBudget,
    activeDaysPerWeek: defaultActiveDaysPerWeek,
    weeklyTargetPresses: thresholds[8],
    autoCycle: true,
    cycleRound: 1,
    equippedLevel: level,
    unlockedLevels: Array.from({ length: level }, (_, index) => index + 1),
    paused: false,
    autoEquip: true,
    reducedMotion: true,
    showProgress: true,
    quietMode: false,
    decorationsEnabled: true,
    listening: false,
    lastSavedAt: null,
  }
}

function demoBackup(snapshot: GrowthSnapshot) {
  return {
    schemaVersion: 4,
    ruleVersion: 1,
    totalPresses: snapshot.totalPresses,
    growthThemeId: snapshot.growthThemeId,
    outfitThemeId: snapshot.outfitThemeId,
    themes: snapshot.themes,
    paused: snapshot.paused,
    autoEquip: snapshot.autoEquip,
    reducedMotion: snapshot.reducedMotion,
    showProgress: snapshot.showProgress,
    quietMode: snapshot.quietMode,
    decorationsEnabled: snapshot.decorationsEnabled,
    dailyPressBudget: snapshot.dailyPressBudget,
    activeDaysPerWeek: snapshot.activeDaysPerWeek,
    autoCycle: snapshot.autoCycle,
    cycleRound: snapshot.cycleRound,
  }
}

function readDemoBackup(json: string): GrowthSnapshot {
  const backup = JSON.parse(json) as { demo?: boolean, state?: GrowthSnapshot }
  if (backup.demo !== true || !backup.state) throw new Error('演示页只接受演示备份；真实存档请在安装版中恢复。')
  const data = backup.state
  if (![1, 2, 3, 4].includes(data.schemaVersion)) throw new Error('不支持的演示备份版本。')
  if (data.ruleVersion !== 1 || !Number.isSafeInteger(data.totalPresses) || data.totalPresses < 0) throw new Error('演示备份的规则版本或全局累计数据无效。')
  const requiredSettings = ['paused', 'autoEquip', 'reducedMotion', 'showProgress', 'quietMode'] as const
  if (requiredSettings.some(key => typeof data[key] !== 'boolean')) throw new Error('备份缺少完整的成长设置。')
  const commonKeys = ['schemaVersion', 'ruleVersion', 'totalPresses', ...requiredSettings]
  const allowedKeys = data.schemaVersion === 1
    ? [...commonKeys, 'themePresses', 'equippedLevel']
    : [...commonKeys, 'growthThemeId', 'outfitThemeId', 'themes', 'decorationsEnabled', ...(data.schemaVersion === 4 ? ['dailyPressBudget', 'activeDaysPerWeek', 'autoCycle', 'cycleRound'] : [])]
  if (Object.keys(data).some(key => !allowedKeys.includes(key))) throw new Error('备份含有本版本无法识别的字段。')
  if (data.schemaVersion === 4) {
    if (!data.themes?.[data.growthThemeId]) throw new Error('备份缺少当前培养主题。')
    const themeKeys = ['presses', 'thresholds', 'thresholdMode', 'roundPresses', 'roundLevel', 'unlockedLevel', 'equippedLevel']
    if (Object.values(data.themes).some(theme => !theme || Object.keys(theme).some(key => !themeKeys.includes(key)))) throw new Error('备份含有无法识别的主题字段。')
    return withTheme({ ...data, decorationsEnabled: data.decorationsEnabled === undefined ? true : data.decorationsEnabled, listening: false, listenerError: null, saveError: null, lastSavedAt: null, weeklyTargetPresses: weeklyThresholds(data.dailyPressBudget, data.activeDaysPerWeek)[8] }, data.themes[data.growthThemeId])
  }
  const next = { ...demoState(0), ...data, schemaVersion: 4, listening: false, listenerError: null, saveError: null, lastSavedAt: null, dailyPressBudget: defaultDailyPressBudget, activeDaysPerWeek: defaultActiveDaysPerWeek, weeklyTargetPresses: wizardTheme.defaultThresholds[8], autoCycle: true, cycleRound: 1 }
  if (data.schemaVersion === 1) {
    next.growthThemeId = 'wizard'
    next.outfitThemeId = 'wizard'
    next.themes = { ...demoState(0).themes, wizard: {
      presses: data.themePresses,
      thresholds: [...legacyDefaultThresholds],
      unlockedLevel: levelAtPresses(data.themePresses, legacyDefaultThresholds),
      equippedLevel: data.equippedLevel,
    } as GrowthThemeProgress }
  } else {
    if (!growthThemeIds.includes(data.growthThemeId) || !['none', ...growthThemeIds].includes(data.outfitThemeId)) throw new Error('备份主题无效。')
    if (!data.themes?.wizard || Object.keys(data.themes).some(id => !growthThemeIds.includes(id as GrowthThemeId)) || (data.schemaVersion === 3 && growthThemeIds.some(id => !data.themes[id]))) throw new Error('备份包含未知主题或缺少主题记录。')
    if (Object.values(data.themes).some(theme => !theme || Object.keys(theme).some(key => !['presses', 'thresholds', 'unlockedLevel', 'equippedLevel'].includes(key)))) throw new Error('旧版备份含有无法识别的主题字段。')
    next.themes = { ...demoState(0).themes, ...data.themes }
  }
  next.decorationsEnabled = data.decorationsEnabled === undefined ? true : data.decorationsEnabled
  const themes = Object.fromEntries(growthThemeIds.map((id) => {
    const old = next.themes[id]
    if (old.thresholdMode) return [id, old]
    if (!Array.isArray(old.thresholds) || validateThresholds(old.thresholds)
      || !Number.isSafeInteger(old.presses) || old.presses < 0 || old.presses > data.totalPresses
      || !Number.isInteger(old.unlockedLevel) || old.unlockedLevel < levelAtPresses(old.presses, old.thresholds) || old.unlockedLevel > 9
      || !Number.isInteger(old.equippedLevel) || old.equippedLevel < 1 || old.equippedLevel > old.unlockedLevel) {
      throw new Error('旧版主题进度或穿戴无效。')
    }
    const weekly = JSON.stringify(old.thresholds) === JSON.stringify(legacyDefaultThresholds)
    const thresholds = weekly ? [...wizardTheme.defaultThresholds] : [...old.thresholds]
    const roundLevel = Math.max(old.unlockedLevel, levelAtPresses(old.presses, thresholds))
    return [id, { ...old, thresholds, thresholdMode: weekly ? 'weekly' : 'custom', roundPresses: old.presses, roundLevel, unlockedLevel: roundLevel }]
  })) as Record<GrowthThemeId, GrowthThemeProgress>
  return withTheme({ ...next, themes }, themes[next.growthThemeId])
}

function advanceDemoCycle(snapshot: GrowthSnapshot): GrowthSnapshot {
  if (!snapshot.autoCycle || snapshot.paused || snapshot.roundLevel < 9) return snapshot
  const index = growthThemeIds.indexOf(snapshot.growthThemeId)
  let next = Array.from({ length: growthThemeIds.length }, (_, offset) => growthThemeIds[(index + offset + 1) % growthThemeIds.length]).find(id => snapshot.themes[id].roundLevel < 9)
  let themes = { ...snapshot.themes }
  let cycleRound = snapshot.cycleRound
  if (!next) {
    if (!Number.isSafeInteger(cycleRound + 1)) throw new Error('轮次数量已达到安全上限。')
    cycleRound += 1
    themes = Object.fromEntries(growthThemeIds.map(id => [id, { ...themes[id], roundPresses: 0, roundLevel: 1 }])) as Record<GrowthThemeId, GrowthThemeProgress>
    next = growthThemeIds[0]
  }
  return withTheme({ ...snapshot, themes, cycleRound, growthThemeId: next, outfitThemeId: next }, { ...themes[next], equippedLevel: themes[next].roundLevel }, next)
}

function withThresholds(snapshot: GrowthSnapshot, themeId: GrowthThemeId, thresholds: number[], thresholdMode: 'weekly' | 'custom') {
  const theme = snapshot.themes[themeId]
  const roundLevel = Math.max(theme.roundLevel, levelAtPresses(theme.roundPresses, thresholds))
  return withTheme(snapshot, { ...theme, thresholds: [...thresholds], thresholdMode, roundLevel, unlockedLevel: Math.max(theme.unlockedLevel, roundLevel), equippedLevel: snapshot.autoEquip && roundLevel > theme.roundLevel ? roundLevel : theme.equippedLevel }, themeId)
}

async function invokeSnapshot(command: string, args?: Record<string, unknown>) {
  const before = eventRevision
  const snapshot = await invoke<GrowthSnapshot>(command, args)
  if (before === eventRevision) applySnapshot(snapshot)
}

async function fetchSnapshot() {
  if (isDemo) {
    if (!state.value) applySnapshot(demoState())
    return
  }
  // A newer event received while this request is pending must not be overwritten.
  const before = eventRevision
  const epoch = generation
  const snapshot = await invoke<GrowthSnapshot>('growth_get_state')
  if (epoch === generation && (before === eventRevision || !state.value)) applySnapshot(snapshot)
}

async function init(): Promise<void> {
  if (initialized.value) return
  if (initialization) return initialization
  const epoch = ++generation
  const task = async () => {
    try {
      if (!isDemo) {
        const unlisten = await listen<GrowthSnapshot>('growth-changed', ({ payload }) => {
          if (epoch !== generation) return
          try {
            applySnapshot(payload)
            eventRevision += 1
          } catch (reason) {
            error.value = errorMessage(reason)
          }
        })
        if (epoch !== generation) {
          unlisten()
          return
        }
        stopListening = unlisten
      }
      await fetchSnapshot()
      if (epoch === generation) {
        initialized.value = true
        error.value = null
      }
    } catch (reason) {
      if (epoch === generation) {
        stopListening?.()
        stopListening = undefined
        error.value = errorMessage(reason)
      }
      throw reason
    } finally {
      if (epoch === generation) initialization = undefined
    }
  }
  initialization = task()
  return initialization
}

async function perform<T>(action: () => Promise<T>): Promise<T> {
  pending.value += 1
  error.value = null
  try {
    await init()
    return await action()
  } catch (reason) {
    error.value = errorMessage(reason)
    throw reason
  } finally {
    pending.value -= 1
  }
}

async function refresh() {
  return perform(fetchSnapshot)
}

async function updateSettings(settings: GrowthSettings) {
  return perform(async () => {
    if (isDemo) {
      const previous = state.value!
      applySnapshot(advanceDemoCycle(withTheme({ ...previous, ...settings }, {
        ...previous.themes[previous.growthThemeId],
        equippedLevel: settings.autoEquip === true ? previous.roundLevel : previous.equippedLevel,
      })))
    } else {
      await invokeSnapshot('growth_update_settings', { settings })
    }
  })
}

async function equip(level: number, themeId: GrowthThemeId = state.value?.growthThemeId ?? 'wizard') {
  return perform(async () => {
    if (!Number.isInteger(level) || level < 1 || level > (state.value?.themes[themeId]?.unlockedLevel ?? 0)) throw new Error('这套装扮尚未解锁，继续正常输入即可获得。')
    if (isDemo) {
      applySnapshot(withTheme({ ...state.value!, outfitThemeId: themeId }, { ...state.value!.themes[themeId], equippedLevel: level }, themeId))
    } else {
      await invokeSnapshot('growth_equip', { level, themeId })
    }
  })
}

async function setOutfitTheme(themeId: OutfitThemeId) {
  return perform(async () => {
    if (!['none', ...growthThemeIds].includes(themeId)) throw new Error('当前尚不支持这套穿戴系列。')
    if (isDemo) applySnapshot({ ...state.value!, outfitThemeId: themeId })
    else await invokeSnapshot('growth_set_outfit_theme', { themeId })
  })
}

async function setGrowthTheme(themeId: GrowthThemeId) {
  return perform(async () => {
    if (!growthThemeIds.includes(themeId)) throw new Error('不支持的成长主题。')
    if (isDemo) {
      const previous = state.value!
      applySnapshot(withTheme({ ...previous, growthThemeId: themeId }, previous.themes[themeId]))
    } else {
      await invokeSnapshot('growth_set_growth_theme', { themeId })
    }
  })
}

async function setThresholds(themeId: GrowthThemeId, thresholds: number[]) {
  return perform(async () => {
    if (!growthThemeIds.includes(themeId)) throw new Error('不支持的成长主题。')
    const invalid = validateThresholds(thresholds)
    if (invalid) throw new Error(invalid)
    if (isDemo) {
      const next = withThresholds(state.value!, themeId, thresholds, 'custom')
      applySnapshot(themeId === next.growthThemeId ? advanceDemoCycle(next) : next)
    } else {
      await invokeSnapshot('growth_set_thresholds', { themeId, thresholds })
    }
  })
}

async function setWeeklyPlan(dailyPressBudget: number, activeDaysPerWeek: number) {
  return perform(async () => {
    const thresholds = weeklyThresholds(dailyPressBudget, activeDaysPerWeek)
    if (isDemo) {
      let next = { ...state.value!, dailyPressBudget, activeDaysPerWeek, weeklyTargetPresses: thresholds[8] }
      for (const themeId of growthThemeIds) {
        if (next.themes[themeId].thresholdMode === 'weekly') next = withThresholds(next, themeId, thresholds, 'weekly')
      }
      applySnapshot(advanceDemoCycle(next))
    } else {
      await invokeSnapshot('growth_set_weekly_plan', { dailyPressBudget, activeDaysPerWeek })
    }
  })
}

async function useWeeklyThresholds(themeId: GrowthThemeId) {
  return perform(async () => {
    if (!growthThemeIds.includes(themeId)) throw new Error('不支持的成长主题。')
    if (isDemo) {
      const next = withThresholds(state.value!, themeId, weeklyThresholds(state.value!.dailyPressBudget, state.value!.activeDaysPerWeek), 'weekly')
      applySnapshot(themeId === next.growthThemeId ? advanceDemoCycle(next) : next)
    } else {
      await invokeSnapshot('growth_use_weekly_thresholds', { themeId })
    }
  })
}

async function exportBackup(): Promise<string> {
  return perform(async () => {
    if (isDemo) return JSON.stringify({ demo: true, state: demoBackup(state.value!) }, null, 2)
    return invoke<string>('growth_export')
  })
}

async function importBackup(json: string) {
  return perform(async () => {
    if (isDemo) applySnapshot(readDemoBackup(json))
    else await invokeSnapshot('growth_import', { json })
  })
}

async function reset() {
  return perform(async () => {
    if (isDemo) {
      const previous = state.value!
      const themes = Object.fromEntries(growthThemeIds.map(id => [id, { ...previous.themes[id], presses: 0, roundPresses: 0, roundLevel: 1, unlockedLevel: 1, equippedLevel: 1 }])) as Record<GrowthThemeId, GrowthThemeProgress>
      applySnapshot(withTheme({ ...previous, themes, totalPresses: 0, cycleRound: 1 }, themes[previous.growthThemeId]))
    } else {
      await invokeSnapshot('growth_reset')
    }
  })
}

async function setDemoPresses(presses: number) {
  return perform(async () => {
    if (!isDemo) throw new Error('模拟输入只在浏览器演示中可用。')
    if (!Number.isSafeInteger(presses) || presses < 0) throw new Error('演示计数必须是非负安全整数。')
    const previous = state.value!
    if (previous.paused) return
    const theme = previous.themes[previous.growthThemeId]
    const added = Math.max(0, presses - theme.roundPresses)
    if (!Number.isSafeInteger(previous.totalPresses + added)) throw new Error('演示计数超过安全范围。')
    const roundLevel = Math.max(theme.roundLevel, levelAtPresses(presses, theme.thresholds))
    applySnapshot(advanceDemoCycle(withTheme({ ...previous, totalPresses: previous.totalPresses + added }, {
      ...theme,
      presses: theme.presses + added,
      roundPresses: presses,
      roundLevel,
      unlockedLevel: Math.max(theme.unlockedLevel, roundLevel),
      equippedLevel: previous.autoEquip && roundLevel > theme.roundLevel ? roundLevel : theme.equippedLevel,
    })))
  })
}

function clearError() {
  error.value = null
}

function release() {
  consumers = Math.max(0, consumers - 1)
  if (consumers > 0) return
  generation += 1
  stopListening?.()
  stopListening = undefined
  initialization = undefined
  initialized.value = false
}

/** One authoritative backend snapshot per webview, shared by all mounted consumers. */
export function useGrowth() {
  if (getCurrentScope()) {
    consumers += 1
    onScopeDispose(release)
  }
  if (getCurrentInstance()) {
    onMounted(() => {
      // init writes a visible error; consumers can offer an explicit retry.
      void init().catch(() => {})
    })
  }
  return {
    state: readonly(state),
    initialized: readonly(initialized),
    error: readonly(error),
    busy,
    isDemo,
    init,
    refresh,
    updateSettings,
    equip,
    setOutfitTheme,
    setGrowthTheme,
    setThresholds,
    setWeeklyPlan,
    useWeeklyThresholds,
    exportBackup,
    importBackup,
    reset,
    setDemoPresses,
    clearError,
  }
}
