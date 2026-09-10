/**
 * Three story-led wardrobes. All drawing here is clothing or independent props.
 * The caller supplies the unchanged original cat, identity mask and input scene.
 */
export interface StoryArt { head: string, back: string, robe: string, desk: string }
type Colors = readonly [string, string, string, string]
const ink = '#292531'
const cream = '#fff4d9'
const wood = '#b98049'
const green = '#76aa60'
const path = (d: string, fill: string, width = 5.5) => `<path d="${d}" fill="${fill}" stroke="${ink}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round"/>`
const stroke = (d: string, color = ink, width = 5) => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round"/>`
const oval = (x: number, y: number, rx: number, ry: number, fill: string, width = 5) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${ink}" stroke-width="${width}"/>`
const dot = (x: number, y: number, r: number, fill: string, width = 4) => oval(x, y, r, r, fill, width)
const box = (x: number, y: number, w: number, h: number, r: number, fill: string, width = 5) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${ink}" stroke-width="${width}"/>`
const at = (x: number, y: number, scale: number, angle: number, art: string) => `<g transform="translate(${x} ${y}) rotate(${angle}) scale(${scale})">${art}</g>`
const cap = (art: string, angle = 0) => at(365, 230, 0.98, angle, art)
const side = (art: string, scale = 0.66, angle = 0) => at(98, 263, scale, angle, art)
const desk = (art: string) => at(298, 554, 1, 0, art)
const star = (x: number, y: number, s: number, color: string) => at(x, y, s, 0, path('M0 -24 L7 -8 L24 -7 L12 6 L16 23 L0 14 L-16 23 L-12 6 L-24 -7 L-7 -8Z', color, 4))
const sleepy = (x: number, y: number, s = 1) => at(x, y, s, 0, stroke('M-19 -2 Q-11 6 -3 -2 M7 -2 Q15 6 23 -2', ink, 4) + oval(2, 13, 4, 3, ink, 0))
const patch = (x: number, y: number, color: string) => at(x, y, 1, -8, path('M-17 -14 Q-2 -18 18 -12 L15 15 L-18 13Z', color, 3.5) + stroke('M-20 -5 L-13 -4 M-19 6 L-12 6 M7 -16 L7 -8 M13 6 L21 5', ink, 3))
const fish = (color: string, burnt = false) => path('M-32 1 Q-14 -29 18 -15 L36 -31 L35 29 L18 13 Q-9 34 -32 1Z', burnt ? '#976044' : color, 4.5) + dot(-15, -2, 3.6, ink, 0) + stroke('M7 -15 Q-3 0 8 14', burnt ? '#442d2c' : cream, 4) + (burnt ? stroke('M-19 -14 L-10 -10 M4 15 L12 11', '#442d2c', 5) : '')
const toast = (burnt = false) => path('M-28 26 L-29 -7 Q-46 -26 -26 -36 Q-2 -48 24 -34 Q45 -27 29 -7 L28 26 Q0 35 -28 26Z', burnt ? '#815035' : '#eab568', 4.5) + path('M-18 18 L-19 -9 Q-3 -27 19 -10 L18 19Z', cream, 3)
const friedEgg = () => path('M-35 3 Q-42 -17 -23 -24 Q-10 -36 5 -26 Q28 -33 37 -14 Q45 6 24 20 Q8 29 -12 19 Q-33 28 -35 3Z', '#fff9e8', 4) + oval(2, -3, 14, 12, '#ffcf56', 3)
const steam = (x: number, y: number, color = ink) => at(x, y, 1, 0, stroke('M-9 8 Q-21 -2 -9 -12 Q2 -21 -6 -28 M11 6 Q-1 -4 11 -16', color, 4))
const book = (left: string, right: string, cover: string) => path('M-50 -29 Q-28 -39 0 -23 Q27 -40 51 -27 L49 35 Q22 25 0 42 Q-23 23 -49 35Z', cover, 5) + path('M-43 -24 Q-23 -28 -3 -17 L-3 32 Q-24 20 -42 28Z', cream, 3) + path('M4 -17 Q23 -29 44 -23 L42 28 Q23 19 4 32Z', cream, 3) + at(-24, 1, 0.40, -5, left) + at(24, 1, 0.40, 5, right)
const smallLeaf = (color = green) => path('M-23 -12 Q14 -31 27 -19 Q29 13 -3 22 Q-24 18 -23 -12Z', color, 4) + stroke('M-19 15 L20 -15', '#4b683f', 3)
const knot = (x: number, y: number, color: string) => at(x, y, 1, 0, path('M-5 -3 Q-34 -28 -35 -2 Q-34 21 -5 6 Q26 30 32 6 Q29 -22 6 -3Z', color, 4) + box(-7, -10, 14, 23, 4, cream, 3))

