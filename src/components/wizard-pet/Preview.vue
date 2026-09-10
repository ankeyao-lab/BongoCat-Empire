<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

import type { InteractionMode } from '@/composables/useWizardInput'

import { useWizardInput } from '@/composables/useWizardInput'
import { growthThemeRegistry, wizardLevels } from '@/data/wizard-theme'

import { playfulThemes } from './playful-art'
import WizardPet from './WizardPet.vue'

const level = ref(1)
const mode = ref<InteractionMode>('trackpad')
const outfitThemeId = ref<string>('wizard')
const scale = ref(1)
const reducedMotion = ref(true)
const mirror = ref(false)
const showProgress = ref(true)
const decorationsEnabled = ref(true)
const dark = ref(false)
const motion = ref<'idle' | 'bounce' | 'stretch'>('idle')
const expression = ref<'normal' | 'happy' | 'sleepy'>('normal')
const pointerSurface = ref<HTMLElement>()
const { input, handleEvent, handleGamepadEvent } = useWizardInput({ demo: true, mode })
const currentLevels = computed(() => growthThemeRegistry[outfitThemeId.value as keyof typeof growthThemeRegistry]?.levels ?? wizardLevels)
const outfit = computed(() => currentLevels.value[level.value - 1])
const presses = ref(0)
const demoTimers = new Set<ReturnType<typeof setTimeout>>()
function delayed(action: () => void, ms = 250) {
  const timer = setTimeout(() => {
    demoTimers.delete(timer)
    action()
  }, ms)
  demoTimers.add(timer)
}
function demoMotion(value: 'bounce' | 'stretch') {
  motion.value = 'idle'
  requestAnimationFrame(() => motion.value = value)
  delayed(() => motion.value = 'idle', 1000)
}
function demoExpression(value: 'happy' | 'sleepy') {
  expression.value = value
  delayed(() => expression.value = 'normal', 1800)
}
function keyDown(event: KeyboardEvent) {
  if ((event.target as HTMLElement)?.matches('select,input,button')) return
  if (event.code.startsWith('Arrow') || event.code === 'Space') event.preventDefault()
  handleEvent({ kind: 'KeyboardPress', value: event.code })
  if (!event.repeat) presses.value += 1
}
function keyUp(event: KeyboardEvent) {
  handleEvent({ kind: 'KeyboardRelease', value: event.code })
}
function keyTap(code: string) {
  handleEvent({ kind: 'KeyboardPress', value: code })
  delayed(() => handleEvent({ kind: 'KeyboardRelease', value: code }))
  presses.value += 1
}
function gamepadTap(name: string) {
  handleGamepadEvent({ kind: 'ButtonChanged', name, value: 1 })
  delayed(() => handleGamepadEvent({ kind: 'ButtonChanged', name, value: 0 }))
}
function stickDemo() {
  handleGamepadEvent({ kind: 'AxisChanged', name: 'LeftStickX', value: 0.7 })
  handleGamepadEvent({ kind: 'AxisChanged', name: 'RightStickY', value: -0.6 })
  delayed(() => {
    handleGamepadEvent({ kind: 'AxisChanged', name: 'LeftStickX', value: 0 })
    handleGamepadEvent({ kind: 'AxisChanged', name: 'RightStickY', value: 0 })
  }, 600)
}
function movePointer(event: PointerEvent) {
  handleEvent({ kind: 'MouseMove', value: { x: event.clientX, y: event.clientY } })
}
function clickPointer() {
  handleEvent({ kind: 'MousePress', value: 'Left' })
  delayed(() => handleEvent({ kind: 'MouseRelease', value: 'Left' }), 180)
}
function scrollPointer(event: WheelEvent) {
  event.preventDefault()
  handleEvent({ kind: 'PointerScroll', value: { x: event.deltaX, y: event.deltaY } })
}
onMounted(() => {
  document.addEventListener('keydown', keyDown)
  document.addEventListener('keyup', keyUp)
  pointerSurface.value?.addEventListener('wheel', scrollPointer, { passive: false })
})
onUnmounted(() => {
  document.removeEventListener('keydown', keyDown)
  document.removeEventListener('keyup', keyUp)
  pointerSurface.value?.removeEventListener('wheel', scrollPointer)
  demoTimers.forEach(clearTimeout)
})
</script>

