<script setup lang="ts">
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { Button, Space } from 'antdv-next'
import { checkInputMonitoringPermission, requestInputMonitoringPermission } from 'tauri-plugin-macos-permissions-api'
import { computed, onMounted, onUnmounted, ref } from 'vue'

import type { DeviceListenerState } from '@/composables/useWizardInput'

import ProListItem from '@/components/pro-list-item/index.vue'
import ProList from '@/components/pro-list/index.vue'
import { useEmpireLocale } from '@/locales/empire'
import { translateEmpireError } from '@/locales/empire-errors'

const { tr, locale } = useEmpireLocale()

const authorized = ref<boolean | null>(null)
const state = ref<DeviceListenerState | null>(null)
const error = ref<string | null>(null)
const subscriptionError = ref<string | null>(null)
const busy = ref(false)
let disposed = false
let stopListening: (() => void) | undefined
const hasPermission = computed(() => state.value?.permissionGranted ?? authorized.value)
const statusLabel = computed(() => {
  if (hasPermission.value === false) return tr('输入监控权限尚未生效', 'Input Monitoring permission is not active')
  if (!state.value?.listening) return state.value?.phase === 'recovering' ? tr('正在自动恢复监听', 'Reconnecting to input automatically') : tr('监听尚未建立', 'Input listener is not connected')
  return state.value.lastEventAt ? tr('监听已启用，已收到输入', 'Input listener is active and receiving events') : tr('监听已启用，等待实际输入', 'Input listener is active, waiting for input')
})
const timeLabel = (time: number | null | undefined) => time ? new Date(time).toLocaleTimeString(locale.value) : tr('本次运行尚未收到', 'No events this session')

async function refresh(start = false) {
  if (busy.value || disposed) return
  busy.value = true
  error.value = null
  try {
    const [permission, snapshot] = await Promise.all([
      checkInputMonitoringPermission(),
      invoke<DeviceListenerState>(start ? 'start_device_listening' : 'get_device_listener_state'),
    ])
    if (disposed) return
    authorized.value = permission
    state.value = snapshot
  } catch (cause) {
    if (!disposed) error.value = String(cause)
  } finally {
    if (!disposed) busy.value = false
  }
}
async function openPermissionSettings() {
  try {
    await requestInputMonitoringPermission()
  } catch (cause) {
    if (!disposed) error.value = String(cause)
  }
}
const onFocus = () => void refresh()
onMounted(async () => {
  window.addEventListener('focus', onFocus)
  try {
    const unlisten = await listen<DeviceListenerState>('device-listener-state', ({ payload }) => {
      if (!disposed) state.value = payload
    })
    if (disposed) return unlisten()
    stopListening = unlisten
  } catch (cause) {
    if (!disposed) subscriptionError.value = '监听诊断订阅失败：' + String(cause)
  }
  await refresh(true)
})
onUnmounted(() => {
  disposed = true
  stopListening?.()
  window.removeEventListener('focus', onFocus)
})
</script>

<template>
  <ProList :title="$t('pages.preference.general.labels.permissionsSettings')">
    <ProListItem
      :description="tr('授权状态与监听状态分别显示。系统停用监听器后会自动重建，权限生效后自动连接。', 'Permission and listener status are shown separately. The listener reconnects automatically when macOS disables it or permission becomes active.')"
      :title="$t('pages.preference.general.labels.inputMonitoringPermission')"
    >
      <Space wrap>
        <span :class="hasPermission ? 'text-success' : 'text-warning'">
          {{ hasPermission === null ? tr('正在检查权限', 'Checking permission') : hasPermission ? tr('权限已生效', 'Permission active') : tr('权限尚未生效', 'Permission inactive') }}
        </span>
        <Button
          :loading="busy"
          size="small"
          @click="refresh(true)"
        >
          {{ tr('重新检测', 'Check again') }}
        </Button>
        <Button
          size="small"
          @click="openPermissionSettings"
        >
          {{ tr('打开权限设置', 'Open permission settings') }}
        </Button>
      </Space>
    </ProListItem>
    <div
      class="input-diagnostics"
      role="status"
    >
      <strong>{{ statusLabel }}</strong>
      <p
        v-if="state?.error || error || subscriptionError"
        class="input-error"
      >
        {{ translateEmpireError(subscriptionError || error || state?.error || '', locale) }}
      </p>
      <p v-if="hasPermission === false">
        {{ tr('如果系统开关已经开启但仍显示未生效：在输入监控中移除旧的 BongoCat Empire 条目，再用“＋”添加“应用程序”文件夹里的 BongoCat Empire，重新开启并按系统提示重新打开应用。本地更新后的旧授权记录可能仍对应之前的版本。', 'If the macOS switch is on but permission is inactive, remove the old BongoCat Empire entry from Input Monitoring, then use “+” to add BongoCat Empire from Applications. Enable it and reopen the app when prompted. After a local update, the old permission record may still refer to the previous build.') }}
      </p>
      <p v-if="hasPermission && state?.listening && !state.keyboardEvents">
        {{ tr('请在普通文本区域按键，并移动、点击或滚动触摸板，分别观察下方事件计数。未收到键盘事件时，请先退出密码输入框再试。', 'Type in a regular text field, then move, click, and scroll the trackpad to check the counters below. If no keyboard events arrive, leave any password field and try again.') }}
      </p>
      <dl v-if="state">
        <div><dt>{{ tr('键盘事件（含抬起）', 'Keyboard events (including key-up)') }}</dt><dd>{{ state.keyboardEvents }} · {{ timeLabel(state.lastKeyboardEventAt) }}</dd></div>
        <div><dt>{{ tr('指针移动与拖动', 'Pointer movement and dragging') }}</dt><dd>{{ state.pointerEvents }} · {{ timeLabel(state.lastPointerEventAt) }}</dd></div>
        <div><dt>{{ tr('鼠标／触摸板点击事件', 'Mouse / trackpad button events') }}</dt><dd>{{ state.buttonEvents }}</dd></div>
        <div><dt>{{ tr('滚动事件', 'Scroll events') }}</dt><dd>{{ state.scrollEvents }} · {{ timeLabel(state.lastScrollEventAt) }}</dd></div>
        <div><dt>{{ tr('自动恢复／丢弃事件', 'Reconnects / dropped events') }}</dt><dd>{{ state.recoveryCount }} ／ {{ state.droppedEvents }}</dd></div>
      </dl>
      <p class="input-note">
        {{ tr('仅显示本次运行的事件总量和时间，不显示或保存按键内容。事件数量不是成长经验；触摸板反馈使用系统移动、点击和滚动，不识别三指捏合。', 'Only event totals and timestamps for this session are shown; typed content is never displayed or stored. Event totals differ from growth points. Trackpad feedback uses system movement, clicks, and scrolling; three-finger pinches are not detected.') }}
      </p>
    </div>
  </ProList>
</template>

<style scoped>
.input-diagnostics {
  margin: 0 16px 16px;
  padding: 14px 16px;
  background: var(--ant-color-fill-quaternary, #f6f7f8);
  border-radius: 10px;
  font-size: 12px;
  overflow-wrap: anywhere;
}
.input-diagnostics p {
  margin: 8px 0;
}
.input-diagnostics dl {
  display: grid;
  gap: 6px;
}
.input-diagnostics dl > div {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 6px 16px;
}
.input-diagnostics dd {
  margin: 0;
}
.input-error {
  color: #b64035;
}
.input-note {
  opacity: 0.7;
}
</style>