function wizardCollar(l: number, c: Colors) {
  const silhouettes = [
    'M220 343 Q242 327 260 347 L282 382 L320 361 Q358 350 391 373 L386 399 Q357 411 325 392 L287 401 L251 377 L222 374Z',
    'M219 342 L246 327 Q273 337 283 361 Q308 348 334 354 Q361 345 394 375 L384 406 L348 384 L318 398 L287 380 L254 392 L220 367Z',
    'M220 341 L260 332 L286 369 L318 350 L354 357 L393 380 L383 408 L345 393 L314 407 L283 385 L251 392 L220 371Z',
    'M219 342 Q244 326 270 347 Q289 373 313 356 Q350 336 395 373 Q408 395 381 407 Q355 411 330 390 Q293 416 267 382 Q231 395 219 369Z',
    'M218 341 Q242 330 262 345 L297 375 L329 354 Q359 349 391 373 L391 403 Q367 415 338 398 L305 413 L273 389 L243 394 L219 371Z',
    'M220 341 Q245 330 267 348 L292 374 L319 355 L345 357 L393 379 L388 407 Q362 393 345 407 Q323 398 308 410 Q286 393 271 391 Q244 393 220 374Z',
    'M218 343 L255 335 Q288 373 305 369 Q328 345 356 358 L395 379 L386 406 L356 393 Q336 416 307 396 Q278 409 257 380 L222 376Z',
    'M219 342 L257 332 L286 357 L318 348 L353 358 L392 377 L390 409 L351 395 L322 414 L291 395 L259 399 L221 374Z',
    'M218 342 Q246 322 270 347 Q289 365 309 360 Q340 341 366 361 L394 380 Q409 404 381 413 L346 397 Q315 418 282 392 Q251 406 220 376Z',
  ]
  const body = l === 4 ? c[2] : l === 7 || l === 9 ? cream : c[0]
  let art = path(silhouettes[l - 1], body)
  if (l === 1) art += patch(270, 374, c[2]) + knot(321, 380, c[1])
  if (l === 2) art += at(270, 363, 0.35, -18, toast()) + at(340, 384, 0.38, 12, toast(true))
  if (l === 3) art += path('M250 347 L268 367 L261 393 L247 378Z', c[1], 3) + path('M340 362 L359 374 L350 409 L336 391Z', c[2], 3)
  if (l === 4) art += path('M312 357 Q356 342 394 376 L384 405 L349 387 L322 398Z', c[3], 4) + knot(301, 380, c[1])
  if (l === 5) art += stroke('M235 348 L275 380 L304 398 L338 377 L376 390', cream, 12) + path('M322 369 L339 373 L337 409 L327 401 L316 408Z', c[3], 3)
  if (l === 6) art += stroke('M250 352 L278 375 L307 380 L334 370 L365 388', c[1], 4) + star(278, 375, 0.35, c[1]) + star(336, 373, 0.28, c[1])
  if (l === 7) art += stroke('M239 348 L281 387 L319 381 L340 370 L380 393', c[2], 12) + knot(302, 389, c[0])
  if (l === 8) art += path('M244 344 L271 363 L262 391 L250 378Z', cream, 3) + path('M299 358 L317 356 L322 408 L308 395 L299 405Z', c[2], 3) + path('M352 363 L373 374 L365 406 L350 394Z', c[1], 3)
  if (l === 9) art += stroke('M235 348 Q276 392 304 389 Q327 370 346 375 L383 397', c[0], 12) + knot(319, 388, c[2])
  return art
}

