export interface ArmPoint {
  x: number
  y: number
}

export const DEVICE_OFFSET_Y = 36

// The original face atlas ends at local (7.5, 117), placed at (166, 194).
// Start just inside its final dark pixels with the same down-left tangent.
// Using the image rectangle's x=166 instead made an eight-pixel shoulder step.
export const POINTER_SHOULDER = { x: 174, y: 310 }
export const POINTER_INNER_SHOULDER = { x: 242, y: 359 }

// Palm centers follow the perspective of the complete original mouse pad.
// Inset corners allow the rounded paw to reach the edges without clipping
// the viewport or covering adjacent keyboard labels.
const PALM_CORNERS = {
  topLeft: { x: 87, y: 378 },
  topRight: { x: 212, y: 399 },
  bottomLeft: { x: 45, y: 418 },
  bottomRight: { x: 148, y: 457 },
}

const normalized = (value: number) => Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0
const mix = (a: number, b: number, ratio: number) => a + (b - a) * ratio
const n = (value: number) => Math.round(value * 1000) / 1000

export function pointerPalm(position: ArmPoint, mirror = false, deviceOffsetY = 0): ArmPoint {
  const u = (normalized(position.x) * (mirror ? -1 : 1) + 1) / 2
  const v = (normalized(position.y) + 1) / 2
  const top = {
    x: mix(PALM_CORNERS.topLeft.x, PALM_CORNERS.topRight.x, u),
    y: mix(PALM_CORNERS.topLeft.y, PALM_CORNERS.topRight.y, u),
  }
  const bottom = {
    x: mix(PALM_CORNERS.bottomLeft.x, PALM_CORNERS.bottomRight.x, u),
    y: mix(PALM_CORNERS.bottomLeft.y, PALM_CORNERS.bottomRight.y, u),
  }
  return {
    x: n(mix(top.x, bottom.x, v)),
    y: n(mix(top.y, bottom.y, v) + (Number.isFinite(deviceOffsetY) ? deviceOffsetY : 0)),
  }
}

export function pointerArmPath(palm: ArmPoint, pressOffset = 0): string {
  const { x } = palm
  const y = palm.y + pressOffset
  const s = POINTER_SHOULDER
  const t = POINTER_INNER_SHOULDER
  return [
    `M ${s.x} ${s.y}`,
    `C 154 338 ${n(x - 24)} ${n(y - 42)} ${n(x - 36)} ${n(y - 13)}`,
    `C ${n(x - 44)} ${n(y + 6)} ${n(x - 27)} ${n(y + 21)} ${n(x)} ${n(y + 21)}`,
    `C ${n(x + 27)} ${n(y + 21)} ${n(x + 29)} ${n(y + 6)} ${n(x + 38)} ${n(y - 7)}`,
    `C ${n(x + 51)} ${n(y - 29)} 209 366 ${t.x} ${t.y}`,
  ].join(' ')
}

// Keep the original white body to the inside of the same moving outer arm
// contour. A fixed straight shoulder cut produces a triangular hole below
// the inner arm; retaining the old filler produces a second outer shoulder.
export function pointerBodyClip(palm: ArmPoint, pressOffset = 0): string {
  const { x } = palm
  const y = palm.y + pressOffset
  return `M -256 -256 H 868 V 580 H ${n(x - 36)} V ${n(y - 13)} C ${n(x - 24)} ${n(y - 42)} 154 338 174 310 H -256 Z`
}
