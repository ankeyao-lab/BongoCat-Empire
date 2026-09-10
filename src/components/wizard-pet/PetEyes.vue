<script setup lang="ts">
withDefaults(defineProps<{ blink?: boolean }>(), { blink: true })

const eyes = [
  { id: 'left', src: '/interaction/original/eye-left.png', x: 239, y: 302, width: 23, height: 25 },
  { id: 'right', src: '/interaction/original/eye-right.png', x: 356, y: 337, width: 23, height: 27 },
] as const
</script>

<template>
  <g
    class="pet-eyes"
    :class="{ 'is-blinking': blink }"
    pointer-events="none"
  >
    <g
      v-for="eye in eyes"
      :key="eye.id"
      :data-eye="eye.id"
      :transform="`translate(${eye.x + eye.width / 2} ${eye.y + eye.height / 2})`"
    >
      <!-- Keep the original bitmap, scaling only around this eye's center. -->
      <g class="eye-blink">
        <animateTransform
          v-if="blink"
          attributeName="transform"
          dur="5.6s"
          keyTimes="0;0.94;0.955;0.97;1"
          repeatCount="indefinite"
          type="scale"
          values="1 1;1 1;1 0.08;1 1;1 1"
        />
        <image
          :height="eye.height"
          :href="eye.src"
          :width="eye.width"
          :x="-eye.width / 2"
          :y="-eye.height / 2"
        />
      </g>
    </g>
  </g>
</template>