function wizard(l: number, c: Colors): StoryArt {
  let head = ''
  let back = ''
  let props = ''
  const brim = (color: string) => path('M-142 3 Q-102 -21 -66 -9 Q-31 -24 3 -6 Q38 -19 82 1 Q111 -3 124 14 Q123 33 99 33 Q64 49 34 36 Q-3 45 -34 32 Q-74 45 -99 30 Q-135 35 -142 3Z', color)
  switch (l) {
    case 1:
      head = path('M-104 1 Q-77 -64 -48 -77 Q-15 -94 -51 -105 Q-75 -99 -82 -79 Q-119 -74 -125 -100 Q-117 -143 -65 -145 Q-5 -161 40 -121 Q66 -94 57 -60 Q77 -27 105 9Z', c[0]) + brim(c[0])
      head += sleepy(-66, -112, 0.75) + patch(-12, -43, c[2]) + stroke('M-109 -70 L-128 -43 L-119 -22', c[1], 4) + star(-121, -11, 0.62, c[1])
      back = side(stroke('M-12 39 L0 1 L-8 -36 M0 3 L24 -12', wood, 10) + stroke('M23 -12 L23 12', cream, 3) + star(23, 30, 0.72, c[1]), 0.58, -12)
      break
    case 2:
      head = path('M-109 8 Q-94 -55 -62 -88 L-66 -145 Q-23 -163 21 -144 L17 -95 Q63 -69 105 10Z', c[0]) + brim(c[0])
      head += oval(-23, -145, 44, 12, '#644180') + at(-25, -163, 0.84, -10, toast(true)) + sleepy(49, -39, 0.7)
      props = desk(at(-35, 0, 0.43, -9, toast(true)) + at(39, -1, 0.66, 0, friedEgg()) + stroke('M-75 14 Q1 30 80 14', c[0], 5))
      break
    case 3:
      head = path('M-119 8 L-83 -75 L-4 -160 L34 -79 L118 10Z', c[0]) + path('M-83 -75 L-4 -160 L-13 -45Z', c[2], 4) + brim(c[0])
      head += at(-72, -109, 0.71, -27, box(-24, -29, 48, 65, 9, cream) + at(0, 2, 0.43, 0, friedEgg())) + at(10, -131, 0.77, 10, box(-24, -29, 48, 65, 9, c[1]) + at(0, 2, 0.45, 0, fish(c[2]))) + at(74, -87, 0.66, 31, box(-24, -29, 48, 65, 9, cream) + star(0, 1, 0.75, c[0]))
      back = side(at(-24, 0, 0.72, -18, box(-23, -31, 46, 62, 7, cream) + star(0, 0, 0.72, c[0])) + at(22, 8, 0.72, 13, box(-23, -31, 46, 62, 7, c[1]) + at(0, 0, 0.48, 180, fish(c[2]))), 0.62)
      break
    case 4:
      head = path('M-118 10 Q-117 -67 -79 -107 Q-89 -155 -46 -165 Q-12 -153 -32 -112 L-7 -64 Q22 -104 26 -153 Q63 -172 81 -132 Q68 -99 105 -55 L116 13Z', c[0]) + brim(c[0])
      head += at(-60, -145, 0.75, 0, path('M0 -26 Q-4 -6 15 -4 Q27 13 3 30 Q-20 18 -21 0 Q-22 -17 0 -26Z', c[3], 4)) + at(58, -145, 0.8, 0, path('M0 -29 Q-26 4 -18 18 Q0 36 20 17 Q26 4 0 -29Z', c[2], 4))
      back = at(568, 318, 0.85, 8, oval(0, 0, 36, 42, c[2]) + path('M-23 -28 Q0 -52 23 -27Z', c[1], 4) + stroke('M-30 -8 Q-52 -42 -44 -47 L-31 -27', c[3], 11) + path('M32 -8 Q54 -34 55 -47 L44 -51 Q45 -29 28 -21Z', c[3], 4))
      props = desk(at(-29, 0, 0.59, -8, fish(c[2], true)) + at(35, -1, 0.5, 0, friedEgg()))
      break
    case 5:
      head = path('M-115 12 Q-101 -69 -61 -72 Q-57 -121 -14 -117 Q38 -119 53 -70 Q96 -48 117 13Z', c[0]) + brim(c[0])
      head += at(-8, -111, 1.15, -12, path('M-87 -25 Q-42 -42 13 -25 L88 -8 L82 42 Q32 28 -6 25 Q-47 37 -87 18Z', cream) + path('M-90 -32 Q-47 -47 -2 -32 L91 -16 L92 -3 Q44 -17 0 -17 Q-44 -28 -89 -10Z', c[1], 4) + stroke('M-69 -3 L-11 0 M13 3 L64 15', '#a99271', 3) + path('M36 -17 L54 -13 L43 55 L32 42 L19 50Z', c[3], 4))
      head += sleepy(-63, -88, 0.6)
      back = side(book(fish(c[2], true), friedEgg(), c[0]) + steam(-22, -44, '#78564a'), 0.66, -8)
      props = desk(oval(0, 7, 65, 12, c[1], 4) + at(-12, -1, 0.54, -5, fish(c[2], true)) + at(42, 0, 0.34, 12, toast()))
      break
    case 6:
      head = path('M-119 10 Q-116 -48 -76 -59 Q-94 -121 -44 -151 Q3 -189 58 -162 Q94 -145 73 -118 Q50 -145 18 -120 Q-4 -101 33 -79 Q67 -55 111 11Z', '#4c477e') + brim('#4c477e')
      head += path('M-70 -104 Q-37 -169 17 -151 Q45 -143 28 -124 Q-20 -149 -44 -92Z', c[1], 4) + star(1, -129, 0.55, c[2]) + star(-32, -117, 0.38, cream) + star(-9, -45, 0.6, c[1])
      back = at(565, 292, 0.84, 0, oval(0, 0, 42, 42, '#4c477e') + stroke('M-25 -18 L-8 10 L13 3 L25 24', c[1], 5) + star(-25, -18, 0.28, cream) + star(-8, 10, 0.3, cream) + star(25, 24, 0.3, cream))
      back += side(stroke('M-24 32 L16 -19', c[1], 10) + path('M7 -30 L25 -41 L41 -20 L25 -1Z', c[2], 4) + star(-24, 32, 0.4, cream), 0.68, -8)
      break
    case 7:
      head = path('M-113 8 Q-91 -49 -61 -62 Q-65 -89 -103 -85 Q-137 -99 -114 -129 Q-72 -164 -15 -142 Q33 -122 39 -86 Q64 -45 113 11Z', cream) + brim(c[2])
      head += path('M-97 -129 Q-65 -154 -20 -135 Q21 -118 23 -88 L-28 -75 Q-50 -101 -96 -100Z', c[0], 4) + sleepy(-59, -120, 0.74) + knot(35, -45, c[0])
      back = side(path('M-32 -42 L32 -42 L26 -25 L7 1 L26 28 L33 43 L-33 43 L-26 27 L-6 1 L-26 -25Z', c[2], 4) + stroke('M-20 -31 L21 -31 M-19 32 L21 32', wood, 8) + dot(-7, -20, 6, c[1]) + dot(6, 19, 7, c[1]), 0.68)
      props = desk(dot(-44, -4, 8, c[1]) + dot(-6, 7, 6, c[1]) + dot(36, -10, 9, c[1]) + stroke('M-51 12 L-37 12 M-12 19 L0 19 M27 9 L44 9', c[2], 3))
      break
    case 8:
      head = path('M-115 11 Q-125 -46 -80 -69 Q-49 -113 19 -97 Q67 -98 87 -55 L116 12Z', c[0]) + brim(c[0])
      head += at(-77, -114, 0.88, -27, box(-23, -42, 46, 81, 8, cream) + at(0, -5, 0.43, 0, fish(c[2]))) + at(-6, -140, 0.94, 5, box(-23, -43, 46, 81, 8, c[2]) + at(0, -6, 0.44, 0, toast())) + at(75, -115, 0.85, 28, box(-23, -42, 46, 81, 8, c[1]) + at(0, -5, 0.45, 0, friedEgg()))
      back = at(565, 296, 0.64, -16, book(fish(c[2]), toast(), c[0])) + at(568, 356, 0.63, 16, book(friedEgg(), fish(c[2], true), c[3]))
      props = desk(oval(0, 7, 79, 12, c[1], 4) + at(-36, 0, 0.50, -18, fish(c[2])) + at(36, 1, 0.43, 15, toast()) + stroke('M-9 -1 L7 -1 M-1 -10 L7 -1 L-1 7', c[0], 4))
      break
    default:
      head = path('M-124 12 Q-109 -57 -72 -76 Q-93 -105 -121 -91 Q-151 -103 -132 -132 Q-103 -174 -45 -165 Q7 -161 30 -121 Q58 -99 66 -65 L121 14Z', cream) + brim(cream)
      head += stroke('M-108 -2 Q-56 -20 -3 -5 Q46 -12 102 13', c[0], 14) + sleepy(-87, -126, 0.85) + patch(5, -53, c[2])
      head += at(69, -116, 0.79, 13, box(-41, -32, 82, 67, 17, c[0]) + box(-28, -17, 53, 33, 9, '#c3a5e4', 3) + stroke('M-24 -38 L24 -38', ink, 8) + at(-2, -54, 0.58, -9, toast(true)) + dot(28, 24, 5, c[1], 2))
      back = side(box(-48, -44, 96, 91, 11, c[0]) + Array.from({ length: 9 }, (_, n) => {
        const x = -30 + n % 3 * 30
        const y = -28 + Math.floor(n / 3) * 30
        return box(x - 12, y - 11, 24, 23, 4, cream, 2) + at(x, y, 0.25, 0, n === 4 ? fish(c[2], true) : n % 2 ? friedEgg() : toast())
      }).join(''), 0.67, -3)
      props = desk(oval(0, 6, 87, 13, c[1], 4) + at(-48, 1, 0.43, -10, toast()) + at(0, 0, 0.60, 0, fish(c[2], true)) + at(48, -3, 0.57, 5, friedEgg()))
  }
  return { head: cap(head, l === 5 ? -3 : l === 9 ? 3 : l % 2 ? -5 : 5), back, robe: wizardCollar(l, c), desk: props }
}

