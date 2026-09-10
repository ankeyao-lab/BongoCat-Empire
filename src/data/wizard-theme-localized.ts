import type { GrowthTheme, GrowthThemeId, OutfitThemeId, WizardLevel } from './wizard-theme'

import englishCopy from './wardrobe-copy.en.json'
import { growthThemeIds, growthThemeRegistry, outfitThemeOptions } from './wizard-theme'

const levelCopyFields = ['name', 'subtitle', 'chapter', 'hat', 'cape', 'prop', 'motion', 'story'] as const
type LevelCopy = Pick<WizardLevel, typeof levelCopyFields[number]> & { level: number }
interface ThemeCopy {
  name: string
  title: string
  levels: LevelCopy[]
}

const translations: Record<GrowthThemeId, ThemeCopy> = englishCopy
const englishRegistry = {} as Record<GrowthThemeId, GrowthTheme>

for (const id of growthThemeIds) {
  const original = growthThemeRegistry[id]
  const copy = translations[id]
  if (copy.levels.length !== original.levels.length
    || copy.levels.some((level, index) => level.level !== original.levels[index].level)) {
    throw new Error(`Incomplete English wardrobe copy for ${id}`)
  }
  englishRegistry[id] = {
    ...original,
    name: copy.name,
    title: copy.title,
    levels: original.levels.map((level, index) => {
      const translated = { ...level }
      // Copy only user-facing prose. Thresholds, colors, asset paths and IDs
      // continue to come from the canonical registry.
      for (const field of levelCopyFields) translated[field] = copy.levels[index][field]
      return translated
    }),
  }
}

const englishOutfitOptions: readonly { id: OutfitThemeId, name: string, description: string }[] = [
  {
    id: 'none',
    name: 'Original appearance',
    description: 'Remove the outfit while growth and input continue as usual.',
  },
  ...growthThemeIds.map(id => ({
    id,
    name: englishRegistry[id].name,
    description: 'Nine collectible levels · Available in every interaction mode',
  })),
]

function isChinese(locale: string): boolean {
  return locale.toLowerCase().startsWith('zh')
}

export function getLocalizedGrowthThemeRegistry(locale: string): Record<GrowthThemeId, GrowthTheme> {
  return isChinese(locale) ? growthThemeRegistry : englishRegistry
}

export function getLocalizedOutfitThemeOptions(locale: string): readonly { id: OutfitThemeId, name: string, description: string }[] {
  return isChinese(locale) ? outfitThemeOptions : englishOutfitOptions
}
