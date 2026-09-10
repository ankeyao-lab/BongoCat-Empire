<script setup lang="ts">
import { computed, useId } from 'vue'

import type { InteractionMode, WizardInputState } from '@/composables/useWizardInput'

import { resolveInteractionKey } from '@/composables/useWizardInput'
import { getInteractionPaw } from '@/data/interaction-paws'

import type { SceneV6 } from './scene-v6'
import type { SleeveArmConfig } from './sleeve-arm'

import PetEyes from './PetEyes.vue'
import { catPointerPalm, interactionPalm, sleeveArmGeometry } from './sleeve-arm'
import SleeveArm from './SleeveArm.vue'
import { themeSurface } from './theme-surfaces'
import ThemeDesk from './ThemeDesk.vue'
import ThemeDevices from './ThemeDevices.vue'

const props = withDefaults(defineProps<{
  scene: SceneV6
  themeId: string
  level: number
  mode: InteractionMode
  input: WizardInputState
  mirror?: boolean
  pointerMirror?: boolean
  blinkEyes?: boolean
  reducedMotion?: boolean
  expression?: 'normal' | 'happy' | 'sleepy'
}>(), { mirror: false, pointerMirror: false, blinkEyes: true, reducedMotion: false, expression: 'normal' })
const deviceOffset = 36
const id = `scene-v6-${useId().replace(/:/g, '')}`
const frame = computed(() => {
  const scale = props.scene.frameScale ?? 1
  return scale < 1 ? `translate(${306 * (1 - scale)} ${580 * (1 - scale)}) scale(${scale})` : undefined
})
const surface = computed(() => themeSurface(props.themeId))
// These seven source cutouts retain a detached piece of the old desk edge.
// Limit cleanup to the verified empty strip beside each sleeve; keep the PNG,
// clothing, props, eye layers and interaction geometry intact.
const deskEdgeCleanup: Record<string, [number, number, number, number]> = {
  'astronaut-4': [0, 325, 110, 55],
  'astronaut-6': [0, 335, 110, 50],
  'hero-5': [0, 318, 126, 47],
  'pirate-2': [0, 340, 101, 33],
  'pirate-4': [0, 335, 131, 30],
  'ninja-8': [0, 325, 124, 42],
  'emperor-4': [0, 328, 124, 37],
}
const bodyCleanup = computed(() => deskEdgeCleanup[`${props.themeId}-${props.level}`])
const overlays = computed(() => {
  const keys = props.mode === 'gamepad' ? props.input.pressedButtons : props.input.pressedKeys
  const bySource = new Map<string, NonNullable<ReturnType<typeof resolveInteractionKey>>>()
  for (const key of keys ?? []) {
    const overlay = resolveInteractionKey(props.mode, key)
    if (overlay) bySource.set(overlay.src, overlay)
  }
  return [...bySource.values()]
})
const latest = (side: 'left' | 'right') => overlays.value.filter(item => item.side === side).at(-1)
const pointerMode = computed(() => ['trackpad', 'standard'].includes(props.mode))
const pointer = computed(() => catPointerPalm(props.input.pointer, props.pointerMirror, deviceOffset))
const clicking = computed(() => props.input.rightTap || Boolean(props.input.mouseButtons?.length))
const leftStick = computed(() => props.mode === 'gamepad' && (Math.abs(props.input.sticks?.left.x ?? 0) > 0.02 || Math.abs(props.input.sticks?.left.y ?? 0) > 0.02 || props.input.pressedButtons?.includes('LeftThumb')))
const rightStick = computed(() => props.mode === 'gamepad' && (Math.abs(props.input.sticks?.right.x ?? 0) > 0.02 || Math.abs(props.input.sticks?.right.y ?? 0) > 0.02 || props.input.pressedButtons?.includes('RightThumb')))
const leftStickPalm = computed(() => ({ x: 439 + (props.input.sticks?.left.x ?? 0) * 16, y: 477 + deviceOffset - (props.input.sticks?.left.y ?? 0) * 10 - 22 }))
const rightStickPalm = computed(() => ({ x: 83 + (props.input.sticks?.right.x ?? 0) * 16, y: 411 + deviceOffset - (props.input.sticks?.right.y ?? 0) * 10 - 22 }))
const keyboardPalm = computed(() => {
  const key = latest('left')
  if (key) return interactionPalm(key.src, deviceOffset)!
  if (leftStick.value) return leftStickPalm.value
  return { x: props.scene.roots.keyboard.x - 5, y: 478 }
})
const otherPalm = computed(() => {
  if (pointerMode.value) return pointer.value
  const key = latest('right')
  if (key) return interactionPalm(key.src, deviceOffset)!
  if (rightStick.value) return rightStickPalm.value
  return { x: 148, y: 445 }
})
function config(side: 'pointer' | 'keyboard'): SleeveArmConfig {
  return {
    root: props.scene.roots[side],
    cuff: { width: 65, angle: side === 'pointer' ? 30 : -20, overlap: 7, color: surface.value.shell, trim: '#302b26', ...props.scene.cuffs?.[side] },
    palm: { width: 66, height: 44 },
    faceBox: { x: 238, y: 301, width: 145, height: 65 },
  }
}
const pointerConfig = computed(() => config('pointer'))
const keyboardConfig = computed(() => config('keyboard'))
// The extracted PNG also contains adjacent clothing. Only the fixed opening's
// short lip belongs above a moving arm; the rest remains in the body layer.
// Derive this from a constant target so the clip never follows a key or cursor.
const cuffClips = computed(() => [pointerConfig.value, keyboardConfig.value].map((arm) => {
  const geometry = sleeveArmGeometry(arm, { x: arm.root.x, y: arm.root.y + 60 })
  const [left, right] = geometry.rootEdges
  const radiusX = Math.hypot(right.x - left.x, right.y - left.y) / 2
  const overlap = arm.cuff.overlap ?? 8
  const radiusY = Math.max(16, Math.min(22, overlap * 2.25))
  const y = geometry.root.y - overlap - radiusY + 4
  // The cap ends at the short lip and extends back into the sleeve. Covering
  // its back also prevents a white loop above the trim in very short reaches.
  // Rounded ends cannot expose a rectangular crop corner on a long forearm.
  return `M ${geometry.root.x - radiusX} ${y} A ${radiusX} ${radiusY} 0 1 0 ${geometry.root.x + radiusX} ${y} A ${radiusX} ${radiusY} 0 1 0 ${geometry.root.x - radiusX} ${y} Z`
}))
const mouseTransform = computed(() => `translate(${pointer.value.x - 44} ${pointer.value.y - 28}) rotate(-8 44 28)`)
</script>

