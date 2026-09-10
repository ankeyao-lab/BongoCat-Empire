import type { MaybeRefOrGetter } from 'vue'

import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { onMounted, onUnmounted, reactive, ref, toValue, watch } from 'vue'

import type { InteractionMode } from '@/components/wizard-pet/interaction-assets'

import { interactionKeys } from '@/components/wizard-pet/interaction-assets'
import { INVOKE_KEY, LISTEN_KEY } from '@/constants'

export type { InteractionMode } from '@/components/wizard-pet/interaction-assets'
export interface WizardPoint { x: number, y: number }
export interface DeviceListenerState {
  phase: string
  running: boolean
  listening: boolean
  permissionGranted: boolean | null
  tapEnabled: boolean
  generation: number
  recoveryCount: number
  droppedEvents: number
  keyboardEvents: number
  pointerEvents: number
  scrollEvents: number
  buttonEvents: number
  lastEventAt: number | null
  lastKeyboardEventAt: number | null
  lastPointerEventAt: number | null
  lastScrollEventAt: number | null
  checkedAt: number
  error: string | null
}
export type WizardDeviceEvent
  = | { kind: 'KeyboardPress' | 'KeyboardRelease', value: string }
    | { kind: 'MousePress' | 'MouseRelease', value: string }
    | { kind: 'MouseMove' | 'PointerScroll', value: WizardPoint }
export interface WizardGamepadEvent { kind: 'ButtonChanged' | 'AxisChanged', name: string, value: number }
export interface WizardInputState {
  leftTap: boolean
  rightTap: boolean
  rightMode: 'keyboard' | 'trackpad'
  pointer: WizardPoint
  scrolling: boolean
  scrollDirection: number
  pressedKeys: string[]
  pressedButtons: string[]
  mouseButtons: string[]
  sticks: { left: WizardPoint, right: WizardPoint }
}
export interface InteractionKey { key: string, side: 'left' | 'right', src: string }

/** Browser preview aliases are normalized to the rdev names used by the original PNGs. */
export function normalizeDeviceKey(key: string): string {
  if (/^Digit\d$/.test(key)) return key.replace('Digit', 'Num')
  const aliases: Record<string, string> = {
    Function: 'Fn',
    Enter: 'Return',
    ArrowUp: 'UpArrow',
    ArrowDown: 'DownArrow',
    ArrowLeft: 'LeftArrow',
    ArrowRight: 'RightArrow',
    Backquote: 'BackQuote',
    AltLeft: 'Alt',
    AltRight: 'AltGr',
  }
  return aliases[key] ?? key
}

/** Keep upstream exact-key-first and modifier / Fn fallback behavior. */
export function resolveInteractionKey(mode: InteractionMode, raw: string): InteractionKey | undefined {
  const base = mode === 'trackpad' ? 'standard' : mode
  const supported = interactionKeys[base]
  const key = normalizeDeviceKey(raw)
  const candidates = [key]
  if (/^F\d+$/.test(key)) candidates.push('Fn')
  for (const prefix of ['Meta', 'Shift', 'Alt', 'Control']) {
    if (key.startsWith(prefix)) candidates.push(prefix)
  }
  for (const candidate of candidates) {
    for (const side of ['left', 'right'] as const) {
      if ((supported[side] as readonly string[]).includes(candidate)) {
        return { key: candidate, side, src: `/interaction/${base}/${side}-keys/${candidate}.png` }
      }
    }
  }
}

export function keyboardPaw(key: string, mode: InteractionMode = 'trackpad'): 'left' | 'right' {
  return resolveInteractionKey(mode, key)?.side ?? 'left'
}
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max))
// macOS reports pointer activity, not a physical touch ending on the trackpad.
const POINTER_IDLE_MS = 600

