<script setup lang="ts">
import { computed, useId } from 'vue'

import type { InteractionMode, WizardInputState } from '@/composables/useWizardInput'
import type { GrowthThemeId } from '@/data/wizard-theme'

import { resolveInteractionKey } from '@/composables/useWizardInput'
import { hasDeviceSkin } from '@/data/device-skins'
import { getInteractionPaw } from '@/data/interaction-paws'
import { getLocalizedGrowthThemeRegistry } from '@/data/wizard-theme-localized'
import { useEmpireLocale } from '@/locales/empire'

import { getCompositeBody } from './composite-body'
import DeskSurface from './DeskSurface.vue'
import DeviceSkin from './DeviceSkin.vue'
import KeyPaw from './KeyPaw.vue'
import PetEyes from './PetEyes.vue'
import PlayfulDeviceDecor from './PlayfulDeviceDecor.vue'
import PlayfulWardrobe from './PlayfulWardrobe.vue'
import { getPngOutfit } from './png-wardrobe'
import { DEVICE_OFFSET_Y, pointerArmPath, pointerBodyClip } from './pointer-arm'
import { getSceneV6 } from './scene-v6'
import ScenePetV6 from './ScenePetV6.vue'
import { catPointerPalm } from './sleeve-arm'

const props = withDefaults(defineProps<{
  level: number
  growthLevel?: number
  growthThemeId?: string
  name?: string
  mode?: InteractionMode
  outfitThemeId?: string
  decorationsEnabled?: boolean
  input: WizardInputState
  progress?: number
  showProgress?: boolean
  paused?: boolean
  reducedMotion?: boolean
  blinkEyes?: boolean
  mirror?: boolean
  pointerMirror?: boolean
  idlePointerRaised?: boolean
  announcement?: string
  motion?: 'idle' | 'bounce' | 'stretch'
  expression?: 'normal' | 'happy' | 'sleepy'
}>(), {
  name: '',
  mode: 'trackpad',
  outfitThemeId: 'wizard',
  decorationsEnabled: true,
  progress: 0,
  showProgress: true,
  paused: false,
  reducedMotion: false,
  blinkEyes: true,
  mirror: false,
  pointerMirror: false,
  idlePointerRaised: true,
  announcement: '',
  motion: 'idle',
  expression: 'normal',
})