<template>
  <svg
    aria-hidden="true"
    class="pet-stage scene-v6"
    :class="{ 'reduced-motion': reducedMotion }"
    :data-scene="`${themeId}-${level}`"
    viewBox="0 0 612 580"
  >
    <defs>
      <mask
        v-if="bodyCleanup"
        :id="`${id}-body-cleanup`"
        height="580"
        maskUnits="userSpaceOnUse"
        width="612"
        x="0"
        y="0"
      >
        <rect fill="white" height="580" width="612" />
        <rect
          fill="black"
          :height="bodyCleanup[3]"
          :width="bodyCleanup[2]"
          :x="bodyCleanup[0]"
          :y="bodyCleanup[1]"
        />
      </mask>
      <clipPath :id="`${id}-pad`"><path d="M80 391 Q84 387 91 389 L258 421 Q266 423 263 429 L173 512 Q169 517 161 515 L12 461 Q5 459 11 453Z" /></clipPath>
      <clipPath
        :id="`${id}-cuffs`"
        clipPathUnits="userSpaceOnUse"
      >
        <path
          v-for="(path, index) in cuffClips"
          :key="index"
          :d="path"
        />
      </clipPath>
    </defs>
    <g :transform="frame">
      <g :transform="mirror ? 'translate(612 0) scale(-1 1)' : undefined">
        <ThemeDesk
          :level="level"
          :theme-id="themeId"
        />
        <g
          class="static-costume"
          :transform="scene.transform"
        >
          <ellipse
            v-for="(eye, index) in scene.eyesUnderlay ?? []"
            :key="index"
            :cx="eye.x"
            :cy="eye.y"
            :fill="eye.fill ?? '#fff'"
            :rx="eye.rx"
            :ry="eye.ry"
          />
          <image
            class="scene-v6-body"
            :height="scene.height"
            :href="scene.src"
            :mask="bodyCleanup ? `url(#${id}-body-cleanup)` : undefined"
            :width="scene.width"
          />
        </g>
        <g
          class="device-stage"
          :transform="`translate(0 ${deviceOffset})`"
        ><ThemeDevices
          :level="level"
          :mode="mode"
          :theme-id="themeId"
        /></g>
        <PetEyes :blink="blinkEyes" />
        <g
          v-if="mode === 'trackpad'"
          :clip-path="`url(#${id}-pad)`"
        >
          <ellipse
            v-if="clicking"
            class="touchpad-click-glow"
            :cx="pointer.x"
            :cy="pointer.y + 4"
            fill="#09efff"
            opacity=".8"
            rx="45"
            ry="23"
            :transform="`rotate(12 ${pointer.x} ${pointer.y})`"
          />
          <g
            v-if="input.scrolling"
            class="scroll-waves"
            :class="{ 'scroll-up': input.scrollDirection > 0 }"
            fill="none"
            stroke="#00e9ff"
            stroke-linecap="round"
            stroke-width="4"
          ><path d="M60 459 Q87 466 109 471 M66 452 Q91 459 115 464" /></g>
        </g>
        <g
          v-if="mode === 'standard'"
          class="original-mouse"
          :transform="mouseTransform"
        >
          <image
            height="81"
            href="/interaction/original/mouse.png"
            width="88"
          />
          <image
            v-if="input.mouseButtons?.includes('Left')"
            height="31"
            href="/interaction/original/mouse-left-glow.png"
            width="43"
            x="5"
            y="17"
          />
          <image
            v-if="input.mouseButtons?.includes('Right')"
            height="43"
            href="/interaction/original/mouse-right-glow.png"
            width="22"
            x="43"
            y="12"
          />
        </g>
        <g
          class="key-stage"
          :transform="`translate(0 ${deviceOffset})`"
        >
          <image
            v-for="overlay in overlays"
            :key="overlay.src"
            class="key-glow-overlay"
            :data-key="overlay.key"
            height="354"
            :href="getInteractionPaw(overlay.src)?.surfaceSrc ?? overlay.src.replace('-keys/', '-glows/')"
            width="612"
            x="0"
            y="176"
          />
        </g>
        <ellipse
          v-if="leftStick"
          :cx="leftStickPalm.x"
          :cy="leftStickPalm.y + 22"
          fill="#08efff"
          opacity=".85"
          rx="35"
          ry="19"
        />
        <ellipse
          v-if="rightStick"
          :cx="rightStickPalm.x"
          :cy="rightStickPalm.y + 22"
          fill="#08efff"
          opacity=".85"
          rx="30"
          ry="15"
        />
        <SleeveArm
          class="pointer-sleeve"
          :config="pointerConfig"
          :palm="otherPalm"
          :press-offset="pointerMode && clicking ? (reducedMotion ? 3 : 6) : 0"
          :show-cuff="!scene.cuffFront"
        />
        <SleeveArm
          class="keyboard-sleeve"
          :config="keyboardConfig"
          :palm="keyboardPalm"
          :show-cuff="!scene.cuffFront"
        />
        <g
          v-if="scene.cuffFront"
          class="costume-cuff-lips"
          :clip-path="`url(#${id}-cuffs)`"
        >
          <image
            class="costume-cuff-front"
            :height="scene.height"
            :href="scene.cuffFront"
            :transform="scene.transform"
            :width="scene.width"
          />
        </g>
        <path
          v-if="expression === 'happy'"
          d="M534 281 C524 271 519 285 534 295 C549 285 544 271 534 281Z"
          fill="#ed94af"
          stroke="#c26689"
          stroke-width="1.2"
        />
        <g
          v-if="expression === 'sleepy'"
          fill="#6c84a2"
          font-family="sans-serif"
          font-weight="700"
          transform="translate(530 278)"
        ><text font-size="16">Z</text><text
          font-size="11"
          x="13"
          y="-11"
        >z</text></g>
      </g>
    </g>
  </svg>
</template>

<style scoped>
.pet-stage {
  display: block;
  width: 100%;
  height: 100%;
  overflow: hidden;
}
.scroll-waves {
  animation: scroll-wave 350ms ease-out infinite;
}
.scroll-up {
  animation-direction: reverse;
}
@keyframes scroll-wave {
  from {
    transform: translateY(-3px);
    opacity: 0.3;
  }
  50% {
    opacity: 1;
  }
  to {
    transform: translateY(3px);
    opacity: 0.3;
  }
}
.reduced-motion .scroll-waves {
  animation: none;
}
@media (prefers-reduced-motion: reduce) {
  .scroll-waves {
    animation: none;
  }
}
</style>
