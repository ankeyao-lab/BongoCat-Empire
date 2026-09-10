<script setup lang="ts">
import { computed, useId } from 'vue'

import type { InteractionMode } from '@/composables/useWizardInput'

import { DEVICE_SKIN_ROOT, getDeviceSkin, hasDeviceSkin } from '@/data/device-skins'

const props = withDefaults(defineProps<{
  themeId: string
  level: number
  mode?: InteractionMode
}>(), { mode: 'trackpad' })

// These are static surfaces only. The parent places them below original input
// feedback and applies its shared +36px equipment translation exactly once.
const id = `device-skin-${useId().replace(/:/g, '')}`
const enabled = computed(() => hasDeviceSkin(props.themeId, props.mode))
const modeBase = computed(() => props.mode === 'keyboard' ? 'keyboard' : 'standard')
const skin = computed(() => getDeviceSkin(props.themeId, props.level))
const maskPath = (name: string) => `${DEVICE_SKIN_ROOT}/masks/${name}.png`
const materialPath = (name: string) => `${DEVICE_SKIN_ROOT}/${props.themeId}/materials/${name}.png`
const maskNames = computed(() => [
  ['shell', `${modeBase.value}-keyboard-shell`],
  ['keys', `${modeBase.value}-keyboard-keycaps`],
  ['side', `${modeBase.value}-keyboard-side`],
  ['pad', 'standard-pad'],
  ['arrows', 'keyboard-arrows'],
])
</script>

<template>
  <g
    v-if="enabled && skin"
    class="device-skin"
    :data-device-skin="`${themeId}-${skin.level}`"
    :data-material-name="skin.name"
    pointer-events="none"
  >
    <defs>
      <mask
        v-for="[suffix, file] in maskNames"
        :id="`${id}-${suffix}`"
        :key="suffix"
        height="580"
        maskUnits="userSpaceOnUse"
        width="612"
        x="0"
        y="0"
      >
        <image
          height="354"
          :href="maskPath(file!)"
          width="612"
          x="0"
          y="176"
        />
      </mask>
      <clipPath :id="`${id}-touch-outer`">
        <path d="M80 355 Q84 351 91 353 L258 385 Q266 387 263 393 L173 476 Q169 481 161 479 L12 425 Q5 423 11 417Z" />
      </clipPath>
      <clipPath :id="`${id}-touch-inner`">
        <path d="M91 363 L248 393 L168 469 L23 422Z" />
      </clipPath>
    </defs>
    <g class="keyboard-full-skin">
      <image
        data-skin-slot="keyboardShell"
        height="154"
        :href="materialPath(skin.materials.shell)"
        :mask="`url(#${id}-shell)`"
        preserveAspectRatio="none"
        :style="{ filter: skin.shellFilter }"
        width="350"
        x="216"
        y="382"
      />
      <image
        data-skin-slot="keyboardSide"
        height="154"
        :href="materialPath(skin.materials.edge)"
        :mask="`url(#${id}-side)`"
        preserveAspectRatio="none"
        :style="{ filter: skin.metalFilter }"
        width="350"
        x="216"
        y="382"
      />
      <image
        data-skin-slot="keycapSurface"
        height="154"
        :href="materialPath(skin.materials.keycaps)"
        :mask="`url(#${id}-keys)`"
        preserveAspectRatio="none"
        :style="{ filter: skin.keycapFilter }"
        width="350"
        x="216"
        y="382"
      />
      <image
        data-skin-slot="keyboardInk"
        height="354"
        :href="maskPath(`${modeBase}-keyboard-ink`)"
        width="612"
        x="0"
        y="176"
      />
    </g>
    <g
      v-if="mode === 'trackpad'"
      class="trackpad-full-skin"
    >
      <image
        data-skin-slot="trackpadShell"
        height="142"
        :href="materialPath(skin.materials.edge)"
        :mask="`url(#${id}-pad)`"
        preserveAspectRatio="none"
        :style="{ filter: skin.metalFilter }"
        width="275"
        x="0"
        y="347"
      />
      <image
        :clip-path="`url(#${id}-touch-inner)`"
        data-skin-slot="trackpadSurface"
        height="111"
        :href="materialPath(skin.materials.touch)"
        preserveAspectRatio="none"
        :style="{ filter: skin.crystalFilter }"
        width="236"
        x="19"
        y="360"
      />
    </g>
    <image
      v-if="mode === 'standard'"
      data-skin-slot="mousepadSurface"
      height="142"
      :href="materialPath(skin.materials.touch)"
      :mask="`url(#${id}-pad)`"
      preserveAspectRatio="none"
      :style="{ filter: skin.crystalFilter }"
      width="275"
      x="0"
      y="347"
    />
    <g v-if="mode === 'keyboard'">
      <image
        data-skin-slot="arrowSurface"
        height="142"
        :href="materialPath(skin.materials.keycaps)"
        :mask="`url(#${id}-arrows)`"
        preserveAspectRatio="none"
        :style="{ filter: skin.keycapFilter }"
        width="275"
        x="0"
        y="347"
      />
      <image
        data-skin-slot="arrowInk"
        height="354"
        :href="maskPath('keyboard-arrows-ink')"
        width="612"
        x="0"
        y="176"
      />
    </g>
  </g>
</template>
