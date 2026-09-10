import type { SleeveArmConfig, SleevePoint } from './sleeve-arm'

import manifest from './scene-v6-manifest.json'

export interface SceneV6 {
  level: number
  src: string
  width: number
  height: number
  transform?: string
  frameScale?: number
  roots: { pointer: SleevePoint, keyboard: SleevePoint }
  cuffFront?: string
  cuffs?: { pointer?: Partial<SleeveArmConfig['cuff']>, keyboard?: Partial<SleeveArmConfig['cuff']> }
  eyesUnderlay?: { x: number, y: number, rx: number, ry: number, fill?: string }[]
  sourceSHA256?: string
}
export const sceneV6Themes = manifest.themes as Record<string, SceneV6[]>
export function getSceneV6(themeId: string, level: number): SceneV6 | undefined {
  return sceneV6Themes[themeId]?.find(scene => scene.level === level)
}
