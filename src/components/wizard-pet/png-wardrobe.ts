import manifest from './wardrobe-manifest.json'

export interface PngPiece {
  src: string
  rect: [number, number, number, number]
  fit: string
  rotation?: [number, number, number]
  sha256: string
}

export interface PngOutfit {
  level: number
  gag: string
  hat: PngPiece | null
  cape: PngPiece | null
  prop: PngPiece | null
  robe: PngPiece | null
}

const themes = manifest.themes as unknown as Record<string, { levels: PngOutfit[] }>

export function getPngOutfit(theme: string, level: number): PngOutfit | null {
  return themes[theme]?.levels.find(outfit => outfit.level === level) ?? null
}
