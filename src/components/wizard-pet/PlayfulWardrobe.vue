<script setup lang="ts">
import { computed, useId } from 'vue'

import { getPlayfulArt } from './playful-art'
import { getPngOutfit } from './png-wardrobe'
import PngWardrobe from './PngWardrobe.vue'

const props = defineProps<{ themeId: string, level: number, layer: 'back' | 'front' | 'desk' }>()
const maskId = `wardrobe-${useId().replace(/:/g, '')}`
const robeClipId = `${maskId}-robe`
const art = computed(() => getPlayfulArt(props.themeId, props.level))
const pngOutfit = computed(() => getPngOutfit(props.themeId, props.level))
const content = computed(() => props.layer === 'back' ? art.value.back : props.layer === 'front' ? art.value.robe + art.value.head : art.value.desk)
</script>

<template>
  <g
    class="playful-wardrobe"
    :data-layer="layer"
    :data-level="level"
    :data-theme="themeId"
    pointer-events="none"
  >
    <defs>
      <clipPath :id="robeClipId">
        <!-- Clothing may cover the chest below the expression. Arms and input
             devices are rendered above this garment independently. -->
        <path d="M174 310 Q211 316 238 337 Q278 348 322 350 Q354 379 386 371 Q435 355 477 322 L540 449 L142 374Z" />
      </clipPath>
      <mask
        :id="maskId"
        height="580"
        maskUnits="userSpaceOnUse"
        width="612"
        x="0"
        y="0"
      >
        <rect
          fill="white"
          height="580"
          width="612"
          x="0"
          y="0"
        />
        <!-- Headwear may cover the forehead and ears. Keep one continuous
             main-face exclusion, then protect paw motion and all input surfaces. -->
        <path
          d="M185 306 Q205 286 232 288 L392 317 Q428 330 449 349 L449 401 L320 408 L170 367Z"
          fill="black"
        />
        <rect
          v-if="!pngOutfit"
          fill="black"
          height="138"
          rx="14"
          width="161"
          x="69"
          y="295"
        />
        <rect
          v-if="!pngOutfit"
          fill="black"
          height="135"
          rx="12"
          width="111"
          x="381"
          y="299"
        />
        <path
          d="M0 321 L612 434 L612 580 L0 580Z"
          fill="black"
        />
      </mask>
    </defs>
    <g
      v-if="pngOutfit"
    >
      <PngWardrobe
        :hat-mask="`url(#${maskId})`"
        :layer="layer"
        :outfit="pngOutfit"
        :robe-clip="`url(#${robeClipId})`"
      />
    </g>
    <!-- During production migration, incomplete themes retain their existing art. -->
    <!-- eslint-disable vue/no-v-text-v-html-on-component -->
    <g
      v-else
      :mask="layer === 'desk' ? undefined : `url(#${maskId})`"
      v-html="content"
    />
    <!-- eslint-enable vue/no-v-text-v-html-on-component -->
  </g>
</template>
