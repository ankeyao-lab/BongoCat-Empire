<script setup lang="ts">
import { computed, useId } from 'vue'

import type { SleeveArmConfig } from './sleeve-arm'

const props = defineProps<{ config: SleeveArmConfig, side: 'pointer' | 'keyboard' }>()
const clipId = `original-raised-paw-${useId().replace(/:/g, '')}`
const wrist = computed(() => {
  const root = props.config.root
  const angle = (props.config.cuff.angle ?? 0) * Math.PI / 180
  const half = props.config.cuff.width / 2
  const left = { x: root.x - Math.cos(angle) * half, y: root.y - Math.sin(angle) * half }
  const right = { x: root.x + Math.cos(angle) * half, y: root.y + Math.sin(angle) * half }
  const floor = (x: number) => root.y + 25 + Math.tan(angle) * (x - root.x)
  return {
    bridge: `M ${left.x} ${left.y - 12} L ${left.x} ${left.y} Q ${root.x} ${root.y + 32} ${right.x} ${right.y} L ${right.x} ${right.y - 12} Z`,
    sides: `M ${left.x} ${left.y - 12} L ${left.x} ${left.y} Q ${root.x} ${root.y + 32} ${right.x} ${right.y} L ${right.x} ${right.y - 12}`,
    clip: `M -100 -100 H 712 V ${floor(712)} L -100 ${floor(-100)} Z`,
  }
})
// Original bitmap open outline ends: (18, 96), (87, 68).
// A rigid placement preserves the upstream paw outline and pink pads.
const transform = computed(() => {
  const width = props.config.cuff.width
  const angle = props.config.cuff.angle ?? 0
  const scale = width / Math.hypot(69, 28)
  const mirrored = props.side === 'pointer'
  const sourceAngle = Math.atan2(-28, 69) * 180 / Math.PI
  const rotate = angle - (mirrored ? -sourceAngle : sourceAngle)
  return `translate(${props.config.root.x} ${props.config.root.y - 12}) rotate(${rotate}) scale(${mirrored ? -scale : scale} ${scale}) translate(-52.5 -82)`
})
</script>

<template>
  <g
    class="sleeve-arm original-raised-paw"
    data-pose="raised"
    :data-root-x="config.root.x"
    :data-root-y="config.root.y"
    pointer-events="none"
  >
    <defs>
      <clipPath :id="clipId">
        <path :d="wrist.clip" />
      </clipPath>
    </defs>
    <g :clip-path="`url(#${clipId})`">
      <path
        :d="wrist.bridge"
        fill="white"
      />
      <path
        :d="wrist.sides"
        fill="none"
        stroke="#111"
        stroke-width="5.3"
      />
      <image
        class="original-paw-bitmap"
        height="106"
        href="/interaction/original/paw-up.png"
        :transform="transform"
        width="99"
      />
    </g>
  </g>
</template>
