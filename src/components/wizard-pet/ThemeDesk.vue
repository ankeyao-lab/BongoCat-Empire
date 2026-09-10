<script setup lang="ts">
import { computed, useId } from 'vue'

import { surfaceTier, themeSurface } from './theme-surfaces'

const props = defineProps<{ themeId: string, level: number }>()
const id = `theme-desk-${useId().replace(/:/g, '')}`
const surface = computed(() => themeSurface(props.themeId))
const tier = computed(() => surfaceTier(props.level))
// A compact tabletop begins beneath the chest instead of extending behind the back.
// The lower footprint still supports every original device at its existing position.
const deskPath = 'M109 372 L550 453 Q563 456 568 468 L575 483 Q577 488 574 494 L540 568 Q536 577 526 577 H14 Q2 577 2 565 V444 Q2 439 7 435 L99 376 Q104 372 109 372Z'
</script>

<template>
  <g
    class="theme-desk"
    :data-theme="themeId"
    :data-tier="tier"
    pointer-events="none"
  >
    <defs>
      <clipPath :id="id">
        <path :d="deskPath" />
      </clipPath>
      <linearGradient
        :id="`${id}-light`"
        x1="0"
        x2="0"
        y1="0"
        y2="1"
      >
        <stop
          offset="0"
          stop-color="#fff"
          stop-opacity=".14"
        /><stop
          offset="1"
          stop-color="#fff"
          stop-opacity="0"
        />
      </linearGradient>
    </defs>
    <path
      :d="deskPath"
      :fill="surface.desk[tier]"
      :stroke="surface.rim[tier]"
      stroke-width="4"
    />
    <g :clip-path="`url(#${id})`">
      <path
        :d="deskPath"
        :fill="`url(#${id}-light)`"
      />
      <g
        fill="none"
        opacity=".27"
        :stroke="surface.ink"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="1.3"
      >
        <template v-if="surface.kind === 'wood'">
          <path d="M-30 404 Q76 400 168 437 T365 477 T658 532 M-20 491 Q78 505 156 522 T352 557 M-10 554 Q44 548 133 580" />
          <path
            v-if="tier > 0"
            d="M18 505 Q47 494 67 514 Q43 521 18 505 M28 507 Q44 502 54 511"
          />
        </template>
        <template v-else-if="surface.kind === 'bamboo'">
          <path d="M-20 432 L620 550 M-20 509 L380 583 M52 445 L47 473 M331 497 L326 525 M140 539 L135 567" />
          <path
            v-if="tier > 0"
            d="M30 452 L104 466 M410 548 L520 568"
          />
        </template>
        <template v-else-if="surface.kind === 'panel'">
          <path d="M18 350 L7 365 L7 477 Q7 492 22 495 L157 520 M597 460 L597 548" />
          <path
            v-if="tier > 0"
            d="M17 485 L157 511 M581 461 L581 505"
          />
        </template>
        <template v-else-if="surface.kind === 'stone'">
          <path
            d="M-30 480 Q30 446 94 483 T204 524 M421 556 Q479 530 638 578"
            opacity=".5"
            stroke-width="5"
          />
          <path
            v-if="tier > 0"
            d="M-10 490 Q37 462 87 491"
            stroke="#fff"
            stroke-width="3"
          />
        </template>
        <template v-else>
          <path
            d="M6 490 L166 520 M3 494 L163 524 M6 498 L160 528 M543 552 L610 565 M541 556 L610 569"
            opacity=".55"
          />
        </template>
      </g>
      <path
        d="M3 563 Q3 574 15 574 H523 Q534 574 539 563"
        fill="none"
        :stroke="surface.rim[tier]"
        :stroke-width="tier === 2 ? 7 : 4"
      />
      <!-- One small corner detail stays outside the keyboard, touchpad and hand travel. -->
      <g
        fill="none"
        opacity=".65"
        :stroke="surface.ink"
        stroke-width="1.9"
        transform="translate(92 554) rotate(10)"
      >
        <path
          v-if="surface.motif === 'crescent'"
          d="M-14 -3 C-7 -16 13 -13 15 -1 C4 -8 -2 0 3 8 C-9 10 -17 5 -14 -3Z"
        />
        <g v-else-if="surface.motif === 'hatch'">
          <rect
            height="20"
            rx="7"
            width="32"
            x="-15"
            y="-10"
          /><path d="M-6 0 Q3 -9 11 0 Q3 9 -6 0 M-6 0 L-11 -4 V4Z" />
        </g>
        <path
          v-else-if="surface.motif === 'map'"
          d="M-18 4 L-15 -10 L5 -6 L17 -8 L14 8 L-4 6Z M-6 -1 Q0 -9 6 -1 Q0 5 -6 -1"
        />
        <path
          v-else-if="surface.motif === 'leaf'"
          d="M-13 9 Q-20 -7 12 -10 Q18 4 -13 9Z M-13 9 L9 -7"
        />
        <g v-else-if="surface.motif === 'tape'">
          <path d="M-16 -8 L14 -4 L11 10 L-18 5Z" /><path d="M-1 -4 L7 -2 L5 4 L-2 5 L-5 2 L0 1Z" />
        </g>
        <path
          v-else-if="surface.motif === 'chopstick'"
          d="M-22 1 L23 -2 M16 -3 L28 -4 M17 0 L29 -1"
        />
        <g v-else-if="surface.motif === 'biscuit'">
          <path d="M12 -7 Q4 -16 -8 -8 Q-18 0 -10 9 Q1 16 12 7 Q3 8 4 1 Q10 3 12 -7Z" /><path d="M-7 -3 L-5 -2 M-1 7 L1 8 M-6 4 L-4 5" />
        </g>
        <g v-else-if="surface.motif === 'seed'">
          <path
            d="M-21 5 Q-6 -9 3 4 T19 2"
            stroke-dasharray="2 4"
          /><path d="M7 -7 Q15 -14 18 -7 Q14 1 7 -7Z" />
        </g>
        <g v-else-if="surface.motif === 'button'">
          <ellipse
            rx="12"
            ry="9"
          /><path d="M-4 -2 L4 2 M4 -2 L-4 2 M-10 6 L-17 12" />
        </g>
        <path
          v-else-if="surface.motif === 'cloud'"
          d="M-12 7 C-26 3 -21 -9 -12 -7 C-8 -19 10 -16 11 -5 C27 -6 27 10 11 9Z"
        />
        <g v-else-if="surface.motif === 'sweep'">
          <path d="M-22 -6 Q-10 12 8 8 M-19 -10 Q-8 7 8 5 M14 0 Q22 -3 24 4 Q18 11 14 0Z" />
        </g>
        <g v-else>
          <ellipse
            rx="13"
            ry="10"
            transform="rotate(-14)"
          /><path d="M-5 -5 L5 -3 L4 5 L-5 4Z M-1 -2 V2" />
        </g>
      </g>
    </g>
  </g>
</template>