<template>
  <div
    class="preview-page"
    :class="{ dark }"
  >
    <header>
      <div class="eyebrow">
        BONGOCAT / INTERACTION + WARDROBE
      </div><h1>原版交互 · 独立衣橱</h1><p>浏览器演示，不计入真实成长。保留原版键盘、逐键蓝光与原始形象；装扮和交互方式分别选择。</p>
    </header>
    <div class="preview-layout">
      <section class="preview-canvas">
        <div
          class="pet-frame"
          :style="{ width: `${400 * scale}px`, height: `${400 * 580 / 612 * scale}px` }"
        >
          <WizardPet
            :decorations-enabled="decorationsEnabled"
            :expression="expression"
            :input="input"
            :level="level"
            :mirror="mirror"
            :mode="mode"
            :motion="motion"
            :name="outfit.name"
            :outfit-theme-id="outfitThemeId"
            :progress="0.42"
            :reduced-motion="reducedMotion"
            :show-progress="showProgress"
          />
        </div>
        <div class="canvas-caption">
          {{ outfitThemeId === 'none' ? '原始外观' : outfit.name }} · {{ mode }}<span>612 × 580 场景 · {{ Math.round(400 * scale) }} px 显示宽度</span>
        </div>
      </section>
      <aside class="controls">
        <label>交互方式<select
          v-model="mode"
          data-testid="mode-select"
        ><option value="standard">键盘 + 鼠标</option><option value="keyboard">键盘 + 方向键</option><option value="gamepad">手柄</option><option value="trackpad">键盘 + 触摸板</option></select></label>
        <label>衣橱<select
          v-model="outfitThemeId"
          data-testid="outfit-select"
        ><option value="none">原始外观</option><option
          v-for="theme in playfulThemes"
          :key="theme.id"
          :value="theme.id"
        >{{ theme.name }}</option></select></label>
        <label>成长阶段<select
          v-model.number="level"
          data-testid="level-select"
          :disabled="outfitThemeId === 'none'"
        ><option
          v-for="item in currentLevels"
          :key="item.level"
          :value="item.level"
        >Lv.{{ item.level }} · {{ item.name }}</option></select></label>
        <label>桌宠大小 <span>{{ Math.round(scale * 100) }}%</span><input
          v-model.number="scale"
          max="1.5"
          min="0.4"
          step="0.1"
          type="range"
        ></label>
        <div class="toggles">
          <label><input
            v-model="reducedMotion"
            type="checkbox"
          >低动效</label><label><input
            v-model="decorationsEnabled"
            data-testid="decorations-toggle"
            type="checkbox"
          >显示装扮</label><label><input
            v-model="mirror"
            type="checkbox"
          >镜像</label><label><input
            v-model="showProgress"
            type="checkbox"
          >桌面等级牌</label><label><input
            v-model="dark"
            type="checkbox"
          >深色背景</label>
        </div>
        <div class="input-test">
          <h2>{{ mode === 'gamepad' ? '手柄' : '键盘' }}</h2><p>每个键按原版位置亮蓝光，松开后消失。</p><div
            v-if="mode !== 'gamepad'"
            class="test-buttons"
          >
            <button @click="keyTap('KeyA')">
              A 键
            </button><button @click="keyTap('KeyJ')">
              J 键
            </button><button @click="keyTap('ArrowUp')">
              方向键 ↑
            </button>
          </div><div
            v-else
            class="test-buttons"
          >
            <button @click="gamepadTap('South')">
              A 按钮
            </button><button @click="gamepadTap('DPadLeft')">
              十字键
            </button><button @click="stickDemo">
              摇杆
            </button>
          </div><small>演示按键 {{ presses }} 次 · 低动效仍显示逐键反馈</small>
        </div>
        <div class="input-test">
          <h2>鼠标 / 触摸板</h2><p>在下方移动、轻点或双指滚动；仅指针交互模式响应。</p><div
            ref="pointerSurface"
            class="pointer-surface"
            @pointerdown="clickPointer"
            @pointermove="movePointer"
          >
            <span>滑动 · 轻点 · 滚动</span>
          </div><small>鼠标、触摸板和手柄均不增加成长次数</small>
        </div>
        <details class="input-test behavior-tests">
          <summary>动作与表情演示</summary>
          <div class="test-buttons">
            <button @click="demoMotion('bounce')">
              轻跳
            </button><button @click="demoMotion('stretch')">
              伸展
            </button><button @click="demoExpression('happy')">
              开心
            </button><button @click="demoExpression('sleepy')">
              困倦
            </button>
          </div>
        </details>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.preview-page {
  min-height: 100vh;
  padding: 48px max(32px, calc((100vw - 1160px) / 2));
  background: #f8f5ef;
  color: #433a4c;
  font:
    14px/1.55 -apple-system,
    BlinkMacSystemFont,
    'PingFang SC',
    sans-serif;
}
.eyebrow {
  color: #938496;
  letter-spacing: 2px;
  font-size: 10px;
  font-weight: 700;
}
h1 {
  font-size: 28px;
  letter-spacing: -0.5px;
  margin: 12px 0 6px;
}
header p {
  color: #887c88;
  margin: 0 0 32px;
}
.preview-layout {
  display: grid;
  grid-template-columns: minmax(400px, 1fr) 300px;
  gap: 30px;
  align-items: stretch;
}
.preview-canvas {
  min-height: 570px;
  padding: 22px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background-color: #e9e4e1;
  background-image:
    linear-gradient(45deg, #e3deda 25%, transparent 25%), linear-gradient(-45deg, #e3deda 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #e3deda 75%), linear-gradient(-45deg, transparent 75%, #e3deda 75%);
  background-size: 24px 24px;
  background-position:
    0 0,
    0 12px,
    12px -12px,
    -12px 0;
  border: 1px solid #ded6d1;
  border-radius: 24px;
  overflow: hidden;
}
.pet-frame {
  flex: none;
  transition:
    width 150ms,
    height 150ms;
}
.canvas-caption {
  margin-top: 22px;
  text-align: center;
  font-size: 13px;
  font-weight: 600;
  color: #796b7f;
}
.canvas-caption span {
  display: block;
  font-size: 10px;
  font-weight: 400;
  opacity: 0.7;
  margin-top: 6px;
}
.controls {
  background: #fffdf9;
  border: 1px solid #e4dadf;
  border-radius: 24px;
  padding: 24px;
}
.controls > label {
  display: block;
  font-weight: 500;
  margin-bottom: 20px;
}
.controls > label > span {
  float: right;
  color: #9a879e;
}
select {
  display: block;
  width: 100%;
  margin-top: 9px;
  background: #f9f4fa;
  color: #65506e;
  padding: 10px 12px;
  border: 1px solid #decfe5;
  border-radius: 9px;
  font: inherit;
}
input[type='range'] {
  width: 100%;
  display: block;
  margin-top: 12px;
  accent-color: #9170a2;
}
.toggles {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  font-size: 12px;
}
.toggles label {
  display: flex;
  align-items: center;
  gap: 5px;
}
input[type='checkbox'] {
  accent-color: #9576a5;
}
.input-test {
  border-top: 1px solid #eadfe9;
  padding-top: 16px;
  margin-top: 22px;
}
h2 {
  font-size: 13px;
  margin: 0;
}
.input-test p {
  font-size: 11px;
  color: #958396;
  margin: 6px 0 12px;
}
.test-buttons {
  display: flex;
  gap: 10px;
}
button {
  padding: 8px 14px;
  background: #f5edf7;
  color: #6f4f80;
  border: 1px solid #dccae5;
  border-radius: 8px;
  cursor: pointer;
  font: inherit;
  font-size: 12px;
}
button:active {
  background: #decee8;
}
small {
  display: block;
  font-size: 10px;
  color: #a18fa2;
  margin-top: 10px;
}
.pointer-surface {
  height: 84px;
  display: grid;
  place-items: center;
  background: linear-gradient(150deg, #f1ecf5, #e7dfee);
  border: 1px solid #d9cbe2;
  border-radius: 13px;
  touch-action: none;
  cursor: crosshair;
}
.pointer-surface span {
  color: #a696af;
  font-size: 10px;
  pointer-events: none;
}
.dark .preview-canvas {
  background-color: #342f3c;
  background-image: none;
  border-color: #493f52;
}
.dark .canvas-caption {
  color: #c4b6cd;
}
@media (max-width: 850px) {
  .preview-page {
    padding: 28px 18px;
  }
  .preview-layout {
    grid-template-columns: 1fr;
  }
  .preview-canvas {
    min-height: 400px;
    padding: 0;
  }
  h1 {
    font-size: 22px;
  }
  .controls {
    width: 100%;
  }
}
</style>
