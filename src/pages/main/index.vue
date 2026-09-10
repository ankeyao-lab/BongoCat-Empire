<script setup lang="ts">
import { invoke } from '@tauri-apps/api/core'
import { computed, defineAsyncComponent, onUnmounted, watch } from 'vue'

import WizardDesktop from '@/components/wizard-pet/WizardDesktop.vue'
import { useGrowth } from '@/composables/useGrowth'
import { INVOKE_KEY } from '@/constants'
import { useCatStore } from '@/stores/cat'
import { useModelStore } from '@/stores/model'

const catStore = useCatStore()
const modelStore = useModelStore()
const { state } = useGrowth()
// Interaction state never changes when a costume is equipped. Imported models
// keep their own Live2D body when no wardrobe costume is being displayed.
const legacy = computed(() => state.value?.outfitThemeId === 'none'
  && catStore.model.interactionMode !== 'trackpad'
  && modelStore.currentModel?.isPreset === false)
const LegacyPet = defineAsyncComponent(() => import('@/components/wizard-pet/LegacyPet.vue'))

// Native input belongs to the interaction mode, never to a clothing renderer.
watch(() => catStore.model.interactionMode, (mode) => {
  void invoke(mode === 'gamepad' ? INVOKE_KEY.START_GAMEPAD_LISTING : INVOKE_KEY.STOP_GAMEPAD_LISTING)
}, { immediate: true })
onUnmounted(() => {
  void invoke(INVOKE_KEY.STOP_GAMEPAD_LISTING)
})
</script>

<template>
  <LegacyPet v-if="legacy" />
  <WizardDesktop v-else />
</template>
