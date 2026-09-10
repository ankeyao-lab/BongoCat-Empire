import manifest from './interaction-paws.json'

export interface InteractionPaw {
  pawSrc: string
  surfaceSrc: string
  anchorY: number
  contactY: number
}

const entries: Record<string, InteractionPaw> = manifest

export function getInteractionPaw(src: string): InteractionPaw | undefined {
  const key = src.replace('/interaction/', '').replace('-keys/', '/').replace(/\.png$/, '')
  return entries[key]
}
