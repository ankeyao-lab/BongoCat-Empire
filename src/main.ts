import { isTauri } from '@tauri-apps/api/core'
import { createPlugin } from '@tauri-store/pinia'
import { createPinia } from 'pinia'
import { createApp, h, watch } from 'vue'

import { i18n } from './locales'

import 'virtual:uno.css'
import 'antdv-next/dist/reset.css'

import './assets/css/global.scss'

watch(i18n.global.locale, (language) => {
  document.documentElement.lang = language
}, { immediate: true })

async function bootstrap() {
  const pinia = createPinia()
  if (!isTauri()) {
    const preview = new URLSearchParams(location.search).get('preview')
    if (preview === 'pet') {
      const { default: Preview } = await import('./components/wizard-pet/Preview.vue')
      createApp(Preview).use(pinia).use(i18n).mount('#app')
    } else {
      const { default: Growth } = await import('./components/growth/index.vue')
      const { ConfigProvider } = await import('antdv-next')
      createApp({ render: () => h(ConfigProvider, {}, { default: () => h(Growth) }) }).use(pinia).use(i18n).mount('#app')
      document.body.style.background = '#f5f2ec'
      document.body.style.padding = '24px'
      document.body.style.overflow = 'auto'
    }
    return
  }
  pinia.use(createPlugin({ saveOnChange: true }))
  const [{ default: App }, { default: router }] = await Promise.all([import('./App.vue'), import('./router')])
  createApp(App).use(router).use(pinia).use(i18n).mount('#app')
}

bootstrap().catch((error) => {
  console.error(error)
  document.getElementById('app')!.textContent = `BongoCat Empire ${i18n.global.locale.value.startsWith('zh') ? '启动失败：' : 'failed to start: '}${String(error)}`
})
