<script setup lang="ts">
import { computed } from 'vue'

import type { SleeveArmConfig, SleevePoint } from './sleeve-arm'

import { sleeveArmGeometry } from './sleeve-arm'

const props = withDefaults(defineProps<{
  config: SleeveArmConfig
  palm: SleevePoint
  pressOffset?: number
  showCuff?: boolean
}>(), { pressOffset: 0, showCuff: true })

const geometry = computed(() => sleeveArmGeometry(props.config, props.palm, props.pressOffset))
</script>

<template>
  <g
    class="sleeve-arm"
    :data-contact-x="geometry.contact.x"
    :data-contact-y="geometry.contact.y"
    :data-face-clear="geometry.faceClear"
    :data-root-x="geometry.root.x"
    :data-root-y="geometry.root.y"
    pointer-events="none"
  >
    <path
      class="sleeve-arm-contour"
      :d="geometry.path"
      fill="white"
      stroke="#141414"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="5.3"
    />
    <path
      v-if="showCuff"
      class="sleeve-cuff-front"
      :d="geometry.cuffPath"
      :fill="config.cuff.color ?? '#685082'"
      :stroke="config.cuff.trim ?? '#302736'"
      stroke-linejoin="round"
      stroke-width="3"
    />
  </g>
</template>
