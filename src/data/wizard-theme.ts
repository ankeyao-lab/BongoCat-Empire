import { defaultWeeklyThresholds } from './growth-plan'
import content from './wardrobe-content.json'
import wardrobeCopy from './wardrobe-v3-copy.json'

export const growthThemeIds = ['wizard', 'astronaut', 'pirate', 'ninja', 'hero', 'wuxia', 'baker', 'garden', 'performer', 'cultivation', 'shaolin', 'emperor'] as const
export type GrowthThemeId = typeof growthThemeIds[number]
export type OutfitThemeId = GrowthThemeId | 'none'
export interface WizardLevel {
  level: number
  threshold: number
  delta: number
  name: string
  subtitle: string
  chapter: string
  palette: string
  hat: string
  cape: string
  prop: string
  motion: string
  story: string
  color: string
  conceptImage: string
  spriteImage: string
  designSlots?: Record<string, string>
}
export interface GrowthTheme {
  id: GrowthThemeId
  name: string
  title: string
  levels: readonly WizardLevel[]
  defaultThresholds: number[]
}
export const growthThemeRegistry = (() => {
  const registry = {} as Record<GrowthThemeId, GrowthTheme>
  for (const id of growthThemeIds) {
    const theme = content.find(item => item.id === id)
    if (!theme || theme.levels.length !== 9) throw new Error(`主题 ${id} 的素材目录不完整`)
    const copy = wardrobeCopy[id]
    if (copy.length !== 9 || copy.some((item, index) => item.level !== index + 1)) throw new Error(`主题 ${id} 的配饰说明不完整`)
    registry[id] = {
      ...theme,
      id,
      defaultThresholds: [...defaultWeeklyThresholds],
      levels: theme.levels.map((level, index) => ({
        ...level,
        ...copy[index],
        designSlots: undefined,
        threshold: defaultWeeklyThresholds[index],
        delta: index ? defaultWeeklyThresholds[index] - defaultWeeklyThresholds[index - 1] : 0,
      })),
    }
  }
  return registry
})()
export const wizardTheme = growthThemeRegistry.wizard
export const wizardLevels = wizardTheme.levels
export const outfitThemeOptions: readonly { id: OutfitThemeId, name: string, description: string }[] = [
  { id: 'none', name: '原始外观', description: '脱下装扮，培养和输入照常继续。' },
  ...Object.values(growthThemeRegistry).map(theme => ({ id: theme.id, name: theme.name, description: '九级收藏 · 适用于所有交互模式' })),
]
export function validateThresholds(thresholds: readonly number[]): string | null {
  if (thresholds.length !== 9) return '需要完整的九级累计门槛。'
  if (thresholds[0] !== 0) return 'LV1 门槛固定为 0。'
  for (let index = 0; index < thresholds.length; index += 1) {
    const value = thresholds[index]
    if (!Number.isSafeInteger(value) || value < 0) return `LV${index + 1} 必须是安全范围内的非负整数。`
    if (index > 0 && value <= thresholds[index - 1]) return `LV${index + 1} 必须大于 LV${index} 的累计门槛。`
  }
  return null
}
export function levelAtPresses(presses: number, thresholds: readonly number[]): number {
  return Math.max(1, thresholds.filter(threshold => threshold <= presses).length)
}
