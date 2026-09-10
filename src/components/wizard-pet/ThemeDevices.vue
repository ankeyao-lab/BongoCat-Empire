<script setup lang="ts">
import { computed, useId } from 'vue'

import type { InteractionMode } from './interaction-assets'

import { surfaceTier, themeSurface } from './theme-surfaces'

const props = defineProps<{ themeId: string, level: number, mode: InteractionMode }>()
const id = `v6-devices-${useId().replace(/:/g, '')}`
const surface = computed(() => themeSurface(props.themeId))
const tier = computed(() => surfaceTier(props.level))
const baseMode = computed(() => props.mode === 'trackpad' ? 'standard' : props.mode)
const mask = (name: string) => `/device-skins/v1/masks/${name}.png`
const parts = ['keyboard-shell', 'keyboard-keycaps', 'keyboard-side', 'arrows', 'pad']
const partFile = (part: string) => part === 'arrows' ? 'keyboard-arrows' : part === 'pad' ? 'standard-pad' : `${baseMode.value}-${part}`
</script>

<template>
  <g
    class="theme-devices"
    :data-theme="themeId"
    :data-tier="tier"
  >
    <defs v-if="mode === 'gamepad'">
      <clipPath :id="`${id}-gamepad-controls`">
        <!-- The original gamepad sprite also contains a full-width desk line. -->
        <path d="M0 336.7 L612 446.86 V530 H0Z" />
      </clipPath>
    </defs>
    <image
      class="original-devices"
      :clip-path="mode === 'gamepad' ? `url(#${id}-gamepad-controls)` : undefined"
      height="354"
      :href="`/device-skins/v2/original/${baseMode}.png`"
      width="612"
      x="0"
      y="176"
    />
    <template v-if="mode !== 'gamepad'">
      <defs>
        <mask
          v-for="part in parts"
          :id="`${id}-${part}`"
          :key="part"
          height="580"
          maskUnits="userSpaceOnUse"
          width="612"
          x="0"
          y="0"
        >
          <image
            height="354"
            :href="mask(partFile(part))"
            width="612"
            x="0"
            y="176"
          />
        </mask>
        <clipPath :id="`${id}-touch`">
          <path d="M91 363 L248 393 L168 469 L23 422Z" />
        </clipPath>
        <linearGradient
          :id="`${id}-sheen`"
          x1="0"
          x2=".3"
          y1="0"
          y2="1"
        >
          <stop
            offset="0"
            stop-color="white"
            stop-opacity=".22"
          /><stop
            offset="1"
            stop-color="white"
            stop-opacity="0"
          />
        </linearGradient>
      </defs>
      <rect
        :fill="surface.shell"
        height="354"
        :mask="`url(#${id}-keyboard-shell)`"
        width="612"
        x="0"
        y="176"
      />
      <rect
        :fill="surface.rim[tier]"
        height="354"
        :mask="`url(#${id}-keyboard-side)`"
        width="612"
        x="0"
        y="176"
      />
      <rect
        :fill="surface.key"
        height="354"
        :mask="`url(#${id}-keyboard-keycaps)`"
        width="612"
        x="0"
        y="176"
      />
      <image
        class="original-key-ink"
        height="354"
        :href="mask(`${baseMode}-keyboard-ink`)"
        width="612"
        x="0"
        y="176"
      />
      <template v-if="mode === 'keyboard'">
        <rect
          :fill="surface.key"
          height="354"
          :mask="`url(#${id}-arrows)`"
          width="612"
          x="0"
          y="176"
        />
        <image
          class="original-arrow-ink"
          height="354"
          :href="mask('keyboard-arrows-ink')"
          width="612"
          x="0"
          y="176"
        />
      </template>
      <template v-else>
        <rect
          :fill="surface.rim[tier]"
          height="354"
          :mask="`url(#${id}-pad)`"
          width="612"
          x="0"
          y="176"
        />
        <path
          d="M91 363 L248 393 L168 469 L23 422Z"
          :fill="surface.pad"
          :stroke="surface.ink"
          stroke-width="1.3"
        />
        <rect
          :clip-path="`url(#${id}-touch)`"
          :fill="`url(#${id}-sheen)`"
          height="140"
          width="275"
          x="0"
          y="350"
        />
      </template>
    </template>
  </g>
</template>