const supplyBag = (c: Colors, round = true) => (round ? oval(0, 0, 40, 50, c[0]) : box(-37, -49, 74, 99, 18, c[0])) + (round ? oval(0, -5, 30, 32, c[2], 4) : box(-26, -33, 52, 55, 12, c[2], 4)) + at(0, -7, 0.65, 0, fish(c[1])) + box(-19, 31, 39, 13, 6, c[1], 3) + stroke('M-9 -55 Q0 -70 13 -53', c[3], 7)
const sealedFish = (c: Colors) => path('M-34 -37 L28 -33 L35 29 L21 44 L-32 40 L-39 -22Z', c[2], 4) + stroke('M-30 -28 L25 -24 M-27 31 L27 31', c[1], 5) + at(-1, 4, 0.75, -9, fish(c[0]))
const moonRock = (cookie = false) => path('M-26 8 L-18 -19 L8 -27 L28 -6 L21 21 L-9 25Z', cookie ? '#d8a364' : '#bbc8d8', 4) + dot(-9, -3, 5, cookie ? '#8e623b' : '#94a5b6', 3) + dot(12, 10, 4, cookie ? '#8e623b' : '#94a5b6', 3)
function astroCollar(l: number, c: Colors) {
  const silhouettes = [
    'M220 343 L252 330 L289 370 L323 354 L358 358 L391 379 L381 397 L343 389 L314 403 L285 382 L253 391 L220 373Z',
    'M219 342 Q242 329 260 346 L295 374 L327 351 Q372 352 395 380 L389 409 L351 395 L323 408 L288 389 L251 395 L220 373Z',
    'M220 341 L252 330 L277 354 L306 363 L335 350 L371 362 L394 382 L386 410 L357 399 L328 411 L300 394 L270 392 L243 379 L220 378Z',
    'M219 342 Q251 324 277 354 L302 368 L330 350 Q362 349 395 377 L388 408 L349 394 L319 411 L287 386 L251 391 L220 371Z',
    'M216 345 Q229 327 250 336 Q278 361 300 363 Q325 344 350 351 Q389 351 399 379 Q405 406 379 416 Q351 411 337 399 Q306 416 283 399 Q248 407 231 382 Q216 380 216 345Z',
    'M219 342 L248 330 L271 351 L301 364 L331 350 L358 356 L395 378 L393 400 L379 414 L359 400 L340 412 L321 399 L299 410 L278 390 L256 397 L240 377 L219 375Z',
    'M220 343 L249 332 L288 365 L312 359 L337 346 L369 361 L395 381 L385 414 L354 395 L326 410 L303 395 L273 392 L246 380 L220 374Z',
    'M218 342 Q242 326 264 345 L296 373 L332 348 L355 353 L395 378 L390 409 L354 392 L325 415 L292 391 L259 398 L220 374Z',
    'M216 343 Q234 326 256 338 L290 364 Q313 351 339 349 Q379 344 398 378 Q411 405 383 418 L350 404 Q316 421 287 401 Q253 410 230 382 Q216 380 216 343Z',
  ]
  const base = l === 4 || l === 7 || l === 8 ? c[0] : c[2]
  let art = path(silhouettes[l - 1], base)
  if (l === 1) art += path('M254 345 L271 370 L264 395 L244 373Z', cream, 3) + patch(337, 381, c[1])
  if (l === 2) art += path('M275 367 Q291 349 311 368 Q336 404 300 411 Q277 407 275 367Z', c[1], 4) + stroke('M282 376 L307 380', c[3], 4)
  if (l === 3) art += box(272, 366, 69, 26, 5, c[0], 3) + at(282, 376, 0.18, 0, toast()) + at(307, 376, 0.18, 0, fish(c[1])) + at(330, 380, 0.18, 0, friedEgg())
  if (l === 4) art += path('M241 339 L263 346 L283 378 L274 395 L251 379Z', c[2], 3) + knot(330, 386, c[1])
  if (l === 5 || l === 9) art += stroke('M238 348 Q272 390 301 386 Q332 371 344 377 L384 398', c[0], 10) + dot(273, 373, 12, c[1], 3) + dot(317, 386, 10, c[1], 3) + dot(365, 391, 11, c[1], 3)
  if (l === 6) art += path('M264 353 L280 364 L296 397 L280 398 L259 370Z', c[1], 3) + at(343, 387, 0.28, 0, moonRock(true))
  if (l === 7) art += stroke('M252 345 L281 376 L317 382 L335 367 L372 393', c[2], 5) + dot(280, 376, 6, c[1], 2) + dot(335, 367, 6, c[1], 2)
  if (l === 8) art += path('M246 337 L277 350 L296 383 L280 404 L264 378Z', c[2], 4) + path('M336 350 L368 357 L384 382 L370 401 L344 379Z', c[2], 4) + knot(326, 389, c[1])
  return art
}
function astronaut(l: number, c: Colors): StoryArt {
  let head = ''
  let back = ''
  let props = ''
  switch (l) {
    case 1:
      head = path('M-128 6 L-89 -57 L8 -121 L94 -44 L125 10Z', c[2]) + path('M-88 -56 L8 -121 L-3 -29Z', cream, 4) + path('M-129 6 L-124 -18 L2 -38 L123 -13 L126 16 L-2 30Z', c[0]) + box(-24, -71, 34, 19, 3, c[1], 3)
      props = desk(at(-38, -1, 0.62, -10, path('M-57 -15 L51 -23 L55 11 L-57 16Z', c[3], 4) + oval(-56, 0, 11, 15, c[1], 3)) + at(48, -2, 0.46, 7, sealedFish(c)))
      break
    case 2:
      head = path('M-111 9 Q-119 -58 -69 -89 Q-22 -131 39 -98 Q84 -94 94 -44 L120 15Z', c[0]) + path('M-126 4 Q-57 -31 2 -10 L106 -4 Q154 15 128 30 L24 33 L-102 24Z', c[1]) + path('M-58 -88 Q-20 -119 25 -93 L43 -14 L-16 -18Z', c[2], 4)
      back = at(565, 318, 0.88, 8, supplyBag(c))
      props = desk(at(-18, -1, 0.46, -12, sealedFish(c)) + at(52, 0, 0.40, 0, fish(c[1])))
      break
    case 3:
      head = path('M-115 8 L-103 -55 Q-87 -83 -39 -85 L52 -74 Q91 -66 111 9Z', c[2]) + path('M-121 8 L-99 -16 L102 -4 L121 15 L104 34 L-108 25Z', c[0])
      head += at(-5, -93, 1, -11, box(-87, -41, 174, 79, 16, c[0]) + box(-71, -26, 143, 48, 10, '#badced', 4) + at(-41, -2, 0.40, 0, toast()) + at(2, -1, 0.41, 0, fish(c[1])) + at(43, 0, 0.36, 0, friedEgg()))
      back = at(567, 318, 0.90, -5, supplyBag(c, false))
      break
    case 4:
      head = path('M-118 10 Q-106 -66 -55 -95 Q-15 -110 18 -84 Q69 -96 95 -45 L123 14Z', c[0]) + path('M-130 10 Q-56 -20 9 -7 L114 -1 L131 19 L81 37 L-101 28Z', c[1])
      head += at(-1, -80, 1, -8, oval(-42, 0, 42, 31, c[3]) + oval(45, 5, 42, 31, c[3]) + oval(-42, -1, 30, 20, '#bbe5ec', 3) + oval(45, 5, 30, 20, '#bbe5ec', 3) + stroke('M0 2 L5 2', c[1], 9))
      back = at(561, 307, 0.77, -4, supplyBag(c)) + stroke('M560 260 Q606 218 582 207 Q552 207 572 244', c[1], 7)
      back += side(oval(0, 0, 43, 38, c[3]) + stroke('M-26 -16 Q23 -31 30 3 Q17 28 -21 19 Q-37 7 -26 -16', c[1], 5) + at(14, 22, 0.35, 19, fish(c[2])), 0.72)
      break
    case 5:
      head = path('M-100 9 Q-96 -34 -55 -45 L47 -39 Q93 -31 105 16 L69 32 L-72 27Z', c[0])
      head += stroke('M-129 -20 Q-153 -130 -64 -173 M-44 -177 Q40 -188 97 -134 M109 -111 Q133 -67 129 -27', c[3], 18) + stroke('M-129 -20 Q-153 -130 -64 -173 M-44 -177 Q40 -188 97 -134 M109 -111 Q133 -67 129 -27', c[2], 11)
      head += box(-148, -39, 40, 52, 14, c[1]) + box(107, -29, 43, 50, 14, c[1]) + at(-50, -168, 0.35, 0, fish(c[1]))
      back = at(564, 315, 0.94, 9, supplyBag(c)) + at(569, 394, 0.37, 14, sealedFish(c))
      back += side(sealedFish(c) + stroke('M-16 -40 Q-43 -55 -29 -66', c[3], 3), 0.64, -14)
      props = desk(at(-37, 0, 0.48, 0, fish(c[1])) + stroke('M-4 8 Q40 -9 82 1', c[3], 4) + oval(85, 0, 16, 7, c[2], 3))
      break
    case 6:
      head = path('M-119 7 L-111 -73 L-69 -116 L-21 -122 L18 -101 L61 -112 L104 -70 L124 10Z', '#b8cadb') + path('M-127 9 L-113 -18 L-48 -28 L-17 -12 L31 -24 L113 -10 L130 17 L94 35 L-105 28Z', c[0])
      head += path('M-100 -70 L-57 -109 L-22 -114 L-17 -79 L-66 -48Z', c[2], 4) + path('M18 -93 L56 -103 L99 -60 L66 -40 L28 -51Z', c[2], 4) + box(-25, -42, 45, 35, 8, c[1], 4)
      back = at(565, 313, 0.85, 5, box(-36, -55, 72, 108, 19, c[1]) + at(-6, -24, 0.53, 0, moonRock()) + at(6, 26, 0.58, 18, moonRock(true)))
      props = desk(at(-60, 1, 0.57, -15, moonRock()) + at(-8, 0, 0.63, 9, moonRock()) + at(53, 0, 0.71, -9, moonRock(true)))
      break
    case 7:
      head = path('M-112 12 L-107 -48 Q-52 -94 1 -63 Q53 -92 106 -39 L123 15Z', c[0]) + path('M-120 7 L-65 -10 L-8 -1 L42 -15 L115 2 L126 27 L-103 31Z', c[2])
      head += stroke('M-75 -56 L-80 -130 L-41 -154 M52 -61 L53 -139 L97 -159', c[3], 10) + box(-59, -170, 46, 31, 8, c[1], 4) + box(84, -176, 35, 32, 8, c[1], 4) + star(-22, -44, 0.60, c[1])
      back = at(564, 314, 0.88, -5, box(-34, -78, 68, 152, 13, c[3]) + stroke('M-13 -54 L12 -23 L-11 3 L13 29 L-11 48', c[1], 5) + at(0, 58, 0.48, 0, fish(c[2])))
      back += side(box(-42, -40, 84, 83, 12, c[2]) + stroke('M-26 -23 L14 -16 L-4 9 L23 21', c[1], 5) + at(19, 26, 0.33, 0, fish(c[0])), 0.70)
      break
    case 8:
      head = path('M-123 3 L-119 -62 Q-79 -117 -15 -104 L85 -80 L108 -29 L125 12Z', c[0]) + path('M-125 -1 Q-74 -36 -11 -22 L106 -16 L138 7 Q117 27 67 31 L-91 28Z', c[2])
      head += path('M-101 -66 Q-24 -107 81 -70 L76 -40 L-92 -34Z', c[1], 4) + at(7, -50, 0.5, 0, fish(c[2])) + box(113, -41, 31, 46, 12, c[1], 4)
      back = at(561, 262, 0.73, -12, box(-42, -29, 84, 55, 13, c[0]) + at(0, -1, 0.43, 0, fish(c[1]))) + at(575, 314, 0.70, 11, box(-42, -29, 84, 55, 13, c[2]) + at(0, -1, 0.43, 0, fish(c[0]))) + at(562, 368, 0.74, -8, box(-42, -29, 84, 55, 13, c[0]) + at(0, -1, 0.43, 0, fish(c[1])))
      props = desk(box(-87, -14, 174, 31, 10, c[3], 4) + Array.from({ length: 8 }, (_, n) => dot(-70 + n * 20, 0, 6.5, n === 7 ? c[1] : c[2], 2)).join(''))
      break
    default:
      head = path('M-107 9 L-99 -38 Q-41 -60 22 -43 L99 -14 L113 17 L59 35 L-86 25Z', c[2])
      head += stroke('M-137 -26 L-146 -107 Q-148 -160 -93 -166 M-69 -170 L21 -178 Q69 -177 84 -153 M104 -135 L139 -99 L144 -31', c[3], 19) + stroke('M-137 -26 L-146 -107 Q-148 -160 -93 -166 M-69 -170 L21 -178 Q69 -177 84 -153 M104 -135 L139 -99 L144 -31', c[2], 11)
      head += box(-155, -38, 43, 57, 14, c[1]) + box(125, -30, 39, 53, 13, c[1]) + at(-19, -160, 0.85, -8, box(-43, -25, 86, 47, 11, c[0]) + at(0, -2, 0.43, 0, fish(c[1])))
      back = at(563, 280, 0.84, -5, supplyBag(c)) + at(570, 365, 0.80, 8, supplyBag([c[2], c[1], c[0], c[3]]))
      back += side(oval(0, 0, 45, 42, c[3]) + Array.from({ length: 9 }, (_, n) => star(-27 + n % 3 * 27, -26 + Math.floor(n / 3) * 26, 0.24, n === 4 ? c[1] : c[2])).join('') + at(32, 34, 0.35, -13, fish(c[1])), 0.72)
      props = desk(at(-53, 0, 0.43, 0, sealedFish(c)) + at(0, 0, 0.43, -8, sealedFish(c)) + at(54, 0, 0.43, 10, sealedFish(c)))
  }
  return { head: cap(head, l === 5 || l === 9 ? 0 : l % 2 ? -5 : 5), back, robe: astroCollar(l, c), desk: props }
}

