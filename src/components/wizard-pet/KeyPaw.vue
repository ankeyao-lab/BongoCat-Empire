<script setup lang="ts">
import { computed, useId } from 'vue'

import { keyPawBridge } from './key-paw-bridge'

const props = withDefaults(defineProps<{
  src: string
  /** Shoulder and palm contact line in stage coordinates, including image y=176. */
  anchorY: number
  contactY: number
  deviceOffsetY?: number
}>(), { deviceOffsetY: 0 })

const clipId = `key-paw-opening-${useId().replace(/[^a-z0-9-]/gi, '')}`
const bridge = computed(() => keyPawBridge(props.src, props.anchorY, props.contactY, props.deviceOffsetY))

const extension = computed(() => {
  const span = props.contactY - props.anchorY
  if (!Number.isFinite(span) || span <= 0 || !Number.isFinite(props.deviceOffsetY)) return null
  if (props.deviceOffsetY === 0) return null
  const scaleY = 1 + props.deviceOffsetY / span
  if (scaleY <= 0) return null
  return `translate(0 ${props.anchorY}) scale(1 ${scaleY}) translate(0 ${-props.anchorY})`
})
</script>

<template>
  <g
    class="key-paw"
    :data-anchor-y="anchorY"
    :data-contact-y="contactY"
    :data-device-offset-y="deviceOffsetY"
    pointer-events="none"
    :transform="extension"
  >
    <defs v-if="bridge">
      <clipPath
        :id="clipId"
        clipPathUnits="userSpaceOnUse"
      >
        <rect
          fill="white"
          height="580"
          width="612"
          x="0"
          :y="bridge.cut"
        />
      </clipPath>
    </defs>
    <g
      v-if="bridge"
      class="key-paw-shoulder"
      :transform="bridge.inverse"
    >
      <path
        :d="bridge.fill"
        fill="white"
      />
      <path
        :d="bridge.outer"
        fill="none"
        stroke="#141414"
        stroke-linecap="round"
        stroke-width="5.3"
      />
      <path
        :d="bridge.inner"
        fill="none"
        stroke="#141414"
        stroke-linecap="round"
        stroke-width="5.3"
      />
    </g>
    <!-- At offset zero there is no transform: every original paw pixel remains
         in its upstream slot. Extension moves the palm while fixing the shoulder. -->
    <image
      class="key-paw-image"
      :clip-path="bridge ? `url(#${clipId})` : undefined"
      height="354"
      :href="src"
      width="612"
      x="0"
      y="176"
    />
  </g>
</template>
