import type { UnlistenFn } from '@tauri-apps/api/event'
import type { ExpressionInfo, MotionInfo } from 'easy-live2d'

import { convertFileSrc, isTauri } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { join } from '@tauri-apps/api/path'
import { readDir, readTextFile } from '@tauri-apps/plugin-fs'
import { platform } from '@tauri-apps/plugin-os'
import JSON5 from 'json5'
import { computed, nextTick, onMounted, onUnmounted, readonly, ref, watch } from 'vue'

import { LISTEN_KEY } from '@/constants'
import { useCatStore } from '@/stores/cat'
import { useModelStore } from '@/stores/model'

export type CompanionMotion = 'idle' | 'bounce' | 'stretch'
export type CompanionExpression = 'normal' | 'happy' | 'sleepy'

interface MotionAsset {
  durationMs: number
  soundUrl?: string
}

function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function detail(reason: unknown) {
  return reason instanceof Error ? reason.message : String(reason)
}

/** Keep the same IDs and shortcut order as the native Live2D model controls. */
function defaultShortcut(index: number, mac: boolean) {
  const primary = mac ? 'Command' : 'Control'
  const modifiers = [[primary], [primary, 'Shift'], [primary, 'Alt'], [primary, 'Shift', 'Alt']]
  const tiers = ['1234567890', 'QWERTYUIOPASDFGHJKLZXCVBNM']
    .flatMap(keys => modifiers.map(modifier => ({ keys, modifier })))

  for (const { keys, modifier } of tiers) {
    if (index < keys.length) return [...modifier, keys[index]].join('+')
    index -= keys.length
  }
  return ''
}

