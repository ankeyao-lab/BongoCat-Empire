import { renderStoryArt } from './playful-story-art'

/** Original-cat wardrobe. All paths are clothing/objects; no cat bitmap is drawn here. */
export const playfulThemes = [
  { id: 'wizard', name: '魔法师', colors: ['#8e63d9', '#ffe168', '#a8e7d4', '#ee7168'] },
  { id: 'astronaut', name: '宇航员', colors: ['#4b85e8', '#ff9b45', '#dcefff', '#485972'] },
  { id: 'pirate', name: '海盗', colors: ['#238a92', '#ef775c', '#fff0cd', '#a77b44'] },
  { id: 'ninja', name: '忍者', colors: ['#454673', '#7bd5c9', '#f4b987', '#ad9bdd'] },
  { id: 'hero', name: '超级英雄', colors: ['#f2645c', '#447bc4', '#ffe277', '#fff0db'] },
  { id: 'wuxia', name: '武侠', colors: ['#4b9c78', '#dfecbb', '#ef9a57', '#45584d'] },
  { id: 'baker', name: '烘焙师', colors: ['#ee91a3', '#fff0c8', '#865949', '#92cfb2'] },
  { id: 'garden', name: '花园园丁', colors: ['#71a95c', '#f6d567', '#eea4ba', '#b88461'] },
  { id: 'performer', name: '舞台表演家', colors: ['#d46ba8', '#74ccd3', '#ffe26d', '#535068'] },
  { id: 'cultivation', name: '修仙', colors: ['#a3d8cb', '#b8ace8', '#f3ba98', '#fff6de'] },
  { id: 'shaolin', name: '少林', colors: ['#dca14a', '#8c9291', '#c87954', '#efe4ce'] },
  { id: 'emperor', name: '称帝', colors: ['#d86150', '#4d4a50', '#edbd56', '#85b8a0'] },
] as const
export type PlayfulThemeId = (typeof playfulThemes)[number]['id']
export interface PlayfulArt { head: string, back: string, robe: string, desk: string }
type Palette = readonly string[]
const ink = '#28232e'
const p = (d: string, fill: string, w = 5.5) => `<path d="${d}" fill="${fill}" stroke="${ink}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"/>`
const line = (d: string, color = ink, w = 5) => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"/>`
const ellipse = (x: number, y: number, rx: number, ry: number, fill: string, w = 5) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${ink}" stroke-width="${w}"/>`
const circle = (x: number, y: number, r: number, fill: string, w = 5) => ellipse(x, y, r, r, fill, w)
const rect = (x: number, y: number, w: number, h: number, r: number, fill: string) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${ink}" stroke-width="5"/>`
const g = (x: number, y: number, s: number, r: number, art: string) => `<g transform="translate(${x} ${y}) rotate(${r}) scale(${s})">${art}</g>`
function star(x: number, y: number, r: number, fill: string) {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = i * Math.PI / 5 - Math.PI / 2
    const q = i % 2 ? r * 0.49 : r
    return `${x + Math.cos(a) * q},${y + Math.sin(a) * q}`
  }).join(' ')
  return `<polygon points="${pts}" fill="${fill}" stroke="${ink}" stroke-width="4" stroke-linejoin="round"/>`
}
const fish = (c: Palette) => p('M-29 0 Q-5 -30 25 -7 L40 -23 L39 23 L25 8 Q-8 32 -29 0Z', c[2]) + circle(-12, -3, 3, ink, 0) + line('M7 -13 Q-2 0 7 13', c[0], 3)
const toast = (c: Palette) => p('M-28 25 L-27 -7 Q-44 -22 -26 -32 Q0 -45 26 -29 Q40 -21 27 -6 L27 25 Q0 35 -28 25Z', c[1]) + p('M-17 18 L-17 -9 Q0 -23 17 -9 L17 18Z', '#fff4d6', 3)
const egg = () => p('M-28 7 Q-43 -8 -26 -23 Q-10 -34 0 -25 Q25 -40 32 -19 Q44 0 25 18 Q8 27 -12 22 Q-34 28 -28 7Z', '#fff9e8') + ellipse(4, -1, 13, 12, '#ffd755', 3)
const cloud = (c: Palette) => p('M-44 8 Q-60 -10 -35 -21 Q-31 -50 -3 -35 Q22 -55 35 -28 Q62 -25 49 3 Q44 20 20 17 L-22 18 Q-41 20 -44 8Z', c[2])
const book = (c: Palette) => p('M-40 -23 Q-15 -32 0 -14 Q20 -34 43 -23 L40 31 Q18 20 0 35 Q-21 17 -39 29Z', c[1]) + line('M0 -13 L0 34', c[0], 4) + line('M-29 -7 L-10 -4 M12 -6 L30 -11 M-29 8 L-12 12 M13 9 L29 5', ink, 3)
const rice = () => p('M-33 22 Q-34 7 -8 -29 Q0 -40 13 -27 Q35 4 35 22 Q0 39 -33 22Z', '#fff9e9') + p('M-13 9 L15 9 L16 31 L-13 31Z', '#445246', 3)
const bowl = (c: Palette) => p('M-39 -5 Q-29 35 0 36 Q32 35 41 -5Z', c[0]) + ellipse(0, -5, 40, 11, c[3]) + line('M-15 -10 Q-29 -31 -13 -43 M9 -10 Q-3 -32 11 -40', c[3], 4)
const patch = (c: Palette) => p('M-15 -13 L17 -11 L13 16 L-18 12Z', c[2], 3) + line('M-19 -7 L-10 -6 M-20 5 L-10 6 M6 -16 L5 -7 M16 4 L23 5 M3 10 L2 20', ink, 2.5)
const bell = (c: Palette) => p('M-17 15 Q-17 -17 0 -21 Q19 -15 18 15 L27 22 L-26 22Z', c[1]) + circle(0, 25, 5, c[3], 3)
const lotus = (c: Palette) => p('M0 15 Q-33 18 -41 -12 Q-19 -13 0 15Z', c[1]) + p('M0 15 Q32 17 42 -14 Q19 -14 0 15Z', c[1]) + p('M0 15 Q-24 -10 0 -40 Q26 -10 0 15Z', c[2])
const leaf = (c: Palette) => p('M0 25 Q-42 -7 -21 -37 Q13 -34 0 25Z', c[0]) + line('M0 20 L-14 -25', c[2], 3)
const hatPose = (art: string, level: number, tilt = 12) => g(364, 238, 0.86 + level * 0.012, tilt, art)
function scarf(c: Palette, l: number, kind = 0) {
  const shapes = [
    'M217 340 Q240 328 261 341 Q291 365 320 352 Q350 344 381 366 Q405 378 394 397 Q376 414 348 397 Q319 409 289 391 Q261 397 237 378 Q216 380 217 358Z',
    'M218 337 Q244 331 262 349 Q282 370 305 356 Q323 346 349 355 Q375 352 393 376 Q407 401 378 406 Q362 409 344 393 Q316 410 295 393 Q270 397 252 379 Q220 383 218 361Z',
    'M219 342 Q241 322 265 345 Q285 364 305 354 Q328 341 348 357 Q373 351 395 380 Q399 409 373 405 Q355 420 328 397 Q302 409 280 390 Q258 398 240 378 Q217 376 219 342Z',
  ]
  let art = p(shapes[kind % 3], c[0])
    + line('M245 348 Q270 372 292 368 M310 369 Q340 363 367 382', c[2], 5)
  if (l >= 2) art += g(309, 372, 0.65, -9, l % 3 === 0 ? patch(c) : circle(0, 0, 14, c[1], 4))
  if (l >= 4) art += p('M492 298 Q518 292 528 322 Q552 323 554 350 Q578 369 554 390 Q555 421 530 414 Q511 392 507 366 Q488 344 492 298Z', c[0])
  if (l >= 6) art += line('M511 328 Q536 352 531 378 M542 364 Q550 386 540 399', c[2], 4)
  if (l >= 8) art += g(534, 379, 0.57, -17, patch(c))
  return art
}
function cloak(c: Palette, l: number) {
  if (l < 3) return ''
  return p('M479 282 Q497 261 523 281 Q551 278 561 310 Q586 315 583 344 Q612 366 590 386 Q592 413 565 410 Q550 435 529 414 Q516 393 507 369Z', c[0])
    + line('M520 306 Q539 327 537 346 M557 339 Q574 355 564 380 M539 367 Q552 386 545 407', c[2], 4)
    + (l >= 6 ? p('M528 287 Q550 281 568 302 Q585 309 579 327 Q558 322 549 309 Q536 310 528 287Z', c[3]) : '')
}
function wizard(l: number, c: Palette): PlayfulArt {
  const caps = [
    'M-91 8 Q-76 -33 -41 -52 Q-26 -70 -50 -79 Q-70 -71 -72 -48 Q-99 -52 -102 -75 Q-97 -115 -55 -124 Q3 -138 44 -97 Q58 -73 58 -45 Q82 -21 97 10Z',
    'M-95 9 Q-80 -44 -47 -63 Q-32 -85 -63 -90 L-77 -68 Q-105 -71 -102 -96 Q-86 -134 -46 -143 Q21 -151 58 -113 Q67 -77 64 -50 Q89 -17 101 10Z',
    'M-98 9 Q-83 -40 -48 -66 Q-26 -92 -51 -101 Q-82 -101 -82 -74 Q-111 -76 -112 -103 Q-99 -145 -53 -153 Q11 -164 57 -126 Q76 -89 71 -54 Q89 -29 103 9Z',
    'M-101 10 Q-90 -34 -58 -63 Q-31 -94 -60 -102 Q-80 -92 -93 -77 Q-119 -91 -112 -113 Q-90 -148 -40 -155 Q23 -161 67 -116 Q76 -91 69 -69 Q94 -42 106 10Z',
    'M-101 10 Q-85 -32 -49 -56 Q-25 -83 -50 -95 Q-74 -99 -87 -67 Q-115 -70 -119 -93 Q-115 -134 -77 -153 Q-29 -176 27 -154 Q72 -145 76 -105 Q76 -63 95 -27 L111 13Z',
    'M-104 10 Q-85 -45 -50 -70 Q-30 -100 -65 -110 Q-84 -106 -90 -78 Q-119 -82 -123 -108 Q-103 -159 -52 -168 Q20 -177 64 -142 Q86 -111 78 -78 Q98 -41 111 12Z',
    'M-106 10 Q-84 -42 -49 -70 Q-31 -103 -67 -109 Q-85 -96 -101 -86 Q-122 -100 -116 -124 Q-86 -166 -27 -164 Q47 -175 76 -132 Q91 -93 83 -69 Q103 -40 114 12Z',
    'M-109 9 Q-91 -43 -53 -73 Q-32 -108 -72 -119 Q-98 -103 -104 -81 Q-132 -88 -131 -119 Q-102 -170 -46 -178 Q16 -190 71 -153 Q92 -126 84 -95 Q113 -66 119 13Z',
    'M-112 11 Q-95 -43 -58 -78 Q-37 -111 -76 -120 Q-102 -106 -111 -79 Q-136 -84 -139 -118 Q-114 -163 -61 -178 Q4 -198 58 -165 Q99 -144 94 -100 Q118 -62 120 14Z',
  ]
  let head = p(caps[l - 1], c[0])
    + p('M-127 4 Q-99 -18 -64 -8 Q-28 -25 11 -6 Q45 -17 79 3 Q107 -2 129 15 Q133 34 103 37 Q80 54 48 35 Q15 46 -15 32 Q-49 45 -72 30 Q-104 37 -127 17Z', c[0])
    + line('M-79 -9 Q-45 -17 -13 -6 Q21 -13 71 9', c[1], 10)
    + line('M-62 -48 Q-42 -60 -43 -80 M-26 -111 Q-1 -102 -2 -69 M35 -96 Q49 -73 45 -45', '#604291', 3)
  head += line(`M${-78 - l * 4} ${-65 - l} L${-83 - l * 4} ${-40 - l}`, c[1], 3)
    + star(-84 - l * 4, -28 - l, l >= 6 ? 17 : 14, c[1])
  head += g(-31, -43, 0.72, -18, l === 1 ? patch(c) : star(0, 0, 16, c[1]))
  if (l >= 3) head += g(27, -58, 0.7, 18, l >= 7 ? egg() : star(0, 0, 13, c[2]))
  if (l >= 5) head += g(53, -70, 0.69, 16, toast(c))
  if (l === 9) head += g(59, -138, 0.55, 29, bell(c))
  const props = [star(0, 0, 28, c[1]), egg(), fish(c), bowl(c), book(c), cloud(c) + g(5, -5, 0.65, 0, egg()), book(c) + g(23, -22, 0.6, -20, toast(c)), bowl(c) + g(4, -34, 0.6, 15, star(0, 0, 28, c[1])), book(c) + g(7, -31, 0.75, -20, egg())]
  return { head: hatPose(head, l, l % 2 ? 7 : 14), back: cloak(c, l) + g(111, 263, 0.75 + l * 0.02, -12, props[l - 1]), robe: scarf(c, l, l % 3), desk: '' }
}
function astronaut(l: number, c: Palette): PlayfulArt {
  const shells = [
    'M-65 5 Q-58 -66 4 -56 Q61 -55 71 9Z',
    'M-73 7 Q-82 -42 -24 -67 Q41 -90 79 7Z',
    'M-82 10 Q-82 -94 -7 -99 Q71 -102 85 10Z',
    'M-91 9 Q-101 -57 -52 -92 Q15 -123 77 -64 L90 10Z',
    'M-92 9 Q-101 -108 -15 -114 Q77 -125 97 9Z',
    'M-95 10 Q-108 -77 -52 -112 L21 -126 Q92 -111 99 10Z',
    'M-99 11 Q-103 -87 -48 -114 Q-17 -138 20 -115 Q96 -116 104 11Z',
    'M-102 10 Q-118 -64 -61 -119 Q9 -148 76 -95 Q107 -64 107 12Z',
    'M-111 12 Q-112 -96 -53 -125 Q10 -144 77 -105 Q118 -73 116 14Z',
  ]
  let head = p(shells[l - 1], c[2]) + p('M-75 -4 Q-64 -30 -35 -31 L43 -29 Q70 -22 79 8 L67 21 L-66 18Z', c[0])
  head += line('M-48 -41 Q-28 -67 1 -68', '#ffffff', 12) + g(8, -13, 0.55, 0, fish(c))
  if (l >= 2) head += rect(60, -28, 32, 39, 12, c[1]) + line('M76 -28 L85 -53', c[3], 5) + circle(87, -61, 9, c[1])
  if (l >= 4) head += rect(-105, -36, 28, 44, 12, c[1]) + g(-76, -60, 0.55, -10, patch(c))
  if (l >= 6) head += p('M-44 -105 L-42 -127 L24 -135 L40 -113Z', c[0])
  if (l >= 8) head += g(49, -119, 0.62, 25, fish(c))
  if (l === 9) head += line('M-113 -34 Q-157 -87 -68 -130 M97 -27 Q145 -9 119 17', c[1], 7)
  let back = g(544, 326, 1, 9, rect(-29, -61, 58, 99, 18, c[0]) + rect(-19, -46, 39, 52, 12, c[2]) + g(0, -19, 0.47, -20, fish(c)) + line('M-15 23 L16 23', c[1], 10))
  if (l >= 3) back += g(118, 259, 0.55 + l * 0.035, -13, l % 3 === 0 ? fish(c) : l % 3 === 1 ? rect(-31, -30, 62, 61, 15, c[1]) + g(0, 0, 0.63, 0, fish(c)) : bowl(c))
  if (l >= 5) back += g(575, 367, 0.65, 24, p('M-16 -20 Q-40 6 0 40 Q35 2 15 -20Z', c[1]) + p('M-6 -15 Q-16 6 0 19 Q15 2 6 -15Z', c[2], 3))
  return { head: hatPose(head, l, l % 3 === 0 ? 5 : 12), back, robe: scarf([c[2], c[1], c[0], c[3]], l, (l + 1) % 3), desk: '' }
}
function shaolin(l: number, c: Palette): PlayfulArt {
  let robe = p('M220 337 Q244 330 269 348 Q293 368 321 355 Q352 354 385 372 Q408 393 386 407 Q355 418 329 397 Q303 408 274 391 Q244 399 223 375Z', c[1])
    + p('M229 335 Q251 331 269 350 Q281 371 307 374 L339 402 Q312 411 287 391 Q261 395 244 374 Q225 369 229 335Z', c[0])
  const beads = 3 + Math.floor(l * 0.85)
  robe += line('M245 338 Q278 374 368 368', '#694c38', 4)
  for (let i = 0; i < beads; i++) {
    const x = 247 + i * 120 / (beads - 1)
    const y = 338 + (x - 247) * 0.235 + Math.sin(i / (beads - 1) * Math.PI) * 10
    robe += circle(x, y, l >= 5 ? 8 : 6.5, '#865840', 3.5) + ellipse(x - 2, y - 2, 2, 1.5, '#d3a16e', 0)
  }
  if (l >= 2) robe += g(327, 383, 0.64, l % 2 ? 20 : -20, patch(c))
  if (l >= 4) robe += p('M487 288 Q522 296 550 362 L559 396 L518 422 Q513 375 489 345Z', c[0]) + line('M506 319 L541 390', c[3], 8)
  if (l >= 6) robe += g(535, 369, 0.85, 9, patch(c))
  if (l >= 8) robe += p('M518 297 Q544 310 572 369 L553 385 L526 337Z', c[2]) + line('M533 320 L554 365', c[3], 5)
  const objects = [rice(), p('M-18 -22 L18 -22 L26 25 L-25 24Z', c[1]), bowl(c), rice() + g(26, 9, 0.7, 12, rice()), p('M-36 0 Q-33 -38 1 -31 Q37 -31 38 6 Q34 29 -2 29 Q-38 29 -36 0Z', '#be7c42') + line('M-24 -3 Q0 -20 27 -5 M-15 5 L13 5', ink, 4), bowl(c) + g(31, 5, 0.7, 15, rice()), book(c), g(-18, 3, 0.8, -10, rice()) + g(24, 10, 0.75, 15, bowl(c)), lotus([c[0], c[3], c[0], c[2]]) + g(0, -4, 0.75, 0, rice())]
  let back = ''
  if ([3, 5, 6].includes(l)) back += g(545, 300, 1, 16, rect(-6, -97, 12, 177, 5, '#a47748') + line('M-7 -46 L7 -46 M-7 -33 L7 -33', c[3], 6))
  if (l >= 5) back += cloak([c[0], c[2], c[3], c[1]], l)
  return { head: '', back, robe, desk: g(358, 551, 0.52, -8, objects[l - 1]) }
}
const duck = (c: Palette) => p('M-31 12 Q-28 -7 -7 -5 Q-23 -28 -3 -35 Q19 -42 25 -19 L39 -10 L21 -3 Q31 22 11 29 Q-12 40 -31 12Z', '#ffd966') + p('M22 -20 L40 -11 L22 -8Z', '#ee8057', 3) + circle(7, -25, 3, ink, 0) + line('M-18 7 Q-9 20 5 11', c[3], 3)
const ring = (c: Palette) => ellipse(0, 0, 43, 35, c[2]) + ellipse(0, 0, 22, 17, c[0], 4) + line('M-31 -21 L-17 -10 M28 -21 L16 -10 M-30 22 L-17 11 M30 22 L17 11', c[3], 11)
const pouch = (c: Palette) => p('M-23 -25 Q1 -16 24 -27 L17 -9 Q44 22 18 34 Q-24 46 -32 17 Q-31 -1 -16 -12Z', c[0]) + line('M-22 -11 Q0 -2 22 -10', c[1], 7) + g(0, 14, 0.45, -8, fish(c))
const tissue = (c: Palette) => p('M-35 -10 Q-36 -24 -22 -23 L28 -25 Q40 -22 39 -7 L35 26 Q1 40 -35 24Z', c[3]) + p('M-14 -15 L-30 -41 L-4 -37 L16 -53 L29 -24 L11 -12Z', c[2], 4) + line('M-18 -8 Q0 -13 21 -8', c[0], 4)
const slipper = (c: Palette) => p('M-37 17 Q-19 -22 8 -28 Q28 -31 32 -10 Q44 14 27 26 Q-9 39 -37 17Z', c[2]) + p('M-9 -15 Q23 -35 32 -8 Q8 -12 0 15 L-21 11Z', c[0], 4)
const parcel = (c: Palette) => p('M-32 -23 Q-3 -35 30 -20 L35 26 L-30 33Z', c[2]) + line('M-1 -29 L3 30 M-30 1 L31 -5', c[3], 9) + p('M-2 -29 Q-30 -52 -28 -29 Q-19 -20 -2 -29 Q22 -49 23 -31 Q16 -23 -2 -29Z', c[1], 3)
const heart = (c: Palette) => p('M0 26 Q-46 -2 -26 -25 Q-8 -42 0 -20 Q20 -43 36 -19 Q46 6 0 26Z', c[0])
const noodle = (c: Palette) => bowl(c) + line('M-20 -11 Q-33 -28 -15 -34 Q-4 -37 -4 -15 M8 -12 Q-2 -30 15 -32 Q28 -31 23 -12', c[1], 4) + line('M18 -21 L31 -65 M27 -15 L48 -54', c[3], 4)
const scroll = (c: Palette) => p('M-29 -23 Q-24 -36 -9 -32 L30 -28 L22 30 L-30 25Z', c[2]) + ellipse(-29, -27, 10, 7, c[1], 3) + line('M-12 -11 L14 -7 M-14 2 L10 5 M-17 13 L6 17', c[3], 3)
const dough = (c: Palette) => p('M-38 12 Q-47 -8 -26 -21 Q-22 -42 0 -29 Q18 -46 29 -21 Q51 -9 36 13 Q33 39 6 29 Q-18 38 -38 12Z', c[1]) + line('M-19 -6 Q-8 -18 1 -11 M8 4 Q24 -10 29 -2', c[2], 3)
const whisk = (c: Palette) => rect(-5, 2, 10, 48, 4, c[2]) + p('M-5 4 Q-32 -26 -16 -45 Q0 -59 18 -43 Q33 -23 5 4Z', c[1]) + line('M-4 1 Q-16 -27 -6 -41 M5 0 Q18 -28 8 -42', c[2], 3)
const blossom = (c: Palette) => g(0, 0, 1, 0, Array.from({ length: 5 }, (_, i) => g(0, 0, 1, i * 72, ellipse(0, -20, 15, 22, c[2]))).join('')) + circle(0, 0, 13, c[1], 4)
const pot = (c: Palette) => p('M-25 -1 L26 -1 L20 32 L-18 35Z', c[3]) + rect(-31, -7, 62, 13, 5, c[1]) + g(6, -11, 0.78, 18, leaf(c))
const can = (c: Palette) => p('M-24 -19 L23 -15 L26 28 L-26 27Z', c[0]) + p('M23 -8 L50 -33 L54 -21 L26 9Z', c[1]) + line('M-25 -8 Q-49 -12 -42 12 L-25 16', c[3], 7) + g(-1, 2, 0.4, 0, blossom(c))
const mushroom = (c: Palette) => p('M-12 -4 L12 -4 L19 32 L-19 32Z', c[1]) + p('M-44 0 Q-40 -46 -4 -46 Q30 -50 46 -2 Q1 21 -44 0Z', c[2]) + circle(-18, -18, 7, c[1], 2) + circle(14, -26, 8, c[1], 2)
const mic = (c: Palette) => rect(-7, -8, 14, 60, 5, c[3]) + ellipse(0, -25, 20, 28, c[1]) + line('M-13 -36 L12 -29 M-14 -23 L13 -16', c[3], 3)
const peg = (c: Palette) => p('M-12 -36 L10 -38 L13 39 L0 24 L-10 40Z', c[1]) + line('M-5 -28 L0 18 M-13 5 L12 3', c[3], 3) + circle(0, 5, 5, c[3], 2)
function pirate(l: number, c: Palette): PlayfulArt {
  let head = l <= 2
    ? p(`M-91 7 Q-96 -56 -34 ${l === 1 ? -63 : -87} Q36 -87 84 -17 L92 10Z`, c[3]) + line('M-72 -6 Q0 -18 75 6', c[1], 13)
    : p(`M-119 9 Q-103 -22 -86 -46 Q-77 -70 -54 -55 Q-26 ${-80 - l * 4} 2 ${-67 - l * 3} Q31 -37 63 -59 Q84 -77 101 -39 L119 9 Q85 40 34 30 Q0 43 -35 26 Q-86 42 -119 9Z`, c[0]) + line('M-103 6 Q-75 15 -59 -33 Q-23 -86 10 -48 Q52 5 96 -6', c[2], 8)
  head += g(-5, l <= 2 ? -19 : -30, 0.6, 11, duck(c))
  if (l >= 2) head += p('M72 3 Q121 14 117 44 Q91 57 96 28 L76 18Z', c[1])
  if (l >= 4) head += g(70, -63, 0.55, 24, l % 2 ? fish(c) : duck(c))
  if (l >= 6) head += g(-66, -32, 0.45, -20, ring(c))
  if (l >= 8) head += g(9, -110, 0.66, -12, duck(c)) + line('M-64 -51 Q-90 -104 -108 -83', c[1], 5)
  const joke = [ring(c), duck(c), pouch(c), duck(c) + g(27, -2, 0.62, 20, duck(c)), parcel(c), ring(c) + g(0, -9, 0.64, -14, duck(c)), pouch(c) + g(24, -27, 0.6, 22, fish(c)), bowl(c) + g(0, -21, 0.68, 7, duck(c)), parcel(c) + g(0, -33, 0.67, -17, duck(c))][l - 1]
  return { head: hatPose(head, l, l % 2 ? 8 : 15), back: cloak(c, l) + g(118, 280, 0.7 + l * 0.013, -11, joke), robe: scarf(c, l, (l + 1) % 3), desk: l >= 5 ? g(358, 551, 0.45, -8, duck(c)) : '' }
}
function ninja(l: number, c: Palette): PlayfulArt {
  let head = l <= 2 ? p('M-98 -7 Q-29 -28 76 -5 L90 21 Q-5 7 -98 15Z', c[0]) : p(`M-99 11 Q-115 -70 -39 ${-92 - l * 3} Q16 -122 73 -72 Q105 -38 102 13Z`, c[0])
  head += p('M-104 1 Q-32 -18 76 -2 Q98 2 96 17 Q24 33 -93 17Z', c[1]) + g(-13, 2, 0.6, 8, patch(c))
  head += p(`M79 10 Q${122 + l * 2} ${l >= 5 ? -49 : -10} 135 ${l >= 5 ? -72 : -31} Q156 -34 113 15 Q152 30 126 55 L95 32Z`, c[0])
  if (l >= 3) head += g(42, -51, 0.64, 20, star(0, 0, 25, c[3]))
  if (l >= 5) head += g(-42, -72, 0.55, -19, tissue(c))
  if (l >= 7) head += line('M-71 -47 Q-81 -83 -59 -90 M33 -79 Q56 -83 65 -63', c[3], 4)
  if (l === 9) head += g(35, -113, 0.56, 21, bell(c))
  const props = [slipper(c), patch(c), tissue(c), slipper(c) + g(24, 13, 0.65, 12, slipper(c)), bell(c), tissue(c) + g(21, -36, 0.6, 15, p('M-11 12 L-17 -17 L9 -21 L19 11Z', c[2])), ring(c), parcel(c), tissue(c) + g(-26, -20, 0.5, -20, bell(c))][l - 1]
  return { head: hatPose(head, l, l % 2 ? 8 : 16), back: cloak(c, l), robe: scarf(c, l, l % 3), desk: g(357, 552, 0.51, -11, props) }
}
function hero(l: number, c: Palette): PlayfulArt {
  let head = l <= 2 ? p('M-62 2 Q-53 -44 1 -36 Q48 -32 66 14 Q5 22 -62 2Z', c[1]) : p(`M-88 9 Q-99 -59 -45 ${-88 - l * 2} Q16 -118 68 -63 Q89 -32 91 15Z`, c[1])
  head += p('M-69 0 Q-29 6 1 -2 Q40 -10 74 8 L64 25 Q17 26 -68 13Z', c[0]) + g(3, -29, 0.75, -9, star(0, 0, 22, c[2]))
  if (l >= 2) head += p('M-73 -5 Q-114 -22 -102 -53 Q-85 -33 -62 -34Z', c[2])
  if (l >= 4) head += p('M62 -33 Q99 -66 111 -53 Q117 -31 86 -5 L66 4Z', c[2])
  if (l >= 5) head += p('M-13 -75 Q-25 -116 -3 -137 Q29 -106 16 -68Z', c[0])
  if (l >= 7) head += g(-34, -69, 0.55, -24, heart(c))
  if (l === 9) head += g(26, -126, 0.52, 14, parcel(c))
  const props = [heart(c), parcel(c), slipper(c), can(c), parcel(c) + g(0, -29, 0.65, 15, fish(c)), bowl(c), heart(c) + g(26, -13, 0.6, 12, blossom(c)), parcel(c) + g(-24, -24, 0.7, -9, parcel(c)), parcel(c) + g(21, -28, 0.65, 15, rice())][l - 1]
  return { head: hatPose(head, l, l % 3 === 0 ? 5 : 11), back: cloak(c, l) + g(106, 281, 0.7, -13, props), robe: scarf(c, l, l % 3), desk: l >= 4 ? g(358, 552, 0.46, -8, heart(c)) : '' }
}
function wuxia(l: number, c: Palette): PlayfulArt {
  let head = l <= 2 ? p('M-90 2 Q-35 -13 80 3 L82 19 Q1 5 -85 17Z', c[0]) + p('M72 8 Q121 15 111 46 L90 29 L78 35Z', c[2]) : p(`M-119 12 Q-96 -21 -53 -42 Q-29 ${-94 - l * 2} 19 -77 Q67 -64 112 12 Q73 42 10 30 Q-47 47 -119 12Z`, c[1])
  if (l >= 3) head += p('M-136 11 Q-84 -1 -42 8 Q1 -3 52 10 Q113 -1 132 25 Q89 49 43 34 Q3 53 -44 35 Q-106 47 -136 11Z', c[1]) + line('M-88 10 Q-6 22 89 20 M-20 -53 L-65 0 M13 -54 L24 6 M38 -38 L71 11', c[3], 3)
  head += g(-9, l <= 2 ? -4 : -34, 0.62, -8, l >= 5 ? noodle(c) : leaf(c))
  if (l >= 4) head += g(68, -12, 0.7, 18, scroll(c))
  if (l >= 6) head += p('M88 16 Q116 26 118 61 L99 49 Q97 27 82 25Z', c[0])
  if (l >= 8) head += g(-57, -66, 0.55, -19, noodle(c))
  if (l === 9) head += g(83, 38, 0.48, 19, scroll(c))
  const props = [pouch(c), noodle(c), scroll(c), noodle(c) + g(31, -4, 0.5, 20, scroll(c)), pouch(c), noodle(c) + g(-22, -33, 0.6, -10, rice()), scroll(c) + g(24, -15, 0.7, 17, scroll(c)), noodle(c) + g(19, -35, 0.6, 14, noodle(c)), pouch(c) + g(16, -19, 0.65, 13, scroll(c))][l - 1]
  return { head: hatPose(head, l, l % 2 ? 7 : 14), back: cloak(c, l), robe: scarf(c, l, (l + 1) % 3), desk: g(358, 553, 0.51, -9, props) }
}
function baker(l: number, c: Palette): PlayfulArt {
  const poofs = [
    'M-58 7 Q-71 -22 -43 -32 Q-16 -43 16 -23 Q47 -36 65 -4 L57 17Z',
    'M-66 9 Q-86 -24 -62 -49 Q-42 -58 -17 -44 Q-1 -78 26 -57 Q61 -71 78 -33 Q86 -9 63 15Z',
    'M-75 10 Q-98 -29 -73 -58 Q-57 -76 -32 -62 Q-20 -104 13 -86 Q41 -104 63 -72 Q100 -70 84 -34 L70 13Z',
    'M-82 12 Q-110 -14 -91 -47 Q-68 -81 -45 -57 Q-48 -107 -12 -107 Q27 -128 49 -90 Q97 -111 110 -72 Q108 -47 83 -40 L73 14Z',
    'M-85 10 Q-111 -15 -100 -54 Q-85 -84 -54 -72 Q-55 -112 -22 -113 Q6 -142 32 -111 Q61 -130 83 -103 Q113 -104 121 -75 Q119 -43 89 -35 L77 15Z',
    'M-87 10 Q-109 -26 -91 -62 Q-73 -83 -49 -74 Q-62 -126 -23 -128 Q9 -155 39 -120 Q82 -136 89 -99 Q125 -100 119 -65 Q122 -29 82 -32 L81 14Z',
    'M-90 11 Q-120 -20 -96 -58 Q-84 -85 -57 -72 Q-69 -128 -24 -127 Q-1 -156 34 -130 Q78 -148 94 -107 Q140 -95 124 -58 Q115 -32 86 -35 L81 13Z',
    'M-91 12 Q-124 -15 -103 -64 Q-89 -91 -61 -80 Q-83 -130 -31 -141 Q8 -167 43 -134 Q92 -146 105 -105 Q143 -98 137 -62 Q130 -30 91 -37 L84 17Z',
    'M-96 12 Q-133 -19 -115 -63 Q-108 -89 -68 -87 Q-85 -142 -31 -141 Q8 -179 42 -140 Q80 -158 99 -127 Q151 -122 151 -83 Q155 -49 119 -43 Q113 -17 89 19Z',
  ]
  let head = p(poofs[l - 1], c[1]) + p('M-83 -8 Q-17 -1 78 -3 L78 27 Q14 36 -77 19Z', c[0]) + line('M-53 -25 Q-56 -51 -46 -60 M-19 -21 L-25 -68 M19 -20 Q33 -48 21 -75 M59 -23 L72 -57', c[2], 3)
  head += g(l >= 5 ? 58 : -4, l >= 5 ? -58 : -7, 0.58, l % 2 ? 14 : -14, l >= 4 ? dough(c) : toast(c))
  if (l >= 6) head += g(-52, -88, 0.5, -20, whisk(c))
  if (l >= 8) head += g(74, -108, 0.46, 24, dough(c))
  const props = [toast(c), whisk(c), dough(c), bowl(c) + g(5, -23, 0.7, 0, dough(c)), dough(c) + g(26, -11, 0.55, 12, dough(c)), toast(c) + g(-14, -24, 0.55, -15, toast(c)), bowl(c) + g(23, -27, 0.65, 12, whisk(c)), dough(c) + g(20, -36, 0.65, 15, toast(c)), bowl(c) + g(0, -39, 0.85, 12, dough(c))][l - 1]
  return { head: hatPose(head, l, l % 2 ? 7 : 12), back: cloak(c, l) + (l >= 3 ? g(552, 302, 0.95, 18, whisk(c)) : ''), robe: scarf(c, l, (l + 2) % 3), desk: g(359, 553, 0.52, -7, props) }
}
function garden(l: number, c: Palette): PlayfulArt {
  let head = l <= 2 ? g(0, -4, l === 1 ? 0.85 : 1.15, 14, leaf(c)) : p('M-100 5 Q-75 -34 -45 -45 Q-46 -84 -11 -98 Q28 -113 66 -67 L80 -30 L109 13Z', c[1])
  if (l >= 3) head += p('M-139 12 Q-108 -5 -71 4 Q-22 -11 22 5 Q78 -1 131 20 Q134 39 97 36 Q60 56 22 38 Q-14 50 -48 33 Q-95 44 -139 12Z', c[1]) + line('M-43 -22 Q5 -4 69 -11', c[0], 14)
  head += g(l <= 2 ? 18 : 54, l <= 2 ? -21 : -27, 0.58 + l * 0.016, 14, blossom(c))
  if (l >= 4) head += g(-57, -42, 0.78, -21, leaf(c))
  if (l >= 5) head += g(11, -105, 0.58, 8, l % 2 ? mushroom(c) : pot(c))
  if (l >= 7) head += line('M67 -25 Q102 -38 96 -75 Q79 -103 65 -86', c[0], 7) + g(91, -70, 0.52, 57, leaf(c))
  if (l === 9) head += g(-61, -103, 0.79, -21, blossom(c)) + g(113, -59, 0.48, 24, mushroom(c))
  const props = [pot(c), can(c), mushroom(c), pot(c) + g(16, -26, 0.7, 22, blossom(c)), can(c), pot(c) + g(-15, -46, 0.7, -12, leaf(c)), mushroom(c) + g(23, -17, 0.55, 20, mushroom(c)), can(c) + g(31, -24, 0.6, 12, blossom(c)), pot(c) + g(10, -42, 0.9, 14, blossom(c))][l - 1]
  return { head: hatPose(head, l, l % 2 ? 5 : 12), back: cloak(c, l) + (l >= 6 ? g(559, 284, 0.87, 40, leaf(c)) : ''), robe: scarf(c, l, l % 3), desk: g(358, 550, 0.48, -7, props) }
}
function performer(l: number, c: Palette): PlayfulArt {
  let head = l <= 2 ? p('M-79 5 Q-101 -29 -55 -59 Q-1 -88 46 -49 Q78 -39 86 11Z', c[3]) : p(`M-76 6 Q-81 -36 -96 ${-83 - l * 5} Q-42 ${-100 - l * 5} 33 ${-88 - l * 4} Q75 -81 71 -63 L82 9Z`, c[3])
  head += p('M-106 8 Q-48 -6 9 9 Q58 -2 109 20 Q116 44 80 38 Q39 54 -6 32 Q-68 47 -106 8Z', c[3]) + line('M-68 -11 Q-13 -2 65 0', c[0], 14)
  head += g(26, l <= 2 ? -27 : -55, 0.7, 13, star(0, 0, 23, c[1]))
  if (l >= 3) head += g(-57, -31, 0.6, -23, peg(c))
  if (l >= 5) head += p('M61 -23 Q101 -65 109 -101 Q148 -67 110 -20 L77 -1Z', c[0]) + line('M78 -20 L112 -75', c[1], 4)
  if (l >= 7) head += g(6, -128, 0.53, -14, star(0, 0, 31, c[2]))
  if (l === 9) head += g(-49, -124, 0.5, -22, peg(c)) + g(72, -132, 0.46, 22, peg(c))
  const props = [peg(c), mic(c), star(0, 0, 28, c[2]), mic(c) + g(27, 13, 0.55, 17, peg(c)), peg(c) + g(25, 6, 0.75, 16, peg(c)), parcel(c), mic(c) + g(-23, -26, 0.65, -13, star(0, 0, 23, c[2])), peg(c) + g(-25, 10, 0.7, -22, peg(c)) + g(25, 10, 0.7, 22, peg(c)), mic(c) + g(24, -28, 0.65, 9, star(0, 0, 26, c[2]))][l - 1]
  return { head: hatPose(head, l, l % 2 ? 7 : 13), back: cloak(c, l) + (l >= 4 ? g(544, 305, 0.8, 21, mic(c)) : ''), robe: scarf(c, l, (l + 2) % 3), desk: g(359, 551, 0.51, -7, props) }
}
function cultivation(l: number, c: Palette): PlayfulArt {
  let head = g(0, -22 - l * 3, 1 + l * 0.04, -6, cloud(c)) + p('M-88 5 Q-65 -19 -42 -7 Q-12 -25 13 -8 Q47 -29 72 -9 Q105 -2 92 19 Q56 40 22 23 Q-19 44 -51 21 Q-75 32 -88 5Z', c[0])
  head += g(7, -21, 0.52 + l * 0.015, 10, lotus(c))
  if (l >= 2) head += g(-43, -48, 0.4, -16, circle(0, 0, 22, c[1], 4))
  if (l >= 4) head += g(53, -77, 0.56, 8, cloud(c))
  if (l >= 5) head += p('M74 8 Q113 3 118 -35 Q139 -8 117 16 Q137 34 109 49 L91 24Z', c[1])
  if (l >= 7) head += g(-52, -112, 0.63, -16, cloud(c))
  if (l >= 8) head += g(63, -107, 0.47, 17, pouch(c))
  if (l === 9) head += g(-43, -123, 0.54, -19, rice()) + line('M86 -90 L102 -98 L96 -82 L111 -91', c[1], 3)
  const props = [cloud(c), lotus(c), circle(0, 0, 25, c[2], 5), cloud(c) + g(3, -17, 0.5, 0, rice()), pouch(c), cloud(c) + g(16, -14, 0.55, 7, bowl(c)), lotus(c) + g(-23, -15, 0.5, -8, cloud(c)), cloud(c) + g(24, -25, 0.6, 14, pouch(c)), cloud(c) + g(3, -28, 0.7, 8, rice())][l - 1]
  return { head: hatPose(head, l, l % 2 ? 7 : 12), back: cloak(c, l) + g(111, 268, 0.72 + l * 0.01, -8, props), robe: scarf(c, l, l % 3), desk: l >= 5 ? g(358, 551, 0.43, -8, bowl(c)) : '' }
}
function emperor(l: number, c: Palette): PlayfulArt {
  let head = l <= 2 ? p(l === 1 ? 'M-64 9 Q-83 -22 -42 -47 Q7 -62 50 -26 L66 16Z' : 'M-77 6 Q-84 -63 -21 -67 Q34 -75 77 -27 L77 19Z', l === 1 ? '#ac8a63' : c[1]) : p(`M-95 9 Q-87 -27 -74 -41 Q-61 -51 -47 -36 Q-15 ${-54 - l * 3} 8 -42 Q29 -24 49 -41 Q73 -70 83 -39 L102 14 Q66 39 16 29 Q-45 41 -95 9Z`, c[1])
  head += p('M-87 6 Q-12 -9 87 13 L80 32 Q12 21 -83 24Z', l <= 2 ? c[3] : c[0]) + line('M-68 13 Q9 9 70 23', c[2], l >= 4 ? 7 : 4)
  head += g(0, l <= 2 ? -8 : -16, 0.57, 7, fish([c[0], c[2], c[2], c[3]]))
  if (l >= 3) head += g(67, -10, 0.5, 12, scroll(c))
  if (l >= 5) head += p('M-49 -40 Q-67 -68 -52 -88 L-21 -66 L6 -89 L25 -61 L52 -81 Q67 -60 47 -38Z', c[2])
  if (l >= 6) {
    for (const side of [-1, 1]) {
      head += line(`M${side * 85} 9 L${side * 95} 51`, c[2], 3)
      for (let i = 0; i < l - 5; i++) head += circle(side * (87 + i * 3), 21 + i * 11, 6, c[2], 3)
    }
  }
  if (l >= 8) head += g(-39, -87, 0.55, -18, scroll(c)) + g(-20, -110, 0.5, -14, scroll(c))
  if (l === 9) head += g(50, -96, 0.52, 18, fish(c))
  let pile = ''
  for (let i = 0; i < l; i++) pile += g((i % 2 ? -5 : 5), -i * 15, 0.73, i % 2 ? 7 : -8, scroll(c))
  if (l >= 4) pile += g(0, 6 - l * 15, 0.56, 13, fish(c))
  return { head: hatPose(head, l, l % 2 ? 7 : 12), back: cloak(c, l) + g(117, 309, 0.82, -9, pile), robe: scarf(c, l, (l + 1) % 3), desk: g(358, 552, 0.44, -10, l >= 5 ? fish(c) : pouch(c)) }
}
/** Static jokes are object relationships, rather than independent sticker icons. */
const plug = (c: Palette) => ellipse(0, 15, 24, 10, c[3]) + p('M-17 14 L-13 -2 L13 -2 L18 14Z', c[3], 4) + circle(0, -9, 12, c[1], 4)
const bubble = (x: number, y: number, r: number) => circle(x, y, r, '#e9fcff', 3) + line(`M${x - r * 0.4} ${y - r * 0.3} L${x - r * 0.1} ${y - r * 0.6}`, '#ffffff', 3)
function bathtub(c: Palette, ducks = 1) {
  let out = p('M-59 -5 Q-63 35 -35 44 L39 42 Q65 32 59 -8Z', c[0]) + ellipse(0, -7, 61, 18, c[2])
  for (let i = 0; i < ducks; i++) out += g((i - (ducks - 1) / 2) * 37, -22 - (i % 2) * 8, ducks === 1 ? 0.9 : 0.57, i % 2 ? 18 : -9, duck(c))
  return out + line('M-39 45 L-42 53 M39 45 L42 52', c[3], 8)
}
function chest(c: Palette) {
  return p('M-43 -5 L43 -5 L40 39 Q0 52 -43 36Z', c[3]) + p('M-44 -7 L-46 -43 Q-30 -65 26 -55 L43 -15Z', c[3]) + line('M-31 -45 L24 -39 M-37 8 L36 13 M-27 -3 L-27 37 M27 -4 L27 40', c[1], 8) + rect(-8, 8, 17, 16, 4, c[1])
}
function mounted(art: string, s = 0.8, y = 258) {
  return line('M134 265 Q165 262 184 296', '#765745', 5) + g(105, y, s, -9, art)
}
const cracker = (c: Palette) => circle(0, 0, 21, c[2], 4) + line('M-11 -10 L-9 -8 M9 -11 L11 -9 M-9 10 L-7 12 M10 8 L12 10 M0 -1 L2 1', c[3], 3)
const sleeping = (c: Palette) => cloud(c) + line('M-9 -2 Q-4 2 1 -2 M11 -3 Q16 1 21 -3', c[1], 3) + line('M27 -34 L40 -34 L28 -23 L41 -23', c[1], 3)
const cup = (c: Palette) => p('M-15 -13 L14 -13 L12 16 Q0 25 -13 14Z', c[2], 4) + line('M15 -8 Q35 -13 27 6 Q23 12 15 8', c[1], 4) + ellipse(0, -13, 14, 5, '#bc8b63', 3)
const sock = (c: Palette) => p('M-11 -31 L16 -31 L15 7 Q42 15 23 33 Q6 45 -18 23 L-10 5Z', c[2], 4) + line('M-8 -20 L14 -20 M1 19 L17 32', c[1], 6)
const seed = (c: Palette) => ellipse(0, 0, 11, 17, c[3], 4) + line('M-4 -4 Q0 -11 4 -7', c[1], 2)
const plan = (c: Palette) => p('M-18 -25 L17 -21 L20 25 L-19 23Z', c[2], 3) + p('M0 -13 Q-17 5 0 12 Q16 5 0 -13Z', '#91cde3', 2) + line('M-9 17 L10 18', c[3], 2)
function professionBack(id: 'ninja' | 'baker' | 'garden', c: Palette, l: number): string {
  if (l < 2) return ''
  if (id === 'ninja') {
    const tails = [
      'M482 286 Q521 264 549 287 Q566 307 543 320 L523 310 Q539 297 518 293 L490 304Z',
      'M483 285 Q522 258 552 284 Q571 302 550 322 Q531 336 564 351 L580 336 Q601 373 570 379 Q535 378 515 347 Q501 326 528 309 L489 305Z',
      'M483 285 Q517 258 552 279 Q580 304 548 322 Q526 335 555 349 Q584 353 587 375 L565 368 L552 389 Q524 372 511 349 Q497 327 528 308 L489 305Z',
    ]
    return p(tails[l < 4 ? 0 : l < 7 ? 1 : 2], c[0]) + line('M508 287 Q543 277 547 296', c[1], 6)
      + (l >= 4 ? line('M528 332 Q527 353 555 365', c[1], 6) : '')
      + (l >= 5 ? g(552, 367, 0.6, 21, patch(c)) : '')
  }
  if (id === 'baker') {
    let art = p('M504 311 Q483 289 496 267 Q518 263 535 302 Q552 269 581 279 Q598 307 558 321 L567 351 L545 345 L534 322 L521 361 L501 347Z', c[0])
      + ellipse(536, 313, 15, 18, c[1], 4) + line('M507 282 Q512 303 522 308 M565 291 L551 309', c[2], 3)
    if (l >= 4) {
      art = p('M532 314 Q553 298 576 318 L571 333 Q604 357 587 393 Q554 422 529 390 Q515 363 540 334Z', c[1])
        + line('M534 331 Q553 339 578 331', c[0], 8) + g(558, 371, 0.57, 12, toast(c)) + art
    }
    if (l >= 7) art += g(585, 358, 0.38, 21, dough(c))
    return art
  }
  let art = g(546, 320, 1, 6, p('M-35 -9 Q-14 -53 6 -55 Q31 -55 35 -8', 'none', 7)
    + p('M-38 -8 Q-5 8 42 -5 L36 72 Q4 94 -28 73Z', c[3])
    + line('M-26 17 L34 23 M-23 36 L31 42 M-20 56 L29 60 M-14 6 L-9 75 M9 9 L12 76 M28 6 L29 67', c[1], 4))
  if (l >= 3) art = g(551, 280, 1.1, -22, leaf(c)) + g(588, 300, 1.2, 55, leaf(c)) + art
  if (l >= 6) art += g(576, 331, 0.61, 9, blossom(c))
  if (l === 9) art += g(550, 397, 0.46, -13, mushroom(c))
  return art
}
function storyScene(id: string, l: number, c: Palette, art: PlayfulArt): PlayfulArt {
  let scene = ''
  if (id === 'pirate') {
    const duckCaptain = duck(c) + g(1, -37, 0.36, 8, p('M-35 9 Q-25 -38 0 -20 Q27 -39 37 9 Q0 27 -35 9Z', c[0]))
    const scenes = [
      pouch(c) + g(32, 16, 0.73, 14, plug(c)),
      duck(c) + bubble(-27, 27, 6) + bubble(-42, 32, 4),
      p('M-44 -37 L8 -43 L44 -22 L35 40 L-4 25 L-41 37Z', c[2]) + line('M-22 -15 L2 11 M2 -16 L-23 12', c[1], 7) + g(31, 20, 0.5, 20, duckCaptain),
      circle(-15, 2, 33, c[1]) + circle(-15, 2, 24, c[2], 3) + p('M-22 8 L23 -7 L-13 -1Z', c[0], 3) + g(43, -3, 0.55, 15, duck(c)),
      bathtub(c) + g(0, -26, 0.88, -7, duckCaptain),
      chest(c) + bubble(-24, -12, 17) + bubble(10, -21, 22) + bubble(39, -42, 12) + bubble(15, -60, 9),
      duckCaptain + p('M-46 -35 Q-31 -86 16 -66 Q44 -54 46 -33Z', c[0]) + line('M-35 -22 L-39 -11 M47 -20 L43 -10', '#78bed0', 3),
      g(-33, 13, 0.58, -16, duck(c)) + g(2, -11, -0.65, 0, duck(c)) + g(36, 19, 0.58, 12, duck(c)) + line('M-16 24 L-7 9 M20 6 L27 24', c[1], 4),
      bathtub(c, 3) + line('M-54 -3 L-54 -65 M51 -4 L51 -64', c[3], 4) + p('M-54 -64 L-28 -51 L-54 -41Z M51 -64 L75 -49 L51 -41Z', c[1], 3),
    ]
    scene = scenes[l - 1]
    art.back = cloak(c, l) + mounted(scene, l === 9 ? 0.82 : 0.88, l === 9 ? 235 : 257)
    art.desk = l === 2 ? g(360, 551, 0.47, 0, duck(c) + bubble(-38, 23, 5) + bubble(-55, 28, 4)) : ''
    if (l === 9) art.head = hatPose(p('M-111 7 Q-95 -47 -47 -75 L-1 -49 Q29 -76 71 -51 Q112 -19 117 14 Q73 42 31 25 Q-6 47 -49 29 Q-93 39 -111 7Z', c[0]) + line('M-87 5 Q-51 -4 -20 -36 L12 -11 L52 -31 L93 11', c[2], 7) + g(12, -22, 0.5, 12, plug(c)), l, 8)
  } else if (id === 'ninja') {
    const log = p('M-32 -29 L29 -26 L38 29 L-35 31Z', c[2]) + ellipse(0, -29, 33, 15, c[3]) + ellipse(0, -29, 17, 7, c[2], 3) + line('M-21 -10 L-14 20 M18 -8 L24 21 M-48 -8 L-50 4 M48 -3 L51 9', c[3], 3)
    const board = p('M-42 9 L25 -9 L43 19 L-20 42Z', c[2]) + line('M-21 11 L-1 32 M1 5 L21 26', c[3], 3) + line('M0 -19 L1 16 M-5 -19 L7 -19 M21 -29 Q37 -21 29 -13 M32 -38 Q52 -26 42 -15', c[3], 5)
    const snackBag = pouch(c) + g(0, -23, 0.63, 4, cracker(c)) + g(24, -31, 0.55, 18, cracker(c))
    const scissors = circle(-12, 6, 8, c[3], 3) + circle(9, 11, 8, c[3], 3) + line('M-7 1 L17 -23 M4 3 L-11 -28', c[2], 5)
    const pillows = g(-12, 15, 0.9, -16, rect(-30, -25, 60, 50, 17, c[3])) + g(15, -15, 0.95, 15, rect(-29, -22, 58, 45, 17, c[1])) + line('M-35 -2 Q-4 16 36 1', c[2], 5)
    const scenes = [peg(c), p('M-32 -29 Q42 -57 45 -14 Q40 23 3 10 Q-35 14 -34 42 L-48 21 Q-57 -1 -27 -6 Q7 -12 3 -26Z', c[0]), log, board, snackBag, snackBag + g(30, 4, 0.8, 17, scissors), leaf([c[1], c[2], c[2], c[3]]) + line('M17 -16 L31 -21 M21 -2 L36 -4', c[2], 3), pillows, rect(-47, -29, 94, 62, 12, c[0]) + g(-29, 0, 0.36, 0, board) + g(0, 1, 0.36, 0, snackBag) + g(29, 0, 0.37, 0, tissue(c))]
    art.back = professionBack('ninja', c, l) + mounted(scenes[l - 1], l >= 8 ? 0.92 : 0.86)
    art.robe = scarf(c, Math.min(l, 3), l % 3)
    art.desk = ''
    if (l === 1) art.head += g(464, 261, 0.41, 18, peg(c))
    if (l === 7) art.head += g(491, 218, 0.47, 60, leaf([c[1], c[2], c[2], c[3]]))
    if (l === 9) art.head = hatPose(p('M-91 1 Q-25 -23 85 6 L88 26 Q22 5 -87 22Z', c[0]) + p('M-72 -1 Q0 0 66 4 L64 21 Q0 10 -71 17Z', c[1]) + g(0, 7, 0.52, 8, star(0, 0, 25, c[3])) + p('M80 13 Q137 -35 131 -62 Q169 -37 129 9 Q161 27 136 53 L105 31Z', c[0]), l, 9)
  } else if (id === 'hero') {
    const jar = rect(-26, -23, 52, 55, 13, c[0]) + rect(-31, -31, 62, 15, 5, c[2]) + g(0, 3, 0.5, 0, heart(c)) + line('M-41 -37 L-48 -46 M42 -36 L49 -46', c[1], 4)
    const rodSock = line('M-36 34 L-16 2 L-30 -11 L8 -42 L24 -27 L41 -49', c[2], 8) + g(37, -15, 0.6, 10, sock(c))
    const balloon = ellipse(0, -29, 29, 34, c[0]) + line('M0 4 Q-18 20 0 36', c[3], 3) + g(0, 51, 0.65, 5, parcel(c))
    const tap = line('M-30 4 L-30 -15 L7 -15 L7 8 L26 8', c[1], 12) + line('M-30 -27 L-30 -9 M-42 -27 L-18 -27', c[2], 5) + p('M27 19 Q11 40 29 44 Q44 40 27 19Z', '#8bcbd8', 3)
    const wash = rect(-39, -39, 78, 83, 13, c[2]) + circle(0, 6, 26, c[1], 5) + g(0, 12, 0.65, -23, sock(c)) + circle(-22, -23, 4, c[0], 2)
    const utility = rect(-40, -33, 80, 68, 16, c[1]) + g(-18, 1, 0.48, -10, parcel(c)) + g(20, 5, 0.44, 10, can(c)) + line('M-32 -14 L31 -14', c[2], 4)
    const scenes = [g(0, 0, 1, -13, patch(c)), peg(c) + g(30, 3, 0.65, 19, peg(c)) + line('M-39 -24 Q0 -13 54 -21', c[3], 3), balloon, tap, jar, rodSock, rodSock + g(-25, -17, 0.58, -12, whisk(c)) + g(15, 27, 0.6, 18, patch(c)), wash, utility]
    art.back = cloak(c, l) + mounted(scenes[l - 1], l === 3 ? 0.73 : 0.86, l === 3 ? 242 : 264)
    art.desk = l === 5 ? g(358, 552, 0.38, -8, jar) : ''
    if (l <= 2) art.head = ''
    if (l === 9) art.head = hatPose(p('M-81 3 Q-64 -23 -40 -15 L-9 -33 L16 -14 L46 -31 L80 6 Q20 23 -81 3Z', c[1]) + p('M-84 8 Q-64 -7 -41 5 L-12 -11 L15 9 L51 -10 L86 17 L81 30 Q24 21 -80 22Z', c[0]) + g(1, 4, 0.55, 8, star(0, 0, 23, c[2])), l, 8)
  } else if (id === 'wuxia') {
    const soupSheath = g(8, -4, 1, 20, rect(-10, -48, 20, 86, 7, c[3]) + line('M0 -45 L0 -74', c[1], 9) + ellipse(0, -81, 16, 23, c[1], 4))
    const longBill = scroll(c) + p('M-20 22 Q-29 49 -7 50 L16 68 Q29 71 33 57 L19 49 L22 29Z', c[2], 3) + line('M-12 34 L11 38 M1 50 L18 57', c[3], 2)
    const foodMap = scroll(c) + g(-3, -5, 0.42, 0, noodle(c)) + g(16, 22, 0.28, 0, noodle(c)) + g(-12, 18, 0.28, 0, noodle(c))
    const vinegar = rect(-18, -13, 36, 48, 11, '#75534c') + rect(-11, -32, 22, 24, 4, c[2]) + g(0, 7, 0.4, 0, leaf(c))
    const scenes = [pouch(c) + g(0, -16, 0.54, 0, bowl(c)), rect(-19, -42, 38, 78, 9, c[0]) + g(22, 1, 0.55, 18, bell(c)), foodMap, soupSheath, soupSheath + g(-19, 17, 0.68, -13, longBill), book(c) + g(28, 4, 0.55, 14, longBill), vinegar + line('M-35 -10 L-44 -13 M34 -10 L44 -15', c[1], 3), foodMap + g(25, -20, 0.75, 9, foodMap), noodle(c) + g(-43, 28, 0.6, -14, bowl(c)) + g(43, 29, 0.6, 14, bowl(c))]
    art.back = cloak(c, l) + mounted(scenes[l - 1], l === 5 ? 0.8 : 0.84, l === 5 ? 239 : 254)
    art.desk = l === 9 ? g(358, 555, 0.32, -4, scenes[8]) : ''
    if ([4, 5, 6, 7, 9].includes(l)) art.head = hatPose(p('M-89 2 Q-26 -19 79 6 L83 25 Q2 9 -84 20Z', c[0]) + g(-7, -6, l === 5 ? 1 : 0.7, 12, rect(-36, -11, 71, 21, 8, c[1]) + line('M-16 -9 L-16 9 M10 -9 L10 9', c[0], 4)) + p('M76 8 Q120 9 116 42 L94 29 L85 40 L77 20Z', c[0]), l, 10)
  } else if (id === 'baker') {
    const apronDough = dough(c) + p('M-19 -7 L21 -7 L28 25 Q1 37 -26 22Z', c[0], 3) + line('M-14 -9 Q-14 -25 1 -24 Q17 -22 17 -9', c[2], 3) + g(0, 9, 0.48, -12, patch(c)) + g(35, -14, 0.65, 25, whisk(c))
    const snail = dough(c) + circle(4, -2, 20, c[2], 4) + line('M6 -13 Q-14 -7 -3 9 Q13 17 16 0 Q16 -10 6 -4', c[1], 3) + p('M-30 19 Q-54 8 -45 -14 Q-27 -17 -24 5Z', c[1], 3) + line('M-41 -12 L-44 -27 M-30 -11 L-26 -26', c[2], 3)
    let tray = rect(-55, -45, 110, 96, 10, c[2])
    for (let i = 0; i < 9; i++) tray += g(-34 + (i % 3) * 34, -26 + Math.floor(i / 3) * 31, 0.29, i % 2 ? 18 : -12, i % 3 === 0 ? dough(c) : i % 3 === 1 ? toast(c) : mushroom(c))
    const display = rect(-44, -53, 87, 109, 8, c[2]) + line('M-37 -15 L36 -15 M-37 24 L36 24', c[1], 6) + g(0, 36, 0.67, 7, dough(c))
    const scenes = [pouch(c) + g(14, -26, 0.67, 15, dough(c)), rect(-39, -26, 79, 59, 8, c[2]) + g(-20, 3, 0.54, 0, cracker(c)) + g(20, 3, 0.9, 12, rect(-12, -12, 24, 24, 3, c[1])), dough(c) + g(30, -18, 0.66, 12, mushroom(c)), p('M-18 34 L-25 -31 Q0 -48 24 -26 L9 35Z', c[0]) + g(1, -31, 0.57, 10, dough(c)), apronDough, p('M-35 -30 L34 -25 L29 27 Q9 48 -2 28 Q-15 49 -22 24 L-35 26Z', c[2]) + line('M-17 -18 L15 -15 M-22 1 L14 5', c[1], 5), snail, display, tray]
    art.back = professionBack('baker', c, l) + mounted(scenes[l - 1], l >= 8 ? 0.82 : 0.9, l >= 8 ? 246 : 261)
    art.robe = scarf(c, Math.min(l, 3), (l + 2) % 3)
    art.desk = l === 7 ? g(360, 552, 0.48, -4, snail) : l === 5 ? g(360, 553, 0.35, -4, apronDough) : ''
    if (l === 1) art.head = hatPose(p('M-73 3 Q-54 -34 -10 -27 Q39 -40 75 8 L67 24 Q0 18 -67 16Z', c[0]) + g(22, -35, 0.67, 8, dough(c)), l, 9)
  } else if (id === 'garden') {
    const reverseWater = pot(c) + line('M0 -15 Q-21 -53 19 -68 Q53 -64 32 -29', c[0], 6) + g(37, -18, 0.64, 18, can(c)) + p('M8 -36 Q-5 -15 9 -11 Q23 -16 8 -36Z', '#8bd2e1', 3)
    const snail = ellipse(-8, 21, 31, 12, c[3], 4) + circle(-5, 4, 24, c[1], 4) + line('M-7 -9 Q14 -2 5 12 Q-10 19 -14 5 Q-15 -4 -5 0', c[3], 3) + p('M9 20 Q32 16 32 -2 Q49 -11 49 7 Q45 26 26 28Z', c[3], 3)
    let fourPlans = ''
    for (let i = 0; i < 4; i++) fourPlans += g((i % 2 ? 30 : -30), Math.floor(i / 2) * 48 - 27, 0.63, i % 2 ? 6 : -6, pot(c) + g(23, -26, 0.55, 14, plan(c)))
    const seasonRack = rect(-55, -48, 111, 98, 10, c[3]) + line('M0 -42 L0 42 M-48 1 L49 1', c[1], 5) + g(-25, -20, 0.39, 0, leaf(c)) + g(27, -21, 0.41, 0, blossom(c)) + g(-25, 27, 0.43, 0, mushroom(c)) + g(27, 25, 0.37, 0, sleeping(c))
    const scenes = [seed(c) + g(20, -8, 0.9, -17, plan(c)), reverseWater, g(-31, 5, 0.62, -10, pot(c)) + g(4, -20, 0.7, 4, pot(c)) + g(37, 12, 0.62, 10, pot(c)), blossom(c) + g(20, 25, 0.65, -10, snail), fourPlans, can(c) + g(36, -21, 0.7, 19, plan(c)) + p('M38 -40 Q27 -20 40 -17 Q52 -23 38 -40Z', '#8bd2e1', 3), scroll(c) + line('M-16 -10 Q13 -20 7 11 Q-12 24 12 25', c[0], 3) + g(20, 28, 0.65, 0, snail), pot(c) + p('M-39 -39 Q0 -80 40 -37Z', c[1], 4) + line('M0 -41 L0 -13', c[3], 4), seasonRack]
    art.back = professionBack('garden', c, l) + mounted(scenes[l - 1], l >= 5 ? 0.84 : 0.9, l >= 5 ? 249 : 256)
    art.robe = scarf(c, Math.min(l, 3), l % 3)
    art.desk = l === 9 ? g(359, 552, 0.45, -4, snail) : ''
    if (l === 5) art.head = hatPose(p('M-105 9 Q-85 -27 -46 -47 Q-11 -77 39 -38 Q72 -24 100 14 Q35 40 -25 23 Q-66 35 -105 9Z', c[0]) + line('M-70 3 Q-29 -30 5 -24 Q42 -13 70 15', c[1], 5) + g(59, -8, 0.55, 19, blossom(c)), l, 8)
    if (l === 9) art.head = hatPose(p('M-119 10 Q-85 -11 -60 -31 Q-60 -73 -15 -72 Q22 -78 47 -41 L69 -7 Q114 -6 129 21 Q76 49 24 33 Q-34 47 -73 27 Q-108 34 -119 10Z', c[1]) + line('M-58 -5 Q3 12 64 7', c[0], 13) + g(63, 7, 0.6, 0, blossom(c)), l, 7)
  } else if (id === 'performer') {
    const dressedPeg = (i: number) => peg(c) + g(0, 15, 0.55, 0, p('M0 -2 L-17 -13 L-15 10 L0 1 L17 -11 L15 12Z', c[i % 3], 3))
    let audience = line('M-58 32 L61 33 M-55 36 L-55 48 M57 37 L57 49', c[3], 6)
    for (let i = 0; i < 5; i++) audience += g(-43 + i * 22, 1 + (i % 2) * 4, 0.48, i % 2 ? 7 : -5, dressedPeg(i))
    const trophy = p('M-32 -29 L30 -29 Q30 10 7 12 L6 31 L24 36 L-24 36 L-7 30 L-7 12 Q-33 4 -32 -29Z', c[2]) + line('M-32 -22 Q-57 -31 -48 -4 Q-44 4 -27 3 M30 -22 Q57 -27 47 -5 Q43 2 29 2', c[1], 5) + circle(0, -9, 10, c[0], 4) + circle(-3, -11, 1.5, c[3], 0) + circle(3, -7, 1.5, c[3], 0)
    const suitcase = rect(-40, -30, 80, 63, 10, c[3]) + line('M-13 -31 L-13 -43 L14 -43 L14 -32', c[1], 5) + line('M-22 -5 Q23 -43 38 -7 Q52 21 13 23 Q-5 11 12 -1 Q30 -14 32 7', c[0], 5)
    const scenes = [peg(c) + line('M-41 -21 L37 -24', c[3], 3), peg(c) + g(25, 15, 1, 0, circle(0, 0, 10, c[2], 3)), whisk(c) + g(33, -1, 0.65, 9, mic(c)), g(-11, 8, 1, 180, mic(c)) + g(30, -5, 0.67, 14, scroll(c)), audience, suitcase, audience + g(-15, -31, 0.5, 0, star(0, 0, 23, c[2])) + g(34, -30, 0.45, 0, star(0, 0, 23, c[2])), parcel(c) + g(18, -26, 0.65, 15, scroll(c)), trophy + g(36, 18, 0.65, 9, peg(c))]
    art.back = cloak(c, l) + mounted(scenes[l - 1], l === 5 || l === 7 ? 0.95 : 0.9)
    art.desk = l >= 5 ? g(355, 552, 0.4, -4, audience) : ''
    if (l === 1) art.head = hatPose(p('M-66 1 Q-21 -13 65 10 L64 25 L-61 18Z', c[0]) + g(40, 1, 0.7, 9, p('M0 0 L-29 -17 Q-44 8 -25 15 L0 0 L27 -17 Q45 7 24 16Z', c[0])), l, 8)
    if (l === 9) art.head = hatPose(p('M-113 8 Q-132 -41 -75 -73 Q-13 -119 64 -61 Q95 -46 103 -12 L86 22Z', c[3]) + p('M-100 7 Q-48 -9 23 14 Q74 3 113 26 Q82 49 34 29 Q-49 43 -100 7Z', c[3]) + line('M-80 -4 Q-4 -3 69 19', c[0], 12) + g(27, -44, 0.9, 18, star(0, 0, 24, c[2])), l, 7)
  } else if (id === 'cultivation') {
    let teaGrid = rect(-60, -51, 120, 108, 17, c[0])
    for (let i = 0; i < 9; i++) teaGrid += g(-37 + (i % 3) * 35, -30 + Math.floor(i / 3) * 34, 0.5, i % 2 ? 7 : -6, cup(c))
    const teaMeet = ellipse(0, 20, 53, 25, c[1]) + g(-32, -20, 0.6, -9, sleeping(c)) + g(27, -24, 0.6, 8, sleeping(c)) + g(0, 39, 0.6, 0, cloud(c)) + g(-16, 10, 0.43, 0, cup(c)) + g(19, 7, 0.43, 0, cup(c))
    const sofa = rect(-51, -6, 102, 37, 17, c[1]) + g(-29, -19, 0.7, -8, sleeping(c)) + g(25, -20, 0.7, 7, sleeping(c))
    const scenes = [sleeping(c), ellipse(0, 26, 48, 15, c[1]) + g(0, 1, 1, 0, sleeping(c)), sleeping(c) + g(39, 17, 0.75, 165, cup(c)), g(-19, 3, 0.9, -5, sleeping(c)) + g(37, -11, 0.6, 12, cloud(c)), teaMeet, cup(c) + line('M-43 -13 Q-50 -44 -10 -38 M28 -38 Q64 -27 45 6', c[1], 3), sofa, sofa + g(-11, -45, 0.64, -5, sleeping(c)), teaGrid]
    art.back = cloak(c, l) + mounted(scenes[l - 1], l >= 5 ? 0.82 : 0.89, l >= 5 ? 249 : 259)
    art.desk = l >= 5 ? g(358, 551, 0.54, -5, cup(c)) : ''
    if (l <= 2) art.head = hatPose(g(2, -8, l === 1 ? 0.85 : 1.1, 0, cloud(c)) + p('M-64 5 Q-37 -8 -5 7 Q23 -2 55 10 L52 24 Q-5 15 -59 21Z', c[0]), l, 9)
    if (l === 9) art.head = hatPose(p('M-91 9 Q-84 -19 -56 -20 Q-42 -58 -12 -36 Q16 -63 37 -38 Q66 -40 73 -14 Q98 -6 86 17 Q54 36 20 23 Q-20 39 -49 23 Q-83 31 -91 9Z', c[0]) + g(7, -19, 0.68, 8, lotus(c)), l, 9)
  } else if (id === 'emperor') {
    const stamp = rect(-17, -17, 34, 29, 5, c[2]) + g(0, -20, 0.56, 0, fish(c)) + p('M-27 21 L35 27 L31 48 L-34 41Z', c[3], 3)
    let papers = ''
    for (let i = 0; i < Math.max(1, l - 1); i++) papers += g(i % 2 ? -8 : 7, -i * 13, 0.76, i % 2 ? 6 : -9, scroll(c))
    const snackBook = book(c) + g(-18, -2, 0.55, -5, cracker(c)) + g(24, -10, 0.46, 18, fish(c))
    const jarMeasure = rect(-29, -32, 59, 71, 14, c[3]) + rect(-34, -39, 68, 14, 6, c[2]) + g(0, 7, 0.77, 0, cracker(c)) + line('M39 -28 L39 39', c[2], 3) + circle(39, 4, 6, c[2], 3)
    const linked = g(-13, -23, 0.8, -9, scroll(c)) + g(10, 17, 0.8, 10, scroll(c)) + g(-2, 56, 0.8, -6, scroll(c)) + line('M4 2 L3 10 M6 39 L2 44', c[2], 4)
    const scenes = [scroll(c) + g(0, 13, 0.5, 0, bowl(c)), scroll(c) + g(8, -2, 0.48, 12, fish(c)), g(0, 0, 1, 13, stamp), scroll(c) + g(4, 8, 0.5, 0, cup(c)), papers + g(0, -43, 0.75, -8, snackBook), jarMeasure, linked, rect(-49, -53, 98, 103, 8, c[1]) + g(0, -9, 1.1, 0, cup(c)) + line('M-34 33 L32 33', c[2], 6), papers + g(13, 5, 0.91, 5, scroll(c) + g(0, 3, 0.6, 9, cracker(c)))]
    art.back = cloak(c, l) + mounted(scenes[l - 1], l === 9 ? 0.92 : 0.87, l === 7 ? 236 : l === 9 ? 246 : 253)
    const deskSeal = rect(-46, -17, 92, 37, 9, c[2]) + g(1, 0, 0.68, 0, fish([c[0], c[2], c[0], c[3]])) + line('M-34 24 L37 24', c[0], 5)
    art.desk = l >= 3 ? g(359, 550, 0.82, -4, deskSeal) : ''
    if (l === 1) art.head = hatPose(p('M-62 0 Q-51 -35 -16 -21 Q5 -43 37 -24 L70 13 Q8 27 -62 0Z', c[2]) + p('M44 6 Q86 -16 99 4 Q110 28 70 25 L82 45 L63 41 L50 21Z', c[2]), l, 8)
    if (l >= 5) {
      let crown = p('M-83 2 Q-83 -41 -42 -39 L30 -32 Q65 -40 83 -5 L83 19 Q11 36 -83 17Z', c[1]) + line('M-66 7 Q3 10 66 14', c[2], 7)
      crown += l === 5 ? g(1, -38, 0.7, 6, rect(-41, -7, 83, 17, 7, c[2])) : p(`M-100 -39 Q-4 -55 96 -33 L92 -20 Q2 -39 -96 -23Z`, c[1]) + line('M-85 -35 Q1 -45 83 -29', c[2], 5)
      if (l >= 6) {
        for (const side of [-1, 1]) {
          crown += line(`M${side * 88} -22 L${side * 95} 25`, c[2], 3)
          for (let i = 0; i < Math.min(3, l - 5); i++) crown += circle(side * (90 + i * 2), -6 + i * 12, 5, c[2], 3)
        }
      }
      crown += g(2, -8, 0.58, 8, fish([c[0], c[2], c[2], c[3]]))
      art.head = hatPose(crown, l, 9)
    }
  }
  return art
}
export function getPlayfulArt(themeId: string, level: number): PlayfulArt {
  const l = Math.max(1, Math.min(9, Math.trunc(level)))
  const t = playfulThemes.find(t => t.id === themeId)
  if (!t) return { head: '', back: '', robe: '', desk: '' }
  const story = renderStoryArt(t.id, l, t.colors)
  if (story) return story
  if (t.id === 'wizard') return wizard(l, t.colors)
  if (t.id === 'astronaut') return astronaut(l, t.colors)
  if (t.id === 'shaolin') return shaolin(l, t.colors)
  const builders = { pirate, ninja, hero, wuxia, baker, garden, performer, cultivation, emperor }
  if (t.id in builders) return storyScene(t.id, l, t.colors, builders[t.id as keyof typeof builders](l, t.colors))
  return { head: '', back: '', robe: '', desk: '' }
}

