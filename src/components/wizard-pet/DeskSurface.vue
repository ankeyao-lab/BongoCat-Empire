<script setup lang="ts">
import { computed, useId } from 'vue'

import type { InteractionMode } from '@/composables/useWizardInput'

const props = defineProps<{ themeId: string, level: number, mode: InteractionMode, devicesSkinned?: boolean }>()
const id = `desk-${useId().replace(/:/g, '')}`
const tier = computed(() => Math.min(2, Math.max(0, Math.floor((props.level - 1) / 3))))
type Material = 'wood' | 'metal' | 'bamboo' | 'stone'
const materials: Record<string, { kind: Material, shades: string[], ink: string }> = {
  wizard: { kind: 'wood', shades: ['#f6ead9', '#efdfc5', '#e9d6b6'], ink: '#b89472' },
  astronaut: { kind: 'metal', shades: ['#eef3f7', '#e4edf4', '#dae7f0'], ink: '#9aafbf' },
  pirate: { kind: 'wood', shades: ['#f1e5d2', '#e9d8bc', '#e0c8a6'], ink: '#a78966' },
  ninja: { kind: 'metal', shades: ['#eeeff4', '#e4e5ed', '#d9dce8'], ink: '#a1a3b8' },
  hero: { kind: 'metal', shades: ['#f0f2f6', '#e6ebf2', '#dbe4ef'], ink: '#9cabc1' },
  wuxia: { kind: 'bamboo', shades: ['#edf0dd', '#e3e9c9', '#dce3bc'], ink: '#9ba878' },
  baker: { kind: 'wood', shades: ['#fbefdf', '#f4e5d0', '#efddc3'], ink: '#c09b7e' },
  garden: { kind: 'bamboo', shades: ['#f1f0dc', '#e8e8c9', '#e0e3bc'], ink: '#9ba777' },
  performer: { kind: 'wood', shades: ['#f4e7e4', '#ecdddb', '#e5d4d5'], ink: '#b69a9f' },
  cultivation: { kind: 'stone', shades: ['#eef5ef', '#e3f0e8', '#d8e9e0'], ink: '#a3bfb0' },
  shaolin: { kind: 'wood', shades: ['#f1eadc', '#e9dfcb', '#e2d5bd'], ink: '#a99a7c' },
  emperor: { kind: 'wood', shades: ['#f4e7dd', '#ecdbcf', '#e7d1c3'], ink: '#b49280' },
}
const material = computed(() => materials[props.themeId] ?? materials.wizard!)
const baseMode = computed(() => props.mode === 'trackpad' ? 'standard' : props.mode)
// Only source-white pixels become an opaque mask. Original alpha is restored
// after thresholding, so the cat area and antialiased black table line stay clear.
const whiteThreshold = `${Array.from({ length: 255 }, () => '0').join(' ')} 1`
</script>

