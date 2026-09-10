<script setup lang="ts">
import { computed, ref } from 'vue'

import { useEmpireLocale } from '@/locales/empire'

const { tr } = useEmpireLocale()

const active = ref('cat')
const menus = computed(() => [
  { key: 'cat', label: tr('交互与窗口', 'Interaction & window') },
  { key: 'general', label: tr('通用', 'General') },
  { key: 'model', label: tr('模型', 'Models') },
  { key: 'shortcut', label: tr('快捷键', 'Shortcuts') },
  { key: 'about', label: tr('关于', 'About') },
] as const)
</script>

<template>
  <section
    :aria-label="tr('应用设置', 'App settings')"
    class="additional-settings"
  >
    <nav
      :aria-label="tr('更多设置分类', 'Settings categories')"
      class="more-navigation"
    >
      <button
        v-for="item in menus"
        :key="item.key"
        :aria-current="active === item.key ? 'page' : undefined"
        :data-setting="item.key"
        type="button"
        @click="active = item.key"
      >
        {{ item.label }}
      </button>
    </nav>
    <!-- Keep each settings owner mounted so its existing watchers stay active.
         Explicit panels also keep v-show out of static dynamic-component loops. -->
    <div class="legacy-settings">
      <div
        v-show="active === 'cat'"
        data-setting-panel="cat"
        role="tabpanel"
      >
        <slot name="cat" />
      </div>
      <div
        v-show="active === 'general'"
        data-setting-panel="general"
        role="tabpanel"
      >
        <slot name="general" />
      </div>
      <div
        v-show="active === 'model'"
        data-setting-panel="model"
        role="tabpanel"
      >
        <slot name="model" />
      </div>
      <div
        v-show="active === 'shortcut'"
        data-setting-panel="shortcut"
        role="tabpanel"
      >
        <slot name="shortcut" />
      </div>
      <div
        v-show="active === 'about'"
        data-setting-panel="about"
        role="tabpanel"
      >
        <slot name="about" />
      </div>
    </div>
  </section>
</template>

<style scoped>
.legacy-settings {
  padding: 20px;
  border-radius: 14px;
  background: var(--ant-color-bg-container, white);
  color: var(--ant-color-text, #302d37);
}
:global(html.dark .legacy-settings) {
  background: #181818;
  color: #dedede;
}
.additional-settings {
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid #e4deea;
}
.more-navigation {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 20px;
}
.more-navigation button {
  border: 1px solid #e1dbe7;
  border-radius: 10px;
  padding: 9px 14px;
  background: transparent;
  color: #766783;
  font:
    14px/1.4 -apple-system,
    'PingFang SC',
    sans-serif;
  cursor: pointer;
}
.more-navigation button[aria-current='page'] {
  color: #72588e;
  border-color: #b59bc8;
  background: #eee7f3;
  font-weight: 600;
}
.more-navigation button:focus-visible {
  outline: 2px solid #8c75b1;
  outline-offset: 2px;
}
</style>