const { tr, locale } = useEmpireLocale()
const localizedThemes = computed(() => getLocalizedGrowthThemeRegistry(locale.value))
const displayName = computed(() => props.name || localizedThemes.value[(props.outfitThemeId ?? 'wizard') as GrowthThemeId]?.levels[props.level - 1]?.name || 'BongoCat Empire')
const modeName = computed(() => ({ standard: tr('键盘＋鼠标', 'Keyboard + mouse'), keyboard: tr('双手键盘', 'Two-hand keyboard'), trackpad: tr('键盘＋触摸板', 'Keyboard + trackpad'), gamepad: tr('手柄', 'Gamepad') })[props.mode])
const baseMode = computed(() => props.mode === 'trackpad' ? 'standard' : props.mode)
const plaqueTheme = computed(() => props.growthThemeId ?? props.outfitThemeId)
const plaqueProgress = computed(() => (props.growthLevel ?? props.level) >= 9 ? 1 : Math.min(1, Math.max(0, Number.isFinite(props.progress) ? props.progress : 0)))
const plaqueCircumference = 20 * Math.PI
const plaqueLabel = computed(() => `${localizedThemes.value[plaqueTheme.value as GrowthThemeId]?.name ?? tr('成长', 'Growth')} · Lv.${props.growthLevel ?? props.level} · ${tr('当前级进度', 'Level progress')} ${Math.round(plaqueProgress.value * 100)}%${props.paused ? tr(' · 成长暂停', ' · Growth paused') : ''}`)
const dressed = computed(() => props.decorationsEnabled && props.outfitThemeId !== 'none')
const v6Scene = computed(() => dressed.value ? getSceneV6(props.outfitThemeId, props.level) : undefined)
const compositeBody = computed(() => dressed.value ? getCompositeBody(props.outfitThemeId, props.level) : undefined)
const sceneFrame = computed(() => {
  const scale = compositeBody.value?.frameScale ?? 1
  return scale < 1 ? `translate(${306 * (1 - scale)} ${580 * (1 - scale)}) scale(${scale})` : undefined
})
const sceneProp = computed(() => compositeBody.value ? getPngOutfit(props.outfitThemeId, props.level)?.prop : undefined)
const deviceOffset = computed(() => compositeBody.value ? DEVICE_OFFSET_Y : 0)
const deviceSkinned = computed(() => dressed.value && hasDeviceSkin(props.outfitThemeId, props.mode))
const activeOverlays = computed(() => {
  const rawKeys = props.mode === 'gamepad' ? props.input.pressedButtons : props.input.pressedKeys
  const result = new Map<string, NonNullable<ReturnType<typeof resolveInteractionKey>>>()
  for (const raw of rawKeys ?? []) {
    const key = resolveInteractionKey(props.mode, raw)
    if (key) result.set(key.src, key)
  }
  return [...result.values()]
})
// Upstream key PNGs include the pressed paw. Keep only the latest paw on each
// side, while the other held keys retain their original cyan pixels.
const pawOverlays = computed(() => {
  const bySide = new Map<string, (typeof activeOverlays.value)[number]>()
  for (const overlay of activeOverlays.value) bySide.set(overlay.side, overlay)
  return [...bySide.values()]
})
const splitPaws = computed(() => pawOverlays.value.map(overlay => ({ overlay, parts: getInteractionPaw(overlay.src) })))
const activeLeft = computed(() => activeOverlays.value.some(item => item.side === 'left'))
const activeRight = computed(() => activeOverlays.value.some(item => item.side === 'right'))
// Reduced motion affects the click dip and transitions, never pointer reach.
const pointer = computed(() => catPointerPalm(props.input.pointer, props.pointerMirror, deviceOffset.value))
const pointerPressed = computed(() => props.input.rightTap || (props.input.mouseButtons?.length ?? 0) > 0)
const pressOffset = computed(() => pointerPressed.value ? (props.reducedMotion ? 3 : 6) : 0)
const pointerPaw = computed(() => pointerArmPath(pointer.value, pressOffset.value))
const pointerBody = computed(() => pointerBodyClip(pointer.value, pressOffset.value))
const pointerBodyClipId = `pointer-cat-body-${useId().replace(/:/g, '')}`
const mouseTransform = computed(() => `translate(${pointer.value.x - 44} ${pointer.value.y - 28}) rotate(-8 44 28)`)
const pointerPawVisible = computed(() => (props.mode === 'standard' || props.mode === 'trackpad')
  && (!props.idlePointerRaised || props.input.rightMode === 'trackpad' || pointerPressed.value || props.input.scrolling))
const leftStickActive = computed(() => props.mode === 'gamepad' && (Math.abs(props.input.sticks?.left.x ?? 0) > 0.02 || Math.abs(props.input.sticks?.left.y ?? 0) > 0.02 || props.input.pressedButtons?.includes('LeftThumb')))
const rightStickActive = computed(() => props.mode === 'gamepad' && (Math.abs(props.input.sticks?.right.x ?? 0) > 0.02 || Math.abs(props.input.sticks?.right.y ?? 0) > 0.02 || props.input.pressedButtons?.includes('RightThumb')))
</script>