const broom = (c: Colors, leafAttached = false, crooked = false) => stroke('M-93 0 L14 0', wood, 9) + path('M4 -10 L21 -17 Q46 -24 79 -28 L75 -15 L84 -8 L76 1 L84 11 L77 18 L82 28 Q48 27 20 15 L4 10Z', c[0], 4) + stroke('M18 -10 L72 -18 M20 -2 L72 -4 M20 6 L73 12', '#77542f', 3) + (crooked ? stroke('M65 -21 Q84 -43 100 -25', c[0], 6) : '') + (leafAttached ? at(52, -8, 0.63, -24, smallLeaf()) : '')
function bucket(flipped = false) {
  return flipped
    ? path('M-34 21 L-28 -23 Q0 -36 28 -23 L35 21 Q0 32 -34 21Z', wood, 4) + oval(0, -23, 28, 8, '#d4a777', 3) + stroke('M-24 -13 L-29 17 M1 -15 L1 25 M23 -12 L29 19', '#7b593c', 3) + at(0, -25, 0.45, 5, smallLeaf())
    : stroke('M-27 -15 Q-26 -35 0 -37 Q28 -35 29 -15', '#765335', 5) + path('M-35 -14 L-28 25 Q0 32 27 25 L35 -14Z', wood, 4) + oval(0, -14, 35, 9, '#90c5d2', 3) + stroke('M-17 -8 L-15 23 M11 -8 L13 24', '#7b593c', 3)
}
const towel = (c: Colors) => path('M-50 -16 Q-19 -29 31 -20 L49 -8 L45 20 Q17 29 -41 18Z', c[1], 4) + oval(39, 0, 17, 22, cream, 4) + stroke('M35 -12 Q52 -12 47 4 Q43 14 32 5 Q23 -5 35 -6', c[0], 4) + stroke('M-34 -11 L-22 13 M-14 -15 L-3 17', c[0], 4)
function shaolinCollar(l: number, c: Colors) {
  const shapes = [
    'M221 342 L248 329 L271 351 L301 366 L328 353 L354 356 L391 379 L382 405 L347 390 L320 401 L289 383 L259 390 L233 373 L220 374Z',
    'M220 342 Q242 330 264 345 L291 369 L320 354 L350 351 L394 377 L387 410 L352 394 L322 411 L289 390 L257 398 L219 372Z',
    'M221 343 L256 330 L280 354 L308 363 L331 350 L360 357 L393 379 L384 411 L347 395 L314 412 L285 390 L254 393 L220 374Z',
    'M219 342 Q241 328 263 345 Q290 371 311 359 Q338 340 361 358 Q395 366 400 389 Q404 410 375 416 Q352 406 338 397 Q306 414 281 395 Q251 400 221 374Z',
    'M219 342 L249 329 Q275 350 290 366 L320 355 L348 349 L393 376 L390 411 L356 399 L324 417 L290 393 L257 400 L220 374Z',
    'M219 342 L254 329 L283 356 L307 365 L332 351 L359 351 L393 378 L388 414 L354 399 L325 414 L295 397 L265 400 L238 379 L219 375Z',
    'M219 342 Q245 325 268 346 L299 370 L334 347 Q369 352 396 381 L385 413 L349 393 L320 413 L289 391 L254 399 L219 373Z',
    'M220 342 L250 330 L278 352 L307 362 L337 349 L365 358 L395 380 L389 417 L353 400 L324 417 L290 394 L258 403 L219 375Z',
    'M219 342 Q241 327 264 344 L296 367 Q325 346 350 352 L394 377 L393 410 Q370 421 350 402 Q318 418 291 395 Q258 404 220 375Z',
  ]
  let art = path(shapes[l - 1], l === 1 || l === 4 || l === 7 ? c[1] : c[0])
  const bands = [
    'M234 338 L250 341 L290 384 L280 395 L255 373Z',
    'M238 335 L260 344 L303 389 L285 406 L259 374Z',
    'M234 335 L260 340 L301 380 L292 407 L268 386 L247 366Z',
    'M234 339 Q260 331 286 367 L309 388 L295 408 L267 385 L244 366Z',
    'M229 335 L255 338 Q271 356 303 376 L329 405 L309 414 L273 388 L248 370Z',
    'M231 337 L255 335 L289 367 L316 388 L300 413 L268 385 L244 370Z',
    'M232 335 L263 341 L299 373 L327 405 L307 413 L271 390 L248 367Z',
    'M230 336 L254 335 L285 359 L318 392 L311 415 L279 396 L253 374Z',
    'M232 337 L255 336 L284 361 L311 384 L323 405 L309 415 L276 393 L249 370Z',
  ]
  art += path(bands[l - 1], l === 1 ? cream : l === 4 ? c[0] : c[1], 4)
  if (l === 1) art += knot(303, 383, wood)
  if (l === 2) art += at(329, 385, 0.50, 0, smallLeaf(c[0])) + knot(278, 374, cream)
  if (l === 3) art += stroke('M251 346 L291 391', c[3], 8) + knot(318, 389, wood)
  if (l === 4) art += at(305, 385, 0.54, 15, towel(c))
  if (l === 5 || l === 8 || l === 9) {
    const count = l === 5 ? 5 : l === 8 ? 8 : 9
    const positions = Array.from({ length: count }, (_, n) => ({ x: 257 + n * 115 / (count - 1), y: 356 + Math.sin(n / (count - 1) * Math.PI) * 17 + n * 22 / (count - 1) }))
    art += stroke(`M${positions.map(q => `${q.x} ${q.y}`).join(' L')}`, '#775134', 4)
    art += positions.map((q, n) => dot(q.x, q.y, l === 8 && n % 2 ? 7 : 8.5, wood, 3)).join('')
  }
  if (l === 6) art += stroke('M244 345 L280 382 M251 339 L288 375', c[3], 5) + box(312, 382, 22, 18, 5, wood, 3)
  if (l === 7) art += patch(277, 377, c[3]) + knot(331, 389, wood)
  if (l === 8) art += stroke('M241 344 L277 385 L302 403', c[2], 9)
  if (l === 9) art += stroke('M245 347 L257 359 M271 371 L285 383 M300 394 L315 403', c[3], 7)
  return art
}
function shaolin(l: number, c: Colors): StoryArt {
  let back = ''
  let props = ''
  switch (l) {
    case 1:
      props = desk(at(0, 0, 0.72, 0, broom(c, true)))
      break
    case 2:
      back = at(565, 326, 0.87, 8, path('M-25 -54 Q-6 -70 21 -52 L30 -20 Q50 14 23 53 Q-6 66 -31 43 Q-44 18 -27 -14Z', c[1]) + knot(-3, -50, c[0]))
      props = desk(at(-18, 0, 0.50, -12, bucket()) + at(50, 1, 0.66, 0, path('M0 -24 Q-19 3 -14 14 Q0 26 15 13 Q20 1 0 -24Z', '#90c5d2', 4)))
      break
    case 3:
      back = at(565, 307, 1, 12, stroke('M-1 91 L-9 -74', wood, 13) + stroke('M-15 -55 L0 -56 M-12 -43 L3 -44', c[3], 7) + at(-13, -69, 0.55, -50, smallLeaf()) + at(12, -43, 0.52, 30, smallLeaf()) + at(-8, -18, 0.49, -40, smallLeaf()))
      props = desk(at(-6, 0, 0.74, 0, broom(c)))
      break
    case 4:
      back = at(567, 309, 0.82, 9, path('M-12 -8 Q-41 -19 -35 -49 Q-29 -64 -10 -50 Q14 -27 12 -9 Q42 9 36 39 Q29 56 10 42 Q-12 18 -12 -8Z', c[1]) + stroke('M-23 -44 Q-18 -20 -2 -9 M10 7 Q27 20 24 38', cream, 7) + knot(0, -3, c[0]) + at(3, 66, 0.48, 0, path('M0 -25 Q-21 4 -14 16 Q0 30 16 15 Q22 3 0 -25Z', '#90c5d2', 4)))
      props = desk(at(-43, 0, 0.74, -5, towel(c)) + at(51, 3, 0.50, 7, bucket()) + dot(14, 2, 4, c[2], 2))
      break
    case 5:
      back = at(560, 327, 0.85, 10, box(-33, -50, 65, 97, 15, c[1]) + stroke('M-19 -67 L-17 36 M12 -87 L12 36', wood, 11) + path('M-29 -60 L-5 -60 L-2 -35 L-29 -34Z', c[0], 4) + knot(1, 21, c[3]))
      props = desk(at(-45, 0, 0.50, -3, bucket(true)) + at(55, 1, 0.50, 0, broom(c)))
      break
    case 6:
      back = at(566, 316, 0.76, -4, box(-37, -82, 74, 172, 13, c[1]) + stroke('M-22 -61 L-22 64 M1 -63 L1 58 M24 -59 L24 62', wood, 8) + path('M-32 -70 L-10 -70 L-9 -40 L-33 -40Z', c[0], 4) + at(1, -57, 0.36, 0, towel(c)))
      props = desk(at(-4, 1, 0.66, 0, broom(c, false, true)))
      break
    case 7:
      back = at(566, 311, 0.84, 8, stroke('M-13 -90 L3 87', wood, 15) + stroke('M-30 -67 L21 -67', c[0], 9) + path('M-23 -56 L17 -56 L25 7 L-25 11Z', c[1], 4) + knot(-2, -24, c[3]))
      props = desk(at(-46, 0, 0.50, -5, bucket()) + at(43, 0, 0.48, 6, bucket()) + at(39, -9, 0.42, -2, smallLeaf()))
      break
    case 8:
      back = at(567, 317, 0.84, -6, stroke('M0 -70 L0 -4', wood, 12) + path('M-27 -12 L27 -12 L40 39 Q0 57 -39 37Z', c[1]) + path('M-24 -2 L22 -2 L29 29 Q0 40 -28 27Z', cream, 4) + at(23, 32, 0.64, 35, smallLeaf()) + stroke('M-36 38 Q0 54 37 39', wood, 7))
      props = desk(oval(-22, 6, 56, 13, cream, 4) + at(-50, 0, 0.50, 5, smallLeaf()) + at(-18, -2, 0.59, -8, smallLeaf()) + at(8, 3, 0.50, 15, smallLeaf()) + stroke('M-78 7 Q-20 33 35 10', wood, 5) + at(73, 0, 0.35, 0, broom(c)))
      break
    default:
      props = desk(box(-90, -17, 124, 34, 13, c[3], 4) + at(-31, -1, 0.64, -8, smallLeaf()) + at(81, 3, 0.36, 0, broom(c)))
  }
  return { head: '', back, robe: shaolinCollar(l, c), desk: props }
}

const defaults: Record<string, Colors> = {
  wizard: ['#8e63d9', '#ffe168', '#a8e7d4', '#ee7168'],
  astronaut: ['#4b85e8', '#ff9b45', '#dcefff', '#485972'],
  shaolin: ['#dca14a', '#8c9291', '#c87954', '#efe4ce'],
}
/** Returns null for other themes so the main renderer retains ownership of them. */
export function renderStoryArt(themeId: string, level: number, colors: readonly string[]): StoryArt | null {
  const fallback = defaults[themeId]
  if (!fallback) return null
  const c = fallback.map((value, index) => /^#[\da-f]{6}$/i.test(colors[index] ?? '') ? colors[index] : value) as unknown as Colors
  const l = Number.isFinite(level) ? Math.max(1, Math.min(9, Math.trunc(level))) : 1
  if (themeId === 'wizard') return wizard(l, c)
  if (themeId === 'astronaut') return astronaut(l, c)
  return shaolin(l, c)
}