<template>
  <g
    class="desk-surface"
    :data-material="material.kind"
    :data-tier="tier"
    pointer-events="none"
  >
    <defs>
      <filter
        :id="`${id}-white`"
        color-interpolation-filters="sRGB"
      >
        <feColorMatrix
          type="matrix"
          values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 .2126 .7152 .0722 0 0"
        />
        <feComponentTransfer>
          <feFuncA
            :tableValues="whiteThreshold"
            type="discrete"
          />
        </feComponentTransfer>
        <feComposite
          in2="SourceAlpha"
          operator="in"
        />
      </filter>
      <mask
        :id="`${id}-safe`"
        height="580"
        maskUnits="userSpaceOnUse"
        width="612"
        x="0"
        y="0"
      >
        <image
          :filter="`url(#${id}-white)`"
          height="354"
          :href="`/interaction/${baseMode}/background.png`"
          width="612"
          x="0"
          y="176"
        />
        <rect
          fill="white"
          height="50"
          width="612"
          x="0"
          y="530"
        />
        <!-- Preserve the outlined keyboard/trackpad surfaces. The upstream gamepad
             has individual buttons on the table, so preserve each input surface
             and its outline without inventing an enclosing white controller. -->
        <g
          v-if="mode !== 'gamepad' && !devicesSkinned"
          fill="black"
        >
          <path d="M303 376 L581 428 L514 550 L198 470Z" />
          <path
            v-if="mode !== 'keyboard'"
            d="M74 345 L278 383 L177 489 L0 431 L0 407Z"
          />
          <path
            v-else
            d="M82 352 L259 385 L168 481 L41 443Z"
          />
          <!-- Convex hull of the original right-arrow closed white key, expanded
               5px to include its black outline; derived from the source PNG. -->
          <polygon
            v-if="mode === 'keyboard'"
            points="186,423 192,416 200,407 210,397 217,397 234,401 250,405 252,406 250,409 238,424 233,430 230,433 228,434 222,434 218,433 193,426 186,424"
            stroke="black"
            stroke-linejoin="round"
            stroke-width="10"
          />
        </g>
        <!-- Source-derived mask protects only actual button ink and closed white
             key faces. Connected table-white stays paintable between buttons. -->
        <image
          v-else-if="mode === 'gamepad'"
          height="354"
          href="/device-skins/v1/masks/gamepad-exclusion.png"
          width="612"
          x="0"
          y="176"
        />
      </mask>
      <pattern
        :id="`${id}-texture`"
        height="72"
        patternTransform="matrix(1 .185 0 1 0 0)"
        patternUnits="userSpaceOnUse"
        width="128"
      >
        <rect
          :fill="material.shades[tier]"
          height="72"
          width="128"
        />
        <g
          fill="none"
          :stroke="material.ink"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <template v-if="material.kind === 'wood'">
            <path
              d="M-9 22 Q22 15 53 23 T138 22 M-9 51 Q23 57 56 49 T139 50"
              opacity=".38"
              stroke-width="1.3"
            />
            <path
              v-if="tier >= 1"
              d="M34 25 Q52 11 69 25 Q53 37 34 25 M43 25 Q53 21 60 25"
              opacity=".35"
              stroke-width="1.1"
            />
            <path
              v-if="tier >= 2"
              d="M0 70 H128 M94 0 V13 M16 59 V72"
              opacity=".28"
              stroke-width="1.2"
            />
          </template>
          <template v-else-if="material.kind === 'metal'">
            <path
              d="M12 18 H71 M44 29 H117 M-9 51 H49 M62 63 H141"
              opacity=".35"
              stroke-width="1"
            />
            <path
              v-if="tier >= 1"
              d="M10 20 H66 M49 31 H113 M66 65 H123"
              opacity=".8"
              stroke="#fff"
              stroke-width="2"
            />
            <path
              v-if="tier >= 2"
              d="M0 70 H128 M126 0 V70"
              opacity=".24"
              stroke-width="1.2"
            />
          </template>
          <template v-else-if="material.kind === 'bamboo'">
            <path
              d="M0 15 H128 M0 38 H128 M0 61 H128"
              opacity=".36"
              stroke-width="1.5"
            />
            <path
              d="M29 15 V37 M91 38 V60 M57 0 V14"
              opacity=".32"
              stroke-width="2.5"
            />
            <path
              v-if="tier >= 1"
              d="M7 19 H22 M39 31 H69 M101 43 H119 M13 53 H58"
              opacity=".3"
              stroke-width="1"
            />
            <path
              v-if="tier >= 2"
              d="M24 17 Q27 22 24 26 M86 42 Q89 49 86 54"
              opacity=".4"
              stroke-width="1"
            />
          </template>
          <template v-else>
            <path
              d="M-12 32 Q14 7 43 25 T101 31 Q119 34 137 17"
              opacity=".26"
              stroke-width="1.7"
            />
            <path
              v-if="tier >= 1"
              d="M-11 41 Q15 16 44 34 T102 40"
              opacity=".22"
              stroke-width="1"
            />
            <path
              v-if="tier >= 2"
              d="M16 66 Q32 49 65 57 T140 64"
              opacity=".65"
              stroke="#fff"
              stroke-width="3"
            />
          </template>
        </g>
      </pattern>
    </defs>
    <path
      d="M0 329 L612 442 V580 H0Z"
      :fill="`url(#${id}-texture)`"
      :mask="`url(#${id}-safe)`"
    />
  </g>
</template>
