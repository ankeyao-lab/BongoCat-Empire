import type { InteractionMode } from '@/composables/useWizardInput'

/** Prototype material progression. The original key geometry/ink is shared, never recolored. */
export interface DeviceSkinLevel {
  level: number
  name: string
  shellFilter: string
  keycapFilter: string
  crystalFilter: string
  metalFilter: string
  materials?: Partial<DeviceSkinMaterials>
}

export interface DeviceSkinMaterials {
  shell: string
  keycaps: string
  touch: string
  edge: string
}

export interface DeviceSkin extends DeviceSkinLevel {
  themeId: string
  materials: DeviceSkinMaterials
}

export const wizardDeviceSkinLevels: readonly DeviceSkinLevel[] = [
  { level: 1, name: '学徒木台', shellFilter: 'sepia(1) saturate(.55) brightness(2.1)', keycapFilter: 'none', crystalFilter: 'saturate(.3) brightness(1.14)', metalFilter: 'saturate(.45) brightness(.97)' },
  { level: 2, name: '星点书桌', shellFilter: 'sepia(.7) saturate(.8) brightness(1.55)', keycapFilter: 'none', crystalFilter: 'saturate(.6) brightness(1.1)', metalFilter: 'saturate(.7)' },
  { level: 3, name: '月纹魔台', shellFilter: 'saturate(.7) brightness(1.35)', keycapFilter: 'sepia(.12)', crystalFilter: 'saturate(.75) brightness(1.05)', metalFilter: 'none' },
  { level: 4, name: '梅紫工坊', shellFilter: 'hue-rotate(12deg) saturate(.8) brightness(1.12)', keycapFilter: 'none', crystalFilter: 'hue-rotate(8deg) saturate(.85)', metalFilter: 'saturate(.9)' },
  { level: 5, name: '紫金法台', shellFilter: 'none', keycapFilter: 'none', crystalFilter: 'none', metalFilter: 'none' },
  { level: 6, name: '靛紫秘台', shellFilter: 'hue-rotate(-18deg) saturate(.95) brightness(.9)', keycapFilter: 'saturate(.7)', crystalFilter: 'hue-rotate(-12deg) saturate(.8)', metalFilter: 'saturate(.8) brightness(1.04)' },
  { level: 7, name: '星云研台', shellFilter: 'hue-rotate(-35deg) saturate(.85) brightness(.94)', keycapFilter: 'saturate(.2)', crystalFilter: 'hue-rotate(-24deg) saturate(.75)', metalFilter: 'saturate(.35) brightness(1.12)' },
  { level: 8, name: '紫晶法座', shellFilter: 'hue-rotate(-6deg) saturate(1.15) brightness(1.05)', keycapFilter: 'saturate(.5) brightness(1.03)', crystalFilter: 'saturate(.85) brightness(1.12)', metalFilter: 'saturate(.8) brightness(1.1)' },
  { level: 9, name: '白金宗师台', shellFilter: 'sepia(.9) saturate(.35) brightness(3)', keycapFilter: 'saturate(.45) brightness(1.02)', crystalFilter: 'saturate(.62) brightness(1.15)', metalFilter: 'saturate(.65) brightness(1.15)' },
]

