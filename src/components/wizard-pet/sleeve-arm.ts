import pawContacts from './sleeve-paw-contacts.json'

export interface SleevePoint { x: number, y: number }

export interface SleeveArmConfig {
  /** Fixed centre of the clothing opening, in unmirrored 612 × 580 stage coordinates. */
  root: SleevePoint
  cuff: {
    width: number
    /** Angle of the opening's horizontal axis, in degrees. */
    angle?: number
    /** Small clothing lip, drawn above the arm without moving the root. */
    overlap?: number
    color?: string
    trim?: string
  }
  palm: { width: number, height?: number }
  /** Protected expression area. This routes the arm; it never clips the face. */
  faceBox?: { x: number, y: number, width: number, height: number }
}

export interface SleeveSection {
  t: number
  center: SleevePoint
  left: SleevePoint
  right: SleevePoint
  width: number
}

const finite = (value: number | undefined, fallback: number) => Number.isFinite(value) ? value! : fallback
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value))
const safe = (value: number | undefined, fallback: number) => clamp(finite(value, fallback), -8192, 8192)
const normalized = (value: number) => clamp(finite(value, 0), -1, 1)
const mix = (a: number, b: number, t: number) => a + (b - a) * t
const round = (value: number) => Math.round(value * 1000) / 1000
const coord = (point: SleevePoint) => `${round(point.x)} ${round(point.y)}`

/**
 * User-facing direction, before the optional whole-scene mirror.
 * The extra pointerMirror preference changes only input X. Neither this
 * function nor SleeveArm accepts the whole-cat mirror setting.
 */
export function catPointerPalm(position: SleevePoint, pointerMirror = false, deviceOffsetY = 0): SleevePoint {
  const x = normalized(position.x) * (pointerMirror ? -1 : 1)
  const u = (1 - x) / 2
  const v = (1 - normalized(position.y)) / 2
  const top = { x: mix(87, 212, u), y: mix(378, 399, u) }
  const bottom = { x: mix(45, 148, u), y: mix(418, 457, u) }
  return {
    x: round(mix(top.x, bottom.x, v)),
    y: round(mix(top.y, bottom.y, v) + safe(deviceOffsetY, 0)),
  }
}

const contacts: Record<string, { x: number, contactY: number }> = pawContacts

/**
 * Palm centres measured from every original separated paw's distal contour.
 * X is alpha-weighted across the last four anatomical rows (alpha > 64);
 * contactY is the existing original bottom contact line, including atlas +176.
 * Only the device translation is added: no shoulder or opening PNG is stretched.
 */
export function interactionPalm(src: string, deviceOffsetY = 0, palmHeight = 44): SleevePoint | undefined {
  const path = src.startsWith('/interaction-separated/')
    ? src
    : src.replace('/interaction/', '/interaction-separated/').replace('-keys/', '-paws/')
  const point = contacts[path]
  if (!point) return undefined
  const height = clamp(finite(palmHeight, 44), 16, 120)
  return { x: point.x, y: round(point.contactY + safe(deviceOffsetY, 0) - height / 2) }
}

function cubic(a: SleevePoint, b: SleevePoint, c: SleevePoint, d: SleevePoint, t: number): SleevePoint {
  const s = 1 - t
  return {
    x: s ** 3 * a.x + 3 * s ** 2 * t * b.x + 3 * s * t ** 2 * c.x + t ** 3 * d.x,
    y: s ** 3 * a.y + 3 * s ** 2 * t * b.y + 3 * s * t ** 2 * c.y + t ** 3 * d.y,
  }
}

function tangent(a: SleevePoint, b: SleevePoint, c: SleevePoint, d: SleevePoint, t: number): SleevePoint {
  const s = 1 - t
  const x = 3 * s ** 2 * (b.x - a.x) + 6 * s * t * (c.x - b.x) + 3 * t ** 2 * (d.x - c.x)
  const y = 3 * s ** 2 * (b.y - a.y) + 6 * s * t * (c.y - b.y) + 3 * t ** 2 * (d.y - c.y)
  const length = Math.hypot(x, y)
  return length > 0.0001 ? { x: x / length, y: y / length } : { x: 0, y: 1 }
}

// Catmull-Rom interpolation preserves a smooth outline around the sampled,
// constant-width centre line, including strongly diagonal reaches.
function smoothPath(points: SleevePoint[]): string {
  return points.map((start, index) => {
    const prev = points[(index + points.length - 1) % points.length]!
    const point = points[(index + 1) % points.length]!
    const next = points[(index + 2) % points.length]!
    const first = { x: start.x + (point.x - prev.x) / 6, y: start.y + (point.y - prev.y) / 6 }
    const second = { x: point.x - (next.x - start.x) / 6, y: point.y - (next.y - start.y) / 6 }
    return `C ${coord(first)} ${coord(second)} ${coord(point)}`
  }).join(' ')
}

