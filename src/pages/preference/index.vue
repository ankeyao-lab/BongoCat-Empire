<script setup lang="ts">
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { ref, watchEffect } from 'vue'

import Growth from '@/components/growth/index.vue'
import { useTray } from '@/composables/useTray'
import { useEmpireLocale } from '@/locales/empire'
import { useGeneralStore } from '@/stores/general'
import { isMac } from '@/utils/platform'

import type { PreferenceSection } from './sections'

import About from './components/about/index.vue'
import Cat from './components/cat/index.vue'
import General from './components/general/index.vue'
import Model from './components/model/index.vue'
import MoreSettings from './components/MoreSettings.vue'
import PreferenceShell from './components/PreferenceShell.vue'
import Shortcut from './components/shortcut/index.vue'

useTray()
const generalStore = useGeneralStore()
const current = ref<PreferenceSection>('themes')
const appWindow = getCurrentWebviewWindow()
const { tr } = useEmpireLocale()
watchEffect(() => void appWindow.setTitle(tr('BongoCat Empire · 设置', 'BongoCat Empire · Settings')))
</script>

<template>
  <PreferenceShell
    v-model="current"
    :native-mac="isMac"
    @close="appWindow.hide()"
    @language-change="generalStore.appearance.language = $event"
  >
    <Growth :section="current" />
    <MoreSettings v-show="current === 'settings'">
      <template #cat>
        <Cat />
      </template>
      <template #general>
        <General />
      </template>
      <template #model>
        <Model />
      </template>
      <template #shortcut>
        <Shortcut />
      </template>
      <template #about>
        <About />
      </template>
    </MoreSettings>
  </PreferenceShell>
</template>