export function getPlayfulEmblem(themeId: string): string {
  const c = playfulThemes.find(t => t.id === themeId)?.colors
  if (!c) return ''
  const symbols: Record<string, () => string> = {
    wizard: () => star(0, 0, 29, c[1]),
    astronaut: () => fish(c),
    pirate: () => duck(c),
    ninja: () => p('M0 -33 L9 -9 L33 0 L9 9 L0 33 L-9 9 L-33 0 L-9 -9Z', c[1]),
    hero: () => heart(c),
    wuxia: () => leaf(c),
    baker: () => toast(c),
    garden: () => blossom(c),
    performer: () => p('M-14 13 L-14 -25 L21 -33 L21 7 Q35 13 24 25 Q10 34 7 17 L7 -16 L-2 -13 L-2 23 Q-14 37 -27 28 Q-33 15 -14 13Z', c[1]),
    cultivation: () => cloud(c),
    shaolin: () => circle(-18, -10, 10, c[0], 3) + circle(3, -17, 10, c[0], 3) + circle(21, -1, 10, c[0], 3) + circle(7, 21, 10, c[0], 3) + circle(-17, 16, 10, c[0], 3),
    emperor: () => rect(-25, -27, 50, 54, 8, c[2]) + g(0, 0, 0.58, 0, fish(c)),
  }
  return symbols[themeId]?.() ?? ''
}
