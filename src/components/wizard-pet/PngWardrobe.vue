<script setup lang="ts">
import { computed } from 'vue'

import type { PngOutfit } from './png-wardrobe'

const props = defineProps<{ outfit: PngOutfit, layer: 'back' | 'front' | 'desk', hatMask: string, robeClip: string }>()
const pieces = computed(() => {
  if (props.layer === 'desk') return []
  if (props.layer === 'front') return props.outfit.hat ? [props.outfit.hat] : []
  return [props.outfit.cape, props.outfit.prop].filter(piece => piece !== null)
})
</script>

<template>
  <g
    data-art-source="png"
    pointer-events="none"
  >
    <!-- Hats are complete foreground garments. A single continuous face
         exclusion in PlayfulWardrobe protects the expression below the brim. -->
    <g :mask="layer === 'front' ? hatMask : undefined">
      <image
        v-for="piece in pieces"
        :key="piece.src"
        data-png-garment
        :height="piece.rect[3]"
        :href="piece.src"
        :preserveAspectRatio="piece.fit"
        :transform="piece.rotation ? `rotate(${piece.rotation.join(' ')})` : undefined"
        :width="piece.rect[2]"
        :x="piece.rect[0]"
        :y="piece.rect[1]"
      />
    </g>
    <g
      v-if="layer === 'front' && outfit.robe"
      :clip-path="robeClip"
      data-clothing-front
    >
      <image
        data-png-garment
        data-slot="robe"
        :height="outfit.robe.rect[3]"
        :href="outfit.robe.src"
        :preserveAspectRatio="outfit.robe.fit"
        :transform="outfit.robe.rotation ? `rotate(${outfit.robe.rotation.join(' ')})` : undefined"
        :width="outfit.robe.rect[2]"
        :x="outfit.robe.rect[0]"
        :y="outfit.robe.rect[1]"
      />
    </g>
  </g>
</template>