/** Animates input only. Experience is counted independently by Rust, never here. */
export function useWizardInput(options: {
  demo?: boolean
  mode?: MaybeRefOrGetter<InteractionMode>
  listenGamepad?: boolean
  maxFPS?: MaybeRefOrGetter<number>
  ignorePointer?: MaybeRefOrGetter<boolean>
  onCursorMove?: (point: WizardPoint) => void
} = {}) {
  const input = reactive<WizardInputState>({
    leftTap: false,
    rightTap: false,
    rightMode: 'keyboard',
    pointer: { x: 0, y: 0 },
    scrolling: false,
    scrollDirection: 1,
    pressedKeys: [],
    pressedButtons: [],
    mouseButtons: [],
    sticks: { left: { x: 0, y: 0 }, right: { x: 0, y: 0 } },
  })
  const error = ref<string | null>(null)
  const listenerState = ref<DeviceListenerState | null>(null)
  let subscriptionFailed = false
  const heldKeys = new Set<string>()
  const timers = new Map<string, ReturnType<typeof setTimeout>>()
  let cursor: WizardPoint | undefined
  let stopped = false
  const unlisteners: Array<() => void> = []
  const currentMode = () => toValue(options.mode) ?? 'trackpad'
  let pointerTarget: WizardPoint = { x: 0, y: 0 }
  let lastPointerFrame = 0

  function later(name: string, delay: number, action: () => void) {
    clearTimeout(timers.get(name))
    timers.set(name, setTimeout(() => {
      timers.delete(name)
      action()
    }, delay))
  }
  function tap(paw: 'left' | 'right') {
    const key = paw === 'left' ? 'leftTap' : 'rightTap'
    input[key] = true
    later(key, 100, () => input[key] = false)
  }
  function trackpad() {
    input.rightMode = 'trackpad'
    later('pointerIdle', POINTER_IDLE_MS, () => {
      if (!input.mouseButtons.length && !input.scrolling) input.rightMode = 'keyboard'
    })
  }
  function releaseKey(key: string) {
    heldKeys.delete(key)
    input.pressedKeys = [...heldKeys]
  }
  function resetDeviceInput() {
    heldKeys.clear()
    input.pressedKeys = []
    input.mouseButtons = []
    input.leftTap = false
    input.rightTap = false
    input.scrolling = false
    input.rightMode = 'keyboard'
    cursor = undefined
    pointerTarget = { ...input.pointer }
    timers.forEach(clearTimeout)
    timers.clear()
  }
  function updateListenerState(state: DeviceListenerState) {
    const current = listenerState.value
    if (current && (state.generation < current.generation || (state.generation === current.generation && state.checkedAt < current.checkedAt))) return
    listenerState.value = state
    if (!subscriptionFailed) error.value = state.error
    if (!state.listening) resetDeviceInput()
  }
  function flushPointer() {
    clearTimeout(timers.get('pointerVisual'))
    timers.delete('pointerVisual')
    input.pointer = { ...pointerTarget }
    lastPointerFrame = performance.now()
  }
  function refreshPointer() {
    const fps = Number(toValue(options.maxFPS) ?? 0)
    const remaining = fps > 0 ? 1000 / fps - (performance.now() - lastPointerFrame) : 0
    if (remaining <= 0) return flushPointer()
    // Keep accumulating physical deltas; only rendering is rate limited.
    if (!timers.has('pointerVisual')) later('pointerVisual', remaining, flushPointer)
  }
  function handleEvent(event: WizardDeviceEvent) {
    if (event.kind === 'KeyboardRelease') return releaseKey(normalizeDeviceKey(event.value))
    if (event.kind === 'KeyboardPress') {
      const key = normalizeDeviceKey(event.value)
      if (heldKeys.has(key)) return
      heldKeys.add(key)
      input.pressedKeys = [...heldKeys]
      if (key === 'CapsLock') later('capsRelease', 150, () => releaseKey(key))
      if (currentMode() === 'gamepad') return
      const mapping = resolveInteractionKey(currentMode(), key)
      if (mapping) tap(mapping.side)
      return
    }
    if (event.kind === 'MouseMove') {
      options.onCursorMove?.(event.value)
      const previous = cursor
      cursor = event.value
      if (toValue(options.ignorePointer) || !['standard', 'trackpad'].includes(currentMode())) return
      if (previous) {
        pointerTarget.x = clamp(pointerTarget.x + (event.value.x - previous.x) / 500, -1, 1)
        pointerTarget.y = clamp(pointerTarget.y + (event.value.y - previous.y) / 350, -1, 1)
      }
      refreshPointer()
      trackpad()
      return
    }
    if (event.kind === 'MouseRelease') {
      const wasHeld = input.mouseButtons.includes(event.value)
      input.mouseButtons = input.mouseButtons.filter(button => button !== event.value)
      // A stationary drag is still contact. Start the quiet period after release.
      if (wasHeld && !input.mouseButtons.length) trackpad()
      return
    }
    if (toValue(options.ignorePointer) || !['standard', 'trackpad'].includes(currentMode())) return
    if (event.kind === 'MousePress') {
      flushPointer()
      if (!input.mouseButtons.includes(event.value)) input.mouseButtons.push(event.value)
      trackpad()
      tap('right')
      return
    }
    if (event.kind === 'PointerScroll' && (event.value.x || event.value.y)) {
      trackpad()
      input.scrolling = true
      input.scrollDirection = Math.sign(event.value.y || event.value.x)
      later('scroll', 260, () => input.scrolling = false)
    }
  }
  function handleGamepadEvent(event: WizardGamepadEvent) {
    if (currentMode() !== 'gamepad') return
    const axis = /^(Left|Right)Stick([XY])$/.exec(event.name)
    if (axis) {
      const side = axis[1] === 'Left' ? 'left' : 'right'
      const coordinate = axis[2] === 'X' ? 'x' : 'y'
      input.sticks[side][coordinate] = clamp(event.value, -1, 1)
      return
    }
    if (event.value > 0) {
      if (!input.pressedButtons.includes(event.name)) {
        input.pressedButtons.push(event.name)
        tap(resolveInteractionKey('gamepad', event.name)?.side ?? (event.name.startsWith('Left') ? 'left' : 'right'))
      }
    } else {
      input.pressedButtons = input.pressedButtons.filter(name => name !== event.name)
    }
  }
  watch(() => toValue(options.ignorePointer), (ignore) => {
    if (!ignore) return
    input.rightMode = 'keyboard'
    input.scrolling = false
    input.mouseButtons = []
    for (const name of ['pointerVisual', 'pointerIdle', 'scroll']) {
      clearTimeout(timers.get(name))
      timers.delete(name)
    }
    cursor = undefined
    pointerTarget = { ...input.pointer }
  })
  watch(currentMode, () => {
    resetDeviceInput()
    input.pressedButtons = []
    input.sticks = { left: { x: 0, y: 0 }, right: { x: 0, y: 0 } }
  })
  onMounted(async () => {
    if (options.demo) return
    try {
      const stopStatus = await listen<DeviceListenerState>('device-listener-state', ({ payload }) => updateListenerState(payload))
      if (stopped) return stopStatus()
      unlisteners.push(stopStatus)
      const stopReset = await listen('device-input-reset', resetDeviceInput)
      if (stopped) return stopReset()
      unlisteners.push(stopReset)
      const stopDevice = await listen<WizardDeviceEvent>(LISTEN_KEY.DEVICE_CHANGED, ({ payload }) => handleEvent(payload))
      if (stopped) return stopDevice()
      unlisteners.push(stopDevice)
      if (options.listenGamepad !== false) {
        const stopGamepad = await listen<WizardGamepadEvent>(LISTEN_KEY.GAMEPAD_CHANGED, ({ payload }) => handleGamepadEvent(payload))
        if (stopped) return stopGamepad()
        unlisteners.push(stopGamepad)
      }
      void invoke<DeviceListenerState>(INVOKE_KEY.START_DEVICE_LISTENING).then((state) => {
        if (!stopped) updateListenerState(state)
      }).catch((cause) => {
        if (!stopped) error.value = String(cause)
      })
    } catch (cause) {
      if (!stopped) {
        subscriptionFailed = true
        error.value = String(cause)
      }
    }
  })
  onUnmounted(() => {
    stopped = true
    unlisteners.forEach(unlisten => unlisten())
    timers.forEach(clearTimeout)
    heldKeys.clear()
  })
  return { input, handleEvent, handleGamepadEvent, error, listenerState }
}