<template>
  <div
    :aria-label="`BongoCat Empire · ${outfitThemeId === 'none' ? tr('原始外观', 'Original appearance') : displayName} · ${modeName}`"
    class="wizard-pet"
    :class="{ 'reduced-motion': reducedMotion }"
    role="img"
  >
    <ScenePetV6
      v-if="v6Scene"
      :blink-eyes="blinkEyes"
      :expression="expression"
      :idle-pointer-raised="idlePointerRaised"
      :input="input"
      :level="level"
      :mirror="mirror"
      :mode="mode"
      :pointer-mirror="pointerMirror"
      :reduced-motion="reducedMotion"
      :scene="v6Scene"
      :theme-id="outfitThemeId"
    />
    <svg
      v-else
      aria-hidden="true"
      class="pet-stage"
      viewBox="0 0 612 580"
    >
      <defs>
        <clipPath id="interaction-table"><path d="M 0 326 L 612 439 L 612 530 L 0 530 Z" /></clipPath>
        <clipPath :id="`${pointerBodyClipId}-stage`"><path :d="`M -256 -256 H 868 V ${443 + deviceOffset + 116 * 256 / 612} L -256 ${327 + deviceOffset - 116 * 256 / 612} Z`" /></clipPath>
        <clipPath :id="pointerBodyClipId"><path :d="pointerBody" /></clipPath>
        <clipPath :id="`${pointerBodyClipId}-left-cuff`"><path d="M0 0 H612 V580 H250 V368 Q213 354 175 333 Q138 311 0 254 Z" /></clipPath>
        <clipPath :id="`${pointerBodyClipId}-touchpad`"><path d="M80 355 Q84 351 91 353 L258 385 Q266 387 263 393 L173 476 Q169 481 161 479 L12 425 Q5 423 11 417 Z" /></clipPath>
        <mask
          v-if="compositeBody"
          :id="`${pointerBodyClipId}-face`"
          height="580"
          maskUnits="userSpaceOnUse"
          width="612"
          x="0"
          y="0"
        >
          <image
            :height="compositeBody.height"
            :href="compositeBody.faceMask"
            :transform="compositeBody.transform"
            :width="compositeBody.width"
          />
        </mask>
        <linearGradient
          id="touch-surface"
          x1="0"
          x2="1"
          y1="0"
          y2="1"
        ><stop
          offset="0"
          stop-color="#b9bdc2"
        /><stop
          offset="1"
          stop-color="#92999f"
        /></linearGradient>
      </defs>
      <g :transform="sceneFrame">
        <rect
          fill="white"
          :height="51 - deviceOffset"
          width="612"
          x="0"
          :y="529 + deviceOffset"
        />
        <g :transform="mirror ? 'translate(612 0) scale(-1 1)' : undefined">
          <g
            class="cat-presentation"
            :class="compositeBody ? undefined : motion"
            :clip-path="`url(#${pointerBodyClipId}-stage)`"
            :style="{ '--bounce-height': reducedMotion ? '2px' : '7px', '--stretch-x': reducedMotion ? '1.008' : '1.025', '--stretch-y': reducedMotion ? '1.016' : '1.05' }"
          >
            <PlayfulWardrobe
              v-if="dressed && !compositeBody"
              layer="back"
              :level="level"
              :theme-id="outfitThemeId"
            />
            <image
              v-if="sceneProp"
              class="scene-prop"
              :height="sceneProp.rect[3]"
              :href="sceneProp.src"
              :preserveAspectRatio="sceneProp.fit"
              :transform="sceneProp.rotation ? `rotate(${sceneProp.rotation.join(' ')})` : undefined"
              :width="sceneProp.rect[2]"
              :x="sceneProp.rect[0]"
              :y="sceneProp.rect[1]"
            />
            <g
              class="original-cat"
              :clip-path="pointerPawVisible ? `url(#${pointerBodyClipId})` : undefined"
            >
              <image
                v-if="compositeBody"
                class="composite-body"
                :height="compositeBody.height"
                :href="compositeBody.src"
                :transform="compositeBody.transform"
                :width="compositeBody.width"
              />
              <template v-else>
                <path
                  d="M 174 309 Q 132 336 134 369 L 534 442 L 528 394 L 181 292 Z"
                  fill="white"
                />
                <image
                  height="228"
                  href="/interaction/original/face.png"
                  width="369"
                  x="166"
                  y="194"
                />
              </template>
              <PetEyes :blink="blinkEyes" />
            </g>
            <PlayfulWardrobe
              v-if="dressed && !compositeBody"
              layer="front"
              :level="level"
              :theme-id="outfitThemeId"
            />
            <!-- Upstream atlas paws are used at rest; per-key PNGs supply pressed paws. -->
            <image
              v-if="!activeLeft && !leftStickActive"
              class="rest-paw left-paw"
              height="110"
              href="/interaction/original/paw-up.png"
              :mask="compositeBody ? `url(#${pointerBodyClipId}-face)` : undefined"
              width="101"
              x="388"
              :y="compositeBody ? compositeBody.restPawY ?? 282 : 306"
            />
            <image
              v-if="!pointerPawVisible && !activeRight && !rightStickActive"
              class="rest-paw right-paw"
              :clip-path="compositeBody ? `url(#${pointerBodyClipId}-left-cuff)` : undefined"
              height="109"
              href="/interaction/original/paw-up.png"
              width="99"
              :x="compositeBody ? 143 : 127"
              :y="compositeBody ? 250 : 278"
            />
            <g
              v-if="expression === 'happy'"
              class="expression-feedback"
              transform="translate(534 275)"
            >
              <path
                d="M 0 6 C -10 -4 -15 10 0 20 C 15 10 10 -4 0 6 Z"
                fill="#ed94af"
                stroke="#c26689"
                stroke-width="1.2"
              />
            </g>
            <g
              v-if="expression === 'sleepy'"
              class="expression-feedback"
              fill="#6c84a2"
              font-family="-apple-system, sans-serif"
              font-weight="700"
              transform="translate(530 278)"
            >
              <text font-size="16">Z</text><text
                font-size="11"
                x="13"
                y="-11"
              >z</text>
            </g>
          </g>
          <g
            class="device-stage"
            :transform="`translate(0 ${deviceOffset})`"
          >
            <!-- Original geometry and key labels remain below the static material skin. -->
            <image
              class="interaction-background"
              clip-path="url(#interaction-table)"
              height="354"
              :href="`/interaction/${baseMode}/background.png`"
              width="612"
              x="0"
              y="176"
            />
            <DeskSurface
              v-if="dressed"
              :devices-skinned="deviceSkinned"
              :level="level"
              :mode="mode"
              :theme-id="outfitThemeId"
            />
            <DeviceSkin
              v-if="deviceSkinned"
              :level="level"
              :mode="mode"
              :theme-id="outfitThemeId"
            />
            <g
              v-if="mode === 'trackpad'"
              class="touchpad"
            >
              <path
                v-if="!deviceSkinned"
                d="M 80 355 Q 84 351 91 353 L 258 385 Q 266 387 263 393 L 173 476 Q 169 481 161 479 L 12 425 Q 5 423 11 417 Z"
                fill="url(#touch-surface)"
                stroke="#7e878e"
                stroke-width="1.4"
              />
              <path
                v-if="!deviceSkinned"
                d="M 91 363 L 248 393 L 168 469 L 23 422 Z"
                fill="none"
                opacity="0.8"
                stroke="#d4d8dc"
                stroke-width="1"
              />
              <g
                v-if="pointerPressed"
                :clip-path="`url(#${pointerBodyClipId}-touchpad)`"
              >
                <ellipse
                  class="touchpad-click-glow"
                  :cx="pointer.x"
                  :cy="pointer.y - deviceOffset + 4"
                  fill="#09efff"
                  opacity="0.8"
                  rx="53"
                  ry="24"
                  :transform="`rotate(12 ${pointer.x} ${pointer.y - deviceOffset})`"
                />
              </g>
              <g
                v-if="input.scrolling"
                class="scroll-waves"
                :class="{ 'scroll-up': input.scrollDirection > 0 }"
                fill="none"
                stroke="#00e9ff"
                stroke-linecap="round"
                stroke-width="4"
              >
                <path d="M 60 423 Q 87 430 109 435 M 66 416 Q 91 423 115 428" />
              </g>
            </g>
            <PlayfulDeviceDecor
              v-if="dressed && !deviceSkinned"
              :input="input"
              :level="level"
              :mode="mode"
              :theme-id="outfitThemeId"
            />
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
              x="0"
              y="0"
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
            v-if="pointerPawVisible"
            class="pointer-paw"
            fill="white"
            stroke="#111"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="5.3"
          >
            <path :d="pointerPaw" />
          </g>
          <g
            class="key-stage"
            :transform="`translate(0 ${deviceOffset})`"
          >
            <g
              v-if="mode === 'gamepad'"
              class="gamepad-sticks"
            >
              <g
                v-if="leftStickActive"
                :transform="`translate(${439 + (input.sticks?.left.x ?? 0) * 16} ${477 - (input.sticks?.left.y ?? 0) * 10})`"
              >
                <ellipse
                  fill="#08efff"
                  opacity="0.85"
                  rx="35"
                  ry="19"
                /><path
                  v-if="!activeLeft"
                  d="M -38 -106 Q -58 -51 -32 -17 Q -7 0 24 -18 Q 33 -38 26 -77"
                  fill="white"
                  stroke="#111"
                  stroke-width="5"
                />
              </g>
              <g
                v-if="rightStickActive"
                :transform="`translate(${83 + (input.sticks?.right.x ?? 0) * 16} ${411 - (input.sticks?.right.y ?? 0) * 10})`"
              >
                <ellipse
                  fill="#08efff"
                  opacity="0.85"
                  rx="30"
                  ry="15"
                /><path
                  v-if="!activeRight"
                  d="M 55 -77 Q 21 -54 -9 -24 Q -18 -1 10 5 Q 31 6 46 -11 L 82 -41"
                  fill="white"
                  stroke="#111"
                  stroke-width="5"
                />
              </g>
            </g>
            <image
              v-for="overlay in activeOverlays"
              :key="`glow-${overlay.src}`"
              class="key-glow-overlay"
              :data-key="overlay.key"
              :height="354"
              :href="getInteractionPaw(overlay.src)?.surfaceSrc ?? overlay.src.replace('-keys/', '-glows/')"
              :width="612"
              x="0"
              y="176"
            />

          </g>
          <template
            v-for="{ overlay, parts } in splitPaws"
            :key="overlay.src"
          >
            <KeyPaw
              v-if="parts"
              :anchor-y="parts.anchorY"
              class="key-overlay"
              :contact-y="parts.contactY"
              :data-key="overlay.key"
              :data-paw="overlay.side"
              :device-offset-y="deviceOffset"
              :src="parts.pawSrc"
            />
            <image
              v-else
              class="key-overlay"
              :data-key="overlay.key"
              :data-paw="overlay.side"
              height="354"
              :href="overlay.src"
              width="612"
              x="0"
              y="176"
            />
          </template>
          <!-- Legacy desk props retain their offset; the 22px progress ring is outside this SVG. -->
          <g :transform="`translate(28 ${deviceOffset})`">
            <PlayfulWardrobe
              v-if="dressed"
              layer="desk"
              :level="level"
              :theme-id="outfitThemeId"
            />
          </g>
        </g>
      </g>
    </svg>
    <div
      v-if="showProgress"
      :aria-label="plaqueLabel"
      class="desktop-level"
      data-testid="desktop-level"
      :style="{ left: mirror ? 'auto' : '8px', right: mirror ? '8px' : 'auto' }"
      :title="plaqueLabel"
    >
      <svg
        aria-hidden="true"
        class="level-progress"
        viewBox="0 0 22 22"
      >
        <circle
          class="level-progress-track"
          cx="11"
          cy="11"
          r="10"
        />
        <circle
          v-if="plaqueProgress > 0"
          class="level-progress-value"
          cx="11"
          cy="11"
          r="10"
          :stroke-dasharray="`${plaqueCircumference} ${plaqueCircumference}`"
          :stroke-dashoffset="plaqueCircumference * (1 - plaqueProgress)"
          transform="rotate(-90 11 11)"
        />
      </svg>
      <span>{{ growthLevel ?? level }}</span>
    </div>
    <div
      v-if="announcement"
      class="level-announcement"
      role="status"
    >
      {{ announcement }}
    </div>
  </div>