function segmentIntersection(a: SleevePoint, b: SleevePoint, c: SleevePoint, d: SleevePoint): SleevePoint | undefined {
  const r = { x: b.x - a.x, y: b.y - a.y }
  const s = { x: d.x - c.x, y: d.y - c.y }
  const determinant = r.x * s.y - r.y * s.x
  if (Math.abs(determinant) < 0.000001) return undefined
  const difference = { x: c.x - a.x, y: c.y - a.y }
  const t = (difference.x * s.y - difference.y * s.x) / determinant
  const u = (difference.x * r.y - difference.y * r.x) / determinant
  if (t <= 0.000001 || t >= 0.999999 || u <= 0.000001 || u >= 0.999999) return undefined
  return { x: a.x + t * r.x, y: a.y + t * r.y }
}

/**
 * A tube's inner offset folds when bend radius is smaller than arm radius.
 * Remove those interior loops before drawing an outline; otherwise a valid
 * white fill still acquires little black hooks at the shoulder and wrist.
 * Endpoints stay fixed, and the exterior boundary retains the full arm width.
 */
function exteriorEdge(input: SleevePoint[]): SleevePoint[] {
  const points = [...input]
  for (let start = 0; start < points.length - 3; start++) {
    for (let end = start + 2; end < points.length - 1; end++) {
      const crossing = segmentIntersection(points[start]!, points[start + 1]!, points[end]!, points[end + 1]!)
      if (!crossing) continue
      points.splice(start + 1, end - start, crossing)
      start = Math.max(-1, start - 2)
      break
    }
  }
  return points
}

function roundedEnvelope(points: SleevePoint[]): SleevePoint[] {
  // The stylised paw has one plump silhouette. Taking the outer envelope of
  // its thick sections removes inward wrist/cuff cusps after a tight turn;
  // it can only add width, never turn a diagonal reach into a thin wedge.
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y)
  const cross = (a: SleevePoint, b: SleevePoint, c: SleevePoint) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
  const half = (values: SleevePoint[]) => {
    const result: SleevePoint[] = []
    for (const point of values) {
      while (result.length > 1 && cross(result.at(-2)!, result.at(-1)!, point) <= 0) result.pop()
      result.push(point)
    }
    return result.slice(0, -1)
  }
  return [...half(sorted), ...half([...sorted].reverse())]
}

