<script setup lang="ts">
import { computed, useId } from 'vue'

import type { InteractionMode, WizardInputState } from '@/composables/useWizardInput'

import { playfulThemes } from './playful-art'

const props = defineProps<{ themeId: string, level: number, mode: InteractionMode, input: WizardInputState }>()
const palette = computed(() => playfulThemes.find(t => t.id === props.themeId)?.colors ?? ['#8e63d9', '#ffe168', '#a8e7d4', '#ee7168'])
const maskId = `device-border-${useId().replace(/:/g, '')}`
</script>

<template>
  <g
    class="theme-device-decoration"
    :data-theme="themeId"
    pointer-events="none"
  >
    <defs>
      <mask
        :id="maskId"
        height="220"
        maskUnits="userSpaceOnUse"
        width="612"
        x="0"
        y="320"
      >
        <rect
          fill="white"
          height="220"
          width="612"
          x="0"
          y="320"
        />
        <!-- Black interiors forbid decorations from touching any original key label. -->
        <path
          d="M315 389 L560 431 L507 533 L220 463Z"
          fill="black"
        />
        <path
          d="M80 351 L268 386 L171 482 L3 425Z"
          fill="black"
        />
      </mask>
    </defs>
    <g
      v-if="mode !== 'gamepad'"
      class="keyboard-cosmetic-frame"
      fill="none"
      :mask="`url(#${maskId})`"
      :stroke="palette[0]"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="4.5"
    >
      <path d="M302 386 L317 382 L341 387 M548 424 L567 428 L560 445 M516 520 L512 539 L489 534 M233 470 L214 465 L226 453" />
    </g>
    <g
      v-if="mode === 'trackpad'"
      class="trackpad-cosmetic-frame"
      fill="none"
      :stroke="palette[0]"
      stroke-linecap="round"
      stroke-width="3.2"
    >
      <path d="M73 354 L82 347 L103 351 M248 378 L269 383 L262 398 M181 472 L169 485 L151 479 M8 405 L1 414 L4 426" />
    </g>
    <g
      v-if="mode === 'gamepad'"
      class="gamepad-cosmetic-frame"
      fill="none"
      :stroke="palette[0]"
      stroke-linecap="round"
      stroke-width="4"
    >
      <path d="M28 474 Q40 487 53 481 M515 483 Q530 492 537 479" />
    </g>
  </g>
</template>
