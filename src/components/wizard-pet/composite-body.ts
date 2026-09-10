import manifest from './composite-body-manifest.json'

export interface CompositeBody {
  level: number
  src: string
  faceMask: string
  width: number
  height: number
  transform: string
  frameScale?: number
  restPawY?: number
}

export const compositeBodyThemes = manifest.themes as Record<string, CompositeBody[]>

// Each entry is a complete dressed Bongo body. Hands and the original eye atlas
// remain live layers, and the transform preserves the source proportions.
export function getCompositeBody(themeId: string, level: number): CompositeBody | undefined {
  return compositeBodyThemes[themeId]?.find(body => body.level === level)
}