function overlapsBox(contour: SleevePoint[], box: NonNullable<SleeveArmConfig['faceBox']>): boolean {
  const margin = 3.5 // Outline radius plus subpixel curve interpolation.
  const x1 = box.x - margin
  const y1 = box.y - margin
  const x2 = box.x + box.width + margin
  const y2 = box.y + box.height + margin
  const corners = [{ x: x1, y: y1 }, { x: x2, y: y1 }, { x: x2, y: y2 }, { x: x1, y: y2 }]
  if (contour.some(point => point.x >= x1 && point.x <= x2 && point.y >= y1 && point.y <= y2)) return true
  for (let index = 0; index < contour.length; index++) {
    const a = contour[index]!
    const b = contour[(index + 1) % contour.length]!
    if (corners.some((corner, edge) => segmentIntersection(a, b, corner, corners[(edge + 1) % 4]!))) return true
  }
  // Also catch a rectangle enclosed entirely by the rendered white silhouette.
  let inside = false
  const point = corners[0]!
  for (let index = 0, previous = contour.length - 1; index < contour.length; previous = index++) {
    const a = contour[index]!
    const b = contour[previous]!
    if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}

export function sleeveArmGeometry(config: SleeveArmConfig, target: SleevePoint, pressOffset = 0) {
  const root = { x: safe(config.root.x, 211), y: safe(config.root.y, 384) }
  const palm = { x: safe(target.x, root.x), y: safe(target.y, root.y + 64) + clamp(finite(pressOffset, 0), -12, 12) }
  const palmWidth = clamp(finite(config.palm.width, 72), 24, 140)
  const palmHeight = clamp(finite(config.palm.height, 44), 16, 120)
  // Clothing may be narrower, but the foreground arm may not taper below
  // the approved 85% constraint. A cuff lip conceals this small root overlap.
  const rootWidth = Math.max(palmWidth * 0.9, clamp(finite(config.cuff.width, palmWidth), 24, 160))
  const radians = clamp(finite(config.cuff.angle, 0), -75, 75) * Math.PI / 180
  const direction = { x: -Math.sin(radians), y: Math.cos(radians) }
  const reach = Math.hypot(palm.x - root.x, palm.y - root.y)
  // For a long sideways reach with little vertical room, long vertical
  // handles fold the centreline back on itself. Keep the descent monotone.
  const descent = Math.max(0.1, palm.y - root.y)
  const departure = Math.min(clamp(reach * 0.4, 12, 95), descent * 0.45 / direction.y)
  const arrival = Math.min(clamp(reach * 0.2, 8, 48), descent * 0.45)
  const first = { x: root.x + direction.x * departure, y: root.y + direction.y * departure }
  const second = { x: palm.x, y: palm.y - arrival }
  const face = config.faceBox
  if (face && [face.x, face.y, face.width, face.height].every(Number.isFinite) && face.width > 0 && face.height > 0) {
    const radius = Math.max(rootWidth, palmWidth) / 2 + 3
    const lowX = Math.min(root.x, palm.x) - radius
    const highX = Math.max(root.x, palm.x) + radius
    if (highX > face.x && lowX < face.x + face.width) {
      // Move control points below the expression; root and contact stay exact.
      const floor = face.y + face.height + radius
      first.y = Math.min(palm.y - 0.05, Math.max(first.y, floor))
      second.y = Math.min(palm.y - 0.025, Math.max(second.y, first.y, floor))
    }
  }
  const sections: SleeveSection[] = []
  for (let index = 0; index <= 48; index++) {
    const t = index / 48
    const center = cubic(root, first, second, palm, t)
    const heading = tangent(root, first, second, palm, t)
    // Smoothly widen into the round palm; the forearm itself is 90% palm width.
    const width = t < 0.2
      ? mix(rootWidth, palmWidth * 0.9, t / 0.2)
      : t > 0.75 ? mix(palmWidth * 0.9, palmWidth, (t - 0.75) / 0.25) : palmWidth * 0.9
    // Configured cuff orientation stays fixed even when a face-route adjusts C1.
    const normal = index === 0
      ? { x: Math.cos(radians), y: Math.sin(radians) }
      : index === 48 ? { x: 1, y: 0 } : { x: heading.y, y: -heading.x }
    sections.push({
      t,
      center,
      width,
      left: { x: center.x - normal.x * width / 2, y: center.y - normal.y * width / 2 },
      right: { x: center.x + normal.x * width / 2, y: center.y + normal.y * width / 2 },
    })
  }
  const left = exteriorEdge(sections.map(section => section.left))
  const right = exteriorEdge(sections.map(section => section.right))
  const radiusX = palmWidth / 2
  const radiusY = palmHeight / 2
  const bottom = { x: palm.x, y: palm.y + radiusY }
  const cap = (from: number, to: number) => Array.from({ length: 13 }, (_, index) => {
    const angle = mix(from, to, index / 12)
    return { x: palm.x + Math.cos(angle) * radiusX, y: palm.y + Math.sin(angle) * radiusY }
  })
  // The palm cap can overlap a thick near-horizontal forearm as well. Resolve
  // the complete silhouette, including the cap and cuff closing segment, so
  // neither joint retains an interior black seam. Start at the contact point
  // to preserve it when loops elsewhere on the contour are removed.
  const contour = roundedEnvelope(exteriorEdge([
    ...cap(Math.PI / 2, Math.PI),
    ...[...left].reverse().slice(1),
    ...right,
    ...cap(0, Math.PI / 2).slice(1),
  ]).slice(0, -1))
  const path = `M ${coord(contour[0]!)} ${smoothPath(contour)} Z`
  const overlap = clamp(finite(config.cuff.overlap, 9), 0, 20)
  const lipLeft = left[0]!
  const lipRight = right[0]!
  const lipDown = { x: direction.x * overlap, y: direction.y * overlap }
  const cuffPath = `M ${coord({ x: lipLeft.x - lipDown.x, y: lipLeft.y - lipDown.y })} L ${coord({ x: lipRight.x - lipDown.x, y: lipRight.y - lipDown.y })} L ${coord({ x: lipRight.x + lipDown.x, y: lipRight.y + lipDown.y })} Q ${coord({ x: root.x + lipDown.x * 1.6, y: root.y + lipDown.y * 1.6 })} ${coord({ x: lipLeft.x + lipDown.x, y: lipLeft.y + lipDown.y })} Z`
  const faceClear = !face || !overlapsBox(contour, face)
  return { path, cuffPath, root, palm, contact: bottom, rootEdges: [lipLeft, lipRight] as const, outline: { left, right }, contour, sections, faceClear, palmWidth, palmHeight }
}
