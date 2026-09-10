<script setup lang="ts">
import { Divider, Flex, InputNumber, Slider, SpaceAddon, SpaceCompact, Switch } from 'antdv-next'

import type { InteractionMode } from '@/stores/cat'

import ProListItem from '@/components/pro-list-item/index.vue'
import ProList from '@/components/pro-list/index.vue'
import { useEmpireLocale } from '@/locales/empire'
import { useCatStore } from '@/stores/cat'
import { isWindows } from '@/utils/platform'

const { tr } = useEmpireLocale()

const catStore = useCatStore()
</script>

<template>
  <ProList :title="tr('交互模式', 'Interaction mode')">
    <ProListItem
      :description="tr('只切换输入设备和动作。装扮系列、等级和升级规则在衣橱中独立管理。', 'Choose an input device and its gestures. Outfits, levels, and growth rules are managed separately in the wardrobe.')"
      :title="tr('输入设备', 'Input device')"
    >
      <select
        :aria-label="tr('交互模式', 'Interaction mode')"
        class="border-gray-300 border-solid px-3 py-2 border rounded-md"
        :value="catStore.model.interactionMode"
        @change="catStore.setInteractionMode(($event.target as HTMLSelectElement).value as InteractionMode)"
      >
        <option value="standard">
          {{ tr('键盘＋鼠标', 'Keyboard + mouse') }}
        </option>
        <option value="keyboard">
          {{ tr('双手键盘', 'Two-hand keyboard') }}
        </option>
        <option value="gamepad">
          {{ tr('手柄', 'Gamepad') }}
        </option>
        <option value="trackpad">
          {{ tr('键盘＋触摸板', 'Keyboard + trackpad') }}
        </option>
      </select>
    </ProListItem>
  </ProList>
  <ProList :title="$t('pages.preference.cat.labels.modelSettings')">
    <ProListItem
      :description="$t('pages.preference.cat.hints.mirrorMode')"
      :title="$t('pages.preference.cat.labels.mirrorMode')"
    >
      <Switch v-model:checked="catStore.model.mirror" />
    </ProListItem>

    <ProListItem
      :description="catStore.model.interactionMode === 'trackpad' ? tr('触摸板默认镜像跟随；开启此项可反转默认方向', 'The trackpad follows a mirrored direction by default. Turn this on to reverse it.') : tr('反转鼠标的横向跟随方向', 'Reverse horizontal mouse tracking.')"
      :title="tr('指针方向镜像', 'Mirror pointer direction')"
    >
      <Switch v-model:checked="catStore.model.mouseMirror" />
    </ProListItem>

    <ProListItem
      :description="tr('暂停鼠标和触摸板联动，键盘按键映射保持不变', 'Pause mouse and trackpad tracking while keeping keyboard mappings active.')"
      :title="tr('忽略指针输入', 'Ignore pointer input')"
    >
      <Switch v-model:checked="catStore.model.ignoreMouse" />
    </ProListItem>

    <ProListItem
      :description="$t('pages.preference.cat.hints.motionSound')"
      :title="$t('pages.preference.cat.labels.motionSound')"
    >
      <Switch v-model:checked="catStore.model.motionSound" />
    </ProListItem>

    <ProListItem
      :description="$t('pages.preference.cat.hints.behavior')"
      :title="$t('pages.preference.cat.labels.behavior')"
    >
      <Switch v-model:checked="catStore.model.behavior" />
    </ProListItem>

    <ProListItem
      v-if="isWindows"
      :description="$t('pages.preference.cat.hints.autoReleaseDelay')"
      :title="$t('pages.preference.cat.labels.autoReleaseDelay')"
    >
      <SpaceCompact>
        <InputNumber
          v-model:value="catStore.model.autoReleaseDelay"
          class="w-20"
        />

        <SpaceAddon>s</SpaceAddon>
      </SpaceCompact>
    </ProListItem>

    <ProListItem
      :description="tr('限制鼠标或触摸板跟随的刷新频率，0 为不限；按键映射和成长计数不受影响。Live2D 模型同时限制渲染帧率。', 'Limit mouse and trackpad updates; 0 means unlimited. Key mappings and growth counts stay active. This also limits the rendering frame rate of Live2D models.')"
      :title="tr('指针刷新上限', 'Pointer update limit')"
    >
      <InputNumber
        v-model:value="catStore.model.maxFPS"
        class="w-20"
        :min="0"
      />
    </ProListItem>
  </ProList>

  <ProList :title="$t('pages.preference.cat.labels.windowSettings')">
    <ProListItem
      :description="$t('pages.preference.cat.hints.passThrough')"
      :title="$t('pages.preference.cat.labels.passThrough')"
    >
      <Switch v-model:checked="catStore.window.passThrough" />
    </ProListItem>

    <ProListItem
      :description="$t('pages.preference.cat.hints.alwaysOnTop')"
      :title="$t('pages.preference.cat.labels.alwaysOnTop')"
    >
      <Switch v-model:checked="catStore.window.alwaysOnTop" />
    </ProListItem>

    <ProListItem
      :description="$t('pages.preference.cat.hints.hideOnHover')"
      :title="$t('pages.preference.cat.labels.hideOnHover')"
    >
      <Flex align="center">
        <Switch v-model:checked="catStore.window.hideOnHover" />

        <Flex
          align="center"
          class="overflow-hidden transition-all"
          :class="[catStore.window.hideOnHover ? 'w-28 opacity-100' : 'w-0 opacity-0']"
        >
          <Divider type="vertical" />

          <SpaceCompact>
            <InputNumber
              v-model:value="catStore.window.hideOnHoverDelay"
              class="w-16"
              :min="0"
            />

            <SpaceAddon>s</SpaceAddon>
          </SpaceCompact>
        </Flex>
      </Flex>
    </ProListItem>

    <ProListItem
      :description="$t('pages.preference.cat.hints.keepInScreen')"
      :title="$t('pages.preference.cat.labels.keepInScreen')"
    >
      <Switch v-model:checked="catStore.window.keepInScreen" />
    </ProListItem>

    <ProListItem
      :description="$t('pages.preference.cat.hints.windowSize')"
      :title="$t('pages.preference.cat.labels.windowSize')"
    >
      <SpaceCompact>
        <InputNumber
          v-model:value="catStore.window.scale"
          class="w-20"
          :max="500"
          :min="1"
        />

        <SpaceAddon>%</SpaceAddon>
      </SpaceCompact>
    </ProListItem>

    <ProListItem :title="$t('pages.preference.cat.labels.windowRadius')">
      <SpaceCompact>
        <InputNumber
          v-model:value="catStore.window.radius"
          class="w-20"
          :min="0"
        />

        <SpaceAddon>%</SpaceAddon>
      </SpaceCompact>
    </ProListItem>

    <ProListItem
      :title="$t('pages.preference.cat.labels.opacity')"
      vertical
    >
      <Slider
        v-model:value="catStore.window.opacity"
        class="m-0!"
        :max="100"
        :min="10"
        :tooltip="{
          formatter(value) {
            return `${value}%`
          },
        }"
      />
    </ProListItem>
  </ProList>
</template>
