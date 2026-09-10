/** The approved three material stages: levels 1–3, 4–6 and 7–9. */
export interface ThemeSurface {
  kind: 'wood' | 'panel' | 'fabric' | 'bamboo' | 'stone' | 'silk'
  desk: [string, string, string]
  rim: [string, string, string]
  shell: string
  key: string
  pad: string
  ink: string
  motif: string
}

export const themeSurfaces: Record<string, ThemeSurface> = {
  wizard: { kind: 'wood', desk: ['#dca66d', '#b77b49', '#94633e'], rim: ['#b7804e', '#a47645', '#c5a260'], shell: '#a37751', key: '#fff1d4', pad: '#cdb5e5', ink: '#775438', motif: 'crescent' },
  astronaut: { kind: 'panel', desk: ['#eeede7', '#e6e9e9', '#dce1e3'], rim: ['#bdc6cc', '#aebdc8', '#9fadb5'], shell: '#dbe2e6', key: '#fcfaf0', pad: '#c1d5df', ink: '#93a3ad', motif: 'hatch' },
  pirate: { kind: 'wood', desk: ['#dfb780', '#cda367', '#dec195'], rim: ['#b88c59', '#ad7d42', '#b89d62'], shell: '#b88a54', key: '#fff0d0', pad: '#e1c498', ink: '#947343', motif: 'map' },
  ninja: { kind: 'fabric', desk: ['#dedbe6', '#bbb4cb', '#c7c0d1'], rim: ['#77738f', '#66607e', '#9996a7'], shell: '#78718f', key: '#f5f0ef', pad: '#beb1d0', ink: '#8c839b', motif: 'leaf' },
  hero: { kind: 'panel', desk: ['#dce4e9', '#dce0e3', '#eeece2'], rim: ['#7795b2', '#aa6d70', '#c7aa6a'], shell: '#7295af', key: '#fff3dc', pad: '#b8ceda', ink: '#99a8ad', motif: 'tape' },
  wuxia: { kind: 'bamboo', desk: ['#e1c28b', '#d6b981', '#e4d0a3'], rim: ['#b09360', '#98a37b', '#b6c3a0'], shell: '#bba477', key: '#fff2d5', pad: '#c9d4ae', ink: '#a18f60', motif: 'chopstick' },
  baker: { kind: 'wood', desk: ['#f2dec3', '#f3e2ce', '#f7e8d3'], rim: ['#ddb29e', '#d9969c', '#e7b6a7'], shell: '#e8b6b5', key: '#fff2d4', pad: '#f1cbd2', ink: '#c6a68b', motif: 'biscuit' },
  garden: { kind: 'wood', desk: ['#dcd1ac', '#d6c69c', '#c4cbb0'], rim: ['#a9a278', '#9bac7d', '#a6b48e'], shell: '#b9c799', key: '#fbf1d9', pad: '#d4dbb6', ink: '#a8a079', motif: 'seed' },
  performer: { kind: 'fabric', desk: ['#dfc5c1', '#e2cccd', '#eee6d7'], rim: ['#b9959d', '#915466', '#b19a68'], shell: '#a7697d', key: '#fff0d6', pad: '#dab6bf', ink: '#b8959d', motif: 'button' },
  cultivation: { kind: 'stone', desk: ['#e8eee5', '#d4e6dc', '#edf0e8'], rim: ['#c5d8c9', '#accdbd', '#c1cccc'], shell: '#bfd8c8', key: '#f9f7e8', pad: '#d5e4d4', ink: '#abc4b4', motif: 'cloud' },
  shaolin: { kind: 'bamboo', desk: ['#d4bd8e', '#bbb8a9', '#b7b6a9'], rim: ['#ae9261', '#ae8f61', '#a2835d'], shell: '#bd9a61', key: '#f5e9ce', pad: '#c1c0b4', ink: '#a3997e', motif: 'sweep' },
  emperor: { kind: 'silk', desk: ['#ebd7b8', '#eee1c9', '#eedcc0'], rim: ['#bd9b73', '#b36d59', '#c3a363'], shell: '#bd7962', key: '#fcf0d6', pad: '#d0e1cf', ink: '#c8af8d', motif: 'seal' },
}

export function surfaceTier(level: number): 0 | 1 | 2 {
  return Math.min(2, Math.max(0, Math.floor(((Number.isFinite(level) ? level : 1) - 1) / 3))) as 0 | 1 | 2
}

export function themeSurface(themeId: string): ThemeSurface {
  return themeSurfaces[themeId] ?? themeSurfaces.wizard!
}