</template>

<style scoped>
.wizard-pet {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  user-select: none;
}
.pet-stage {
  display: block;
  width: 100%;
  height: 100%;
}
.pointer-paw path,
.original-mouse {
  transition:
    d 65ms ease-out,
    transform 65ms ease-out;
}
.reduced-motion .pointer-paw path,
.reduced-motion .original-mouse {
  transition: none;
}
.desktop-level {
  position: absolute;
  bottom: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: rgb(255 255 255 / 65%);
  color: #686d72;
  font:
    500 11px/1 -apple-system,
    BlinkMacSystemFont,
    sans-serif;
  text-align: center;
  pointer-events: none;
  overflow: hidden;
}
.level-progress {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  fill: none;
}
.level-progress-track {
  stroke: rgb(97 101 106 / 28%);
  stroke-width: 1;
}
.level-progress-value {
  stroke: rgb(104 118 109 / 80%);
  stroke-width: 1.25;
  stroke-linecap: round;
}
.cat-presentation {
  transform-box: fill-box;
  transform-origin: center bottom;
}
.cat-presentation.bounce {
  animation: companion-bounce 700ms ease-out;
}
.cat-presentation.stretch {
  animation: companion-stretch 800ms ease-in-out;
}
@keyframes companion-bounce {
  0%,
  100% {
    transform: translateY(0);
  }
  40% {
    transform: translateY(calc(-1 * var(--bounce-height)));
  }
  70% {
    transform: translateY(0);
  }
  85% {
    transform: translateY(calc(-0.45 * var(--bounce-height)));
  }
}
@keyframes companion-stretch {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(var(--stretch-x), var(--stretch-y));
  }
}
.level-announcement {
  position: absolute;
  top: 5%;
  left: 50%;
  transform: translateX(-50%);
  padding: 7px 12px;
  background: #fbf8f3ed;
  color: #625172;
  border: 1px solid #cfbfdc;
  border-radius: 12px;
  font:
    500 11px/1.4 -apple-system,
    BlinkMacSystemFont,
    sans-serif;
  white-space: nowrap;
  pointer-events: none;
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
