<script setup lang="ts">
import { computed } from 'vue'

import { useEmpireLocale } from '@/locales/empire'

import type { PreferenceSection } from '../sections'

defineProps<{ modelValue: PreferenceSection, nativeMac?: boolean }>()

const emit = defineEmits<{ 'update:modelValue': [value: PreferenceSection], 'close': [], 'languageChange': [value: 'zh-CN' | 'en-US'] }>()

const { tr, locale } = useEmpireLocale()

const menus = computed<{ key: PreferenceSection, label: string, icon: string }[]>(() => [
  { key: 'themes', label: tr('主题切换', 'Themes'), icon: 'i-solar:magic-stick-3-bold' },
  { key: 'progress', label: tr('养成进度', 'Growth'), icon: 'i-solar:chart-2-bold' },
  { key: 'thresholds', label: tr('自定义门槛', 'Level thresholds'), icon: 'i-solar:keyboard-bold' },
  { key: 'settings', label: tr('更多设置', 'More settings'), icon: 'i-solar:settings-minimalistic-bold' },
  { key: 'backup', label: tr('备份', 'Backup'), icon: 'i-solar:folder-with-files-bold' },
])

function changeLanguage(event: Event) {
  const language = (event.target as HTMLSelectElement).value as 'zh-CN' | 'en-US'
  locale.value = language
  emit('languageChange', language)
}
</script>

<template>
  <div class="preference-shell">
    <header
      class="preference-titlebar"
      :class="{ 'native-mac': nativeMac }"
      data-tauri-drag-region
    >
      <span data-tauri-drag-region>{{ tr('BongoCat Empire · 设置', 'BongoCat Empire · Settings') }}</span>
      <div class="titlebar-controls">
        <select
          aria-label="界面语言 / Interface language"
          class="language-switch"
          :value="locale"
          @change="changeLanguage"
        >
          <option value="zh-CN">
            简体中文
          </option>
          <option value="en-US">
            English
          </option>
          <option
            v-if="locale !== 'zh-CN' && locale !== 'en-US'"
            :value="locale"
          >
            {{ locale }}
          </option>
        </select>
        <button
          v-if="!nativeMac"
          :aria-label="tr('关闭设置窗口', 'Close settings')"
          class="close-preferences"
          :title="tr('关闭设置窗口 · 桌宠继续运行', 'Close settings · Keep the companion running')"
          type="button"
          @click="emit('close')"
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>
    </header>
    <div class="preference-body">
      <aside class="preference-sidebar">
        <div
          class="preference-brand"
          data-tauri-drag-region
        >
          <img
            alt="BongoCat Empire"
            data-tauri-drag-region
            src="/logo.png"
          >
          <strong data-tauri-drag-region>BongoCat Empire</strong>
        </div>
        <nav
          :aria-label="tr('设置导航', 'Settings navigation')"
          class="preference-navigation"
        >
          <button
            v-for="item in menus"
            :key="item.key"
            :aria-current="modelValue === item.key ? 'page' : undefined"
            :data-section="item.key"
            type="button"
            @click="emit('update:modelValue', item.key)"
          >
            <span
              aria-hidden="true"
              class="menu-icon"
              :class="item.icon"
            />
            <span>{{ item.label }}</span>
          </button>
        </nav>
      </aside>
      <div
        id="preference-content"
        class="preference-content"
      >
        <slot />
      </div>
    </div>
  </div>
</template>

<style scoped>
.titlebar-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}
.language-switch {
  border: 1px solid var(--ant-color-border-secondary, #e6e1d8);
  border-radius: 7px;
  padding: 4px 8px;
  color: inherit;
  background: var(--ant-color-bg-container, #faf9f6);
  font: inherit;
}
.language-switch:focus-visible {
  outline: 2px solid #8c75b1;
  outline-offset: 2px;
}

.preference-shell {
  height: 100vh;
  color: var(--ant-color-text, #302d37);
}
.preference-titlebar {
  height: 44px;
  padding: 0 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--ant-color-bg-container, #faf9f6);
  border-bottom: 1px solid var(--ant-color-border-secondary, #e6e1d8);
  font-size: 12px;
  color: var(--ant-color-text-secondary, #756e7c);
  user-select: none;
}
.preference-titlebar.native-mac {
  padding-left: 88px;
}
.preference-body {
  display: flex;
  height: calc(100vh - 44px);
}
.preference-sidebar {
  width: 144px;
  flex: 0 0 144px;
  overflow: auto;
  background: var(--ant-color-bg-container, #faf9f6);
  border-right: 1px solid var(--ant-color-border-secondary, #e6e1d8);
}
.preference-brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 24px 8px 22px;
  text-align: center;
  user-select: none;
}
.preference-brand img {
  width: 64px;
  height: 64px;
  border-radius: 18px;
}
.preference-brand strong {
  display: block;
  width: 100%;
  font-size: 15px;
  font-weight: 650;
  letter-spacing: 0;
  line-height: 1.4;
}
.preference-navigation {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 0 10px 16px;
}
.preference-navigation button {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 50px;
  padding: 10px;
  border: 0;
  border-radius: 12px;
  color: var(--ant-color-text-secondary, #756e7c);
  background: transparent;
  font:
    14px/1.4 -apple-system,
    'PingFang SC',
    sans-serif;
  cursor: pointer;
  text-align: left;
}
.preference-navigation button:hover {
  background: var(--ant-color-fill-tertiary, #eee9f2);
}
.preference-navigation button[aria-current='page'] {
  color: #8c75b1;
  background: rgb(148 118 177 / 13%);
  font-weight: 650;
}
.menu-icon {
  display: block;
  width: 22px;
  height: 22px;
  flex: 0 0 22px;
}
:global(html.dark .preference-titlebar),
:global(html.dark .preference-sidebar) {
  background: #202020;
  border-color: #343434;
  color: #dedede;
}
:global(html.dark .language-switch) {
  background: #202020;
  border-color: #4d4d4d;
  color: #dedede;
  color-scheme: dark;
}
:global(html.dark .preference-navigation button) {
  color: #bfb8c6;
}
:global(html.dark .preference-navigation button[aria-current='page']) {
  color: #d1bedf;
  background: #362f3d;
}
.preference-content {
  flex: 1;
  min-width: 0;
  overflow: auto;
  padding: 24px;
  background: #f9f7f1;
}
.close-preferences {
  display: grid;
  place-items: center;
  width: 34px;
  height: 30px;
  padding: 0;
  border: 0;
  border-radius: 8px;
  color: inherit;
  background: transparent;
  font:
    24px/1 -apple-system,
    sans-serif;
  cursor: pointer;
}
.close-preferences:hover {
  background: #c34b53;
  color: white;
}
button:focus-visible {
  outline: 2px solid #8c75b1;
  outline-offset: 2px;
}
@media (max-width: 600px) {
  .preference-sidebar {
    width: 88px;
    flex-basis: 88px;
  }
  .preference-brand {
    padding: 18px 4px;
  }
  .preference-brand img {
    width: 48px;
    height: 48px;
    border-radius: 14px;
  }
  .preference-brand strong {
    font-size: 14px;
  }
  .preference-navigation {
    padding-inline: 6px;
  }
  .preference-navigation button {
    flex-direction: column;
    gap: 5px;
    padding: 9px 3px;
    font-size: 11px;
    text-align: center;
  }
  .preference-content {
    padding: 16px 12px;
  }
}
</style>