/** Lightweight responses for the shared 2D scene; these do not replay Cubism curves. */
export function useCompanionBehavior() {
  const catStore = useCatStore()
  const modelStore = useModelStore()
  const native = isTauri()
  const motion = ref<CompanionMotion>('idle')
  const expression = ref<CompanionExpression>('normal')
  const loading = ref(false)
  const loadError = ref<string | null>(null)
  const listenerError = ref<string | null>(null)
  const actionError = ref<string | null>(null)
  const error = computed(() => [loadError.value, listenerError.value, actionError.value].filter(Boolean).join('；') || null)
  const unlisteners: UnlistenFn[] = []
  let disposed = false
  let generation = 0
  let playbackGeneration = 0
  let loadedModel = ''
  let motionAssets = new Map<string, MotionAsset>()
  let expressionCount = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  let audio: HTMLAudioElement | undefined

  function modelIdentity() {
    const model = modelStore.currentModel
    return model ? JSON.stringify([model.id, model.path]) : ''
  }

  function stopAudio() {
    const previous = audio
    audio = undefined
    if (!previous) return
    previous.onerror = null
    previous.pause()
    previous.removeAttribute('src')
    previous.load()
  }

  function stopMotion() {
    playbackGeneration += 1
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
    motion.value = 'idle'
    stopAudio()
  }

  function clearBehavior() {
    stopMotion()
    expression.value = 'normal'
  }

  async function reload() {
    const epoch = ++generation
    clearBehavior()
    loadedModel = ''
    motionAssets = new Map()
    expressionCount = 0
    loadError.value = null
    actionError.value = null
    if (!native || disposed) return

    const model = modelStore.currentModel
    const identity = modelIdentity()
    const current = () => !disposed && epoch === generation && identity === modelIdentity()
    modelStore.currentMotions = []
    modelStore.currentExpressions = []
    loading.value = Boolean(model)
    if (!model) return

    try {
      const files = await readDir(model.path)
      if (!current()) return
      const file = files.find(file => file.name === 'cat.model3.json')
        ?? files.find(file => file.name.endsWith('.model3.json'))
      if (!file) throw new Error('所选模型缺少 .model3.json 文件')
      const modelJson = object(JSON5.parse(await readTextFile(await join(model.path, file.name))))
      if (!current()) return
      if (!modelJson.FileReferences) throw new Error('模型文件缺少 FileReferences')
      const references = object(modelJson.FileReferences)
      const groups = object(references.Motions)
      const nextMotions: Array<[string, MotionInfo[]]> = []
      const nextAssets = new Map<string, MotionAsset>()
      const warnings = new Set<string>()
      const durations = new Map<string, Promise<number | undefined>>()
      const reads: Array<() => Promise<void>> = []

      for (const [group, entries] of Object.entries(groups)) {
        if (!Array.isArray(entries)) throw new Error(`动作组 ${group} 格式无效`)
        const items = entries.map((entry, no): MotionInfo => {
          const metadata = object(entry)
          if (typeof metadata.File !== 'string' || !metadata.File) throw new Error(`动作 ${group}_${no} 缺少文件路径`)
          const motionFile = metadata.File
          const soundFile = typeof metadata.Sound === 'string' ? metadata.Sound : undefined
          if (!durations.has(motionFile)) {
            durations.set(motionFile, (async () => {
              try {
                const json = object(JSON5.parse(await readTextFile(await join(model.path, motionFile))))
                const duration = object(json.Meta).Duration
                if (typeof duration !== 'number' || !Number.isFinite(duration) || duration <= 0) throw new Error('缺少有效时长')
                return Math.min(4000, Math.max(150, duration * 1000))
              } catch (reason) {
                warnings.add(`动作 ${motionFile} 时长读取失败，使用默认反馈：${detail(reason)}`)
                return undefined
              }
            })())
          }
          reads.push(async () => {
            const durationMs = await durations.get(motionFile) ?? (no === 1 ? 2300 : 1600)
            const asset: MotionAsset = { durationMs }
            if (soundFile) asset.soundUrl = convertFileSrc(await join(model.path, soundFile))
            nextAssets.set(JSON.stringify([group, no]), asset)
          })
          return { group, no, name: `${group}_${no}` }
        })
        nextMotions.push([group, items])
      }

      const expressions = references.Expressions ?? []
      if (!Array.isArray(expressions)) throw new Error('模型表情列表格式无效')
      const nextExpressions: ExpressionInfo[] = expressions.map((entry, index) => {
        const metadata = object(entry)
        return { name: typeof metadata.Name === 'string' ? metadata.Name : `Expression_${index}` }
      })
      await Promise.all(reads.map(read => read()))
      if (!current()) return
      motionAssets = nextAssets
      expressionCount = nextExpressions.length
      loadedModel = identity
      modelStore.currentMotions = nextMotions
      modelStore.currentExpressions = nextExpressions
      const ids = nextMotions.flatMap(([group, motions]) => motions.map(({ no }) => `${model.id}:motion:${group}:${no}`))
      ids.push(...nextExpressions.map((_, index) => `${model.id}:expression:${index}`))
      const mac = platform() === 'macos'
      for (const [index, id] of ids.entries()) {
        if (modelStore.shortcuts[id]) continue
        const shortcut = defaultShortcut(index, mac)
        if (shortcut) modelStore.shortcuts[id] = shortcut
      }
      loadError.value = warnings.size ? [...warnings].join('；') : null
    } catch (reason) {
      if (current()) loadError.value = `模型动作信息加载失败：${detail(reason)}`
    } finally {
      if (current()) loading.value = false
    }
  }

  async function startMotion(info: MotionInfo) {
    if (disposed || !catStore.model.behavior) return
    actionError.value = null
    if (!loadedModel || loadedModel !== modelIdentity()) {
      actionError.value = '模型动作尚未加载，请稍后重试'
      return
    }
    const asset = motionAssets.get(JSON.stringify([info?.group, info?.no]))
    if (!asset) {
      actionError.value = '所选动作不属于当前模型，请重新打开动作列表'
      return
    }
    stopMotion()
    const epoch = playbackGeneration
    await nextTick()
    if (disposed || epoch !== playbackGeneration || !catStore.model.behavior) return
    // Original presets expose no 0 and 1; other models receive the same two lightweight responses.
    motion.value = info.no % 2 === 1 ? 'stretch' : 'bounce'
    timer = setTimeout(stopMotion, asset.durationMs)
    if (!catStore.model.motionSound || !asset.soundUrl) return

    try {
      const playing = new Audio(asset.soundUrl)
      audio = playing
      const reportSoundError = (reason: unknown) => {
        if (!disposed && audio === playing && epoch === playbackGeneration) {
          actionError.value = `动作音效播放失败：${detail(reason)}`
        }
      }
      playing.onerror = () => reportSoundError(playing.error?.message || '无法读取或解码音效文件')
      void playing.play().catch(reportSoundError)
    } catch (reason) {
      actionError.value = `动作音效播放失败：${detail(reason)}`
    }
  }

  function setExpression(index: number) {
    if (disposed || !catStore.model.behavior) return
    actionError.value = null
    if (!loadedModel || loadedModel !== modelIdentity() || !Number.isInteger(index) || index < 0 || index >= expressionCount) {
      actionError.value = '所选表情不属于当前模型，请重新打开表情列表'
      return
    }
    expression.value = (['normal', 'happy', 'sleepy'] as const)[index % 3]
  }

  async function subscribe<T>(name: string, callback: (payload: T) => void) {
    try {
      const unlisten = await listen<T>(name, event => callback(event.payload))
      if (disposed) unlisten()
      else unlisteners.push(unlisten)
    } catch (reason) {
      if (!disposed) listenerError.value = `模型动作事件监听失败：${detail(reason)}`
    }
  }

  watch(() => [modelStore.currentModel?.id, modelStore.currentModel?.path], () => void reload(), { immediate: true })
  watch(() => catStore.model.behavior, (enabled) => {
    if (!enabled) clearBehavior()
  }, { flush: 'sync' })
  watch(() => catStore.model.motionSound, (enabled) => {
    if (!enabled) stopAudio()
  }, { flush: 'sync' })

  onMounted(() => {
    if (!native) return
    void subscribe<MotionInfo>(LISTEN_KEY.START_MOTION, info => void startMotion(info))
    void subscribe<number>(LISTEN_KEY.SET_EXPRESSION, setExpression)
  })

  onUnmounted(() => {
    disposed = true
    generation += 1
    clearBehavior()
    for (const unlisten of unlisteners) unlisten()
    unlisteners.length = 0
  })

  return {
    motion: readonly(motion),
    expression: readonly(expression),
    error,
    loading: readonly(loading),
    reload,
    startMotion,
    setExpression,
    clearError: () => {
      loadError.value = null
      listenerError.value = null
      actionError.value = null
    },
  }
}