/** Three real material stages: bamboo edges, copper edging, then a copper case. */
export const shaolinDeviceSkinLevels: readonly DeviceSkinLevel[] = [
  { level: 1, name: '竹木初练台', shellFilter: 'saturate(.72) brightness(1.12)', keycapFilter: 'none', crystalFilter: 'brightness(1.08)', metalFilter: 'saturate(.65) brightness(1.12)', materials: { edge: 'bamboo' } },
  { level: 2, name: '温竹习武台', shellFilter: 'saturate(.85) brightness(1.06)', keycapFilter: 'none', crystalFilter: 'brightness(1.04)', metalFilter: 'saturate(.8) brightness(1.06)', materials: { edge: 'bamboo' } },
  { level: 3, name: '禅石练功台', shellFilter: 'none', keycapFilter: 'sepia(.05)', crystalFilter: 'none', metalFilter: 'none', materials: { edge: 'bamboo' } },
  { level: 4, name: '铜包竹案', shellFilter: 'saturate(.88) brightness(.95)', keycapFilter: 'sepia(.08)', crystalFilter: 'sepia(.05)', metalFilter: 'saturate(.65) brightness(1.1)' },
  { level: 5, name: '少林练功案', shellFilter: 'none', keycapFilter: 'none', crystalFilter: 'none', metalFilter: 'none' },
  { level: 6, name: '教头禅石案', shellFilter: 'saturate(.9) brightness(.9)', keycapFilter: 'sepia(.08)', crystalFilter: 'sepia(.08) brightness(1.04)', metalFilter: 'saturate(.95) brightness(.93)' },
  { level: 7, name: '赤铜护法台', shellFilter: 'saturate(.82) brightness(.95)', keycapFilter: 'sepia(.08)', crystalFilter: 'sepia(.07) brightness(1.05)', metalFilter: 'saturate(.82) brightness(1.05)', materials: { shell: 'copper' } },
  { level: 8, name: '铜石禅院台', shellFilter: 'saturate(.95) brightness(.87)', keycapFilter: 'sepia(.12)', crystalFilter: 'sepia(.1) brightness(1.08)', metalFilter: 'saturate(.72) brightness(1.14)', materials: { shell: 'copper' } },
  { level: 9, name: '宗师铜禅台', shellFilter: 'saturate(.92) brightness(.8)', keycapFilter: 'sepia(.12) brightness(1.02)', crystalFilter: 'sepia(.1) brightness(1.12)', metalFilter: 'saturate(.65) brightness(1.24)', materials: { shell: 'copper' } },
]

const skinThemes: Record<string, { levels: readonly DeviceSkinLevel[], materials: DeviceSkinMaterials }> = {
  wizard: { levels: wizardDeviceSkinLevels, materials: { shell: 'wood', keycaps: 'ivory', touch: 'crystal', edge: 'gold' } },
  shaolin: { levels: shaolinDeviceSkinLevels, materials: { shell: 'bamboo', keycaps: 'linen', touch: 'stone', edge: 'copper' } },
}

// New themes share device geometry and input ink, with their own four painted
// material sheets. Progression changes the finish gently, keeping labels clear.
const fullSurfaceThemes: Record<string, string> = {
  astronaut: '宇航舱台',
  pirate: '航海木案',
  ninja: '忍者漆台',
  hero: '英雄工作台',
  wuxia: '竹玉武侠案',
  baker: '奶油烘焙台',
  garden: '叶纹花园台',
  performer: '丝绒舞台',
  cultivation: '白玉云台',
  emperor: '云锦御案',
}
for (const [themeId, name] of Object.entries(fullSurfaceThemes)) {
  skinThemes[themeId] = {
    materials: { shell: 'shell', keycaps: 'keys', touch: 'touch', edge: 'edge' },
    levels: Array.from({ length: 9 }, (_, index) => ({
      level: index + 1,
      name: `${name} · ${index + 1}`,
      shellFilter: `saturate(${0.72 + index * 0.045}) brightness(${1.16 - index * 0.0275})`,
      keycapFilter: 'none',
      crystalFilter: `saturate(${0.72 + index * 0.025}) brightness(${1.08 - index * 0.008})`,
      metalFilter: `saturate(${0.68 + index * 0.04}) brightness(${0.94 + index * 0.025})`,
    })),
  }
}

export function hasDeviceSkin(themeId: string, mode: InteractionMode): boolean {
  return Object.prototype.hasOwnProperty.call(skinThemes, themeId) && mode !== 'gamepad'
}

export function getDeviceSkin(themeId: string, level: number): DeviceSkin | undefined {
  if (!Object.prototype.hasOwnProperty.call(skinThemes, themeId)) return undefined
  const theme = skinThemes[themeId]!
  const index = Number.isFinite(level) ? Math.min(8, Math.max(0, Math.round(level) - 1)) : 0
  const selected = theme.levels[index]!
  return { ...selected, themeId, materials: { ...theme.materials, ...selected.materials } }
}

export const DEVICE_SKIN_ROOT = '/device-skins/v1'
