/* eslint-disable test/no-import-node-test -- Uses Node's built-in runner. */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { it } from 'node:test'
import { fileURLToPath } from 'node:url'

import type { SleeveArmConfig, SleevePoint } from './sleeve-arm'

import interactions from '../../data/interaction-paws.json'
import { catPointerPalm, interactionPalm, sleeveArmGeometry } from './sleeve-arm'
import measuredContacts from './sleeve-paw-contacts.json'

const pointerConfig: SleeveArmConfig = {
  root: { x: 211, y: 384 },
  cuff: { width: 72, angle: 8 },
  palm: { width: 72, height: 44 },
  faceBox: { x: 233, y: 300, width: 154, height: 70 },
}
const keyboardConfig: SleeveArmConfig = {
  root: { x: 431, y: 408 },
  cuff: { width: 76, angle: -5 },
  palm: { width: 72, height: 44 },
  faceBox: { x: 233, y: 300, width: 154, height: 70 },
}
const corners: [SleevePoint, SleevePoint][] = [
  [{ x: 1, y: -1 }, { x: 45, y: 454 }],
  [{ x: -1, y: -1 }, { x: 148, y: 493 }],
  [{ x: -1, y: 1 }, { x: 212, y: 435 }],
  [{ x: 1, y: 1 }, { x: 87, y: 414 }],
]

it('maps the four explicit user directions to the four cat-view extrema and bilinear centre', () => {
  for (const [input, expected] of corners) assert.deepEqual(catPointerPalm(input, false, 36), expected)
  assert.deepEqual(catPointerPalm({ x: 0, y: 0 }, false, 36), { x: 123, y: 449 })
  assert.deepEqual(catPointerPalm({ x: 0, y: -1 }, false, 36), { x: 96.5, y: 473.5 })
})

it('keeps the extra pointer mirror isolated from the outer scene mirror', () => {
  for (const [input] of corners) {
    assert.deepEqual(catPointerPalm(input, true, 36), catPointerPalm({ x: -input.x, y: input.y }, false, 36))
    // Outer mirroring is the same single x'=612-x operation for device and paw.
    const actual = catPointerPalm(input, false, 36)
    const target = corners.find(([point]) => point.x === input.x && point.y === input.y)![1]
    assert.equal(612 - actual.x, 612 - target.x)
  }
  assert.deepEqual(catPointerPalm({ x: 1, y: -1 }, true, 36), { x: 148, y: 493 })
})

it('fixes the same root and sleeve edges for rest, all corners, clicks, and every original key', () => {
  const targets = [pointerConfig.root, ...corners.map(([, point]) => point), ...Object.keys(measuredContacts).map(src => interactionPalm(src, 36)!)]
  const roots = targets.map(point => sleeveArmGeometry(pointerConfig, point, 6))
  for (const arm of roots) {
    assert.deepEqual(arm.root, pointerConfig.root)
    assert.deepEqual(arm.rootEdges, roots[0]!.rootEdges)
    assert.equal(arm.sections[0]!.center.x, pointerConfig.root.x)
    assert.equal(arm.sections[0]!.center.y, pointerConfig.root.y)
  }
})

it('retains round-palm thickness on the diagonal reaches instead of horizontal-only width', () => {
  for (const [input] of corners) {
    const geometry = sleeveArmGeometry(pointerConfig, catPointerPalm(input, false, 36))
    for (const section of geometry.sections.filter(section => section.t >= 0.2 && section.t <= 0.75)) {
      // Actual Euclidean distance across the two outlines must meet the brief,
      // even for the almost-horizontal right-down to top-corner pose.
      assert.ok(Math.hypot(section.right.x - section.left.x, section.right.y - section.left.y) >= 72 * 0.85)
      const index = geometry.sections.indexOf(section)
      const before = geometry.sections[index - 1]!.center
      const after = geometry.sections[index + 1]!.center
      const across = { x: section.right.x - section.left.x, y: section.right.y - section.left.y }
      const along = { x: after.x - before.x, y: after.y - before.y }
      // A wide X range alone is not a thick arm: width must be perpendicular.
      const cosine = Math.abs(across.x * along.x + across.y * along.y) / (Math.hypot(across.x, across.y) * Math.hypot(along.x, along.y))
      assert.ok(cosine < 0.015)
    }
    assert.equal(geometry.contact.y, geometry.palm.y + 22)
  }
})

it('the rendered envelope keeps its mid-arm thickness after resolving tight-turn overlap', () => {
  for (const [, target] of corners) {
    const geometry = sleeveArmGeometry(pointerConfig, target)
    for (const section of geometry.sections.filter(section => section.t >= 0.3 && section.t <= 0.7)) {
      const across = { x: (section.right.x - section.left.x) / section.width, y: (section.right.y - section.left.y) / section.width }
      const intersections: number[] = []
      // Intersect a perpendicular line with the actual final polygon, rather
      // than trusting the radius values used to construct the centreline.
      for (let index = 0; index < geometry.contour.length; index++) {
        const a = geometry.contour[index]!
        const b = geometry.contour[(index + 1) % geometry.contour.length]!
        const edge = { x: b.x - a.x, y: b.y - a.y }
        const det = across.x * edge.y - across.y * edge.x
        if (Math.abs(det) < 0.000001) continue
        const delta = { x: a.x - section.center.x, y: a.y - section.center.y }
        const u = (delta.x * across.y - delta.y * across.x) / det
        if (u < 0 || u > 1) continue
        intersections.push((delta.x * edge.y - delta.y * edge.x) / det)
      }
      assert.ok(intersections.length >= 2)
      assert.ok(Math.max(...intersections) - Math.min(...intersections) >= 72 * 0.85)
    }
    // Every consecutive turn in a convex outer envelope has the same sign;
    // inward spurs visible in the first SVG prototype cannot pass this check.
    for (let index = 0; index < geometry.contour.length; index++) {
      const a = geometry.contour[index]!
      const b = geometry.contour[(index + 1) % geometry.contour.length]!
      const c = geometry.contour[(index + 2) % geometry.contour.length]!
      assert.ok((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x) >= -0.001)
    }
  }
})

it('covers all 126 original keys with immutable-source measured distal contacts', () => {
  const root = fileURLToPath(new URL('../../../', import.meta.url))
  assert.equal(Object.keys(measuredContacts).length, Object.keys(interactions).length)
  for (const item of Object.values(interactions)) {
    const contact = measuredContacts[item.pawSrc as keyof typeof measuredContacts]
    assert.ok(contact, item.pawSrc)
    assert.equal(createHash('sha256').update(readFileSync(`${root}public${item.pawSrc}`)).digest('hex'), contact.sourceSHA256)
    const palm = interactionPalm(item.pawSrc, 36)!
    assert.equal(palm.y + 22, item.contactY + 36)
    assert.equal(palm.x, contact.x)
    assert.ok(palm.x > 0 && palm.x < 612)
    const config = item.pawSrc.includes('/left-paws/') ? keyboardConfig : pointerConfig
    const geometry = sleeveArmGeometry(config, palm)
    assert.ok(!/NaN|Infinity/.test(geometry.path))
    assert.deepEqual(geometry.root, config.root)
  }
})

it('aligns Num1, Num6, Num9, Num0, Q and Space with their measured original contact lines', () => {
  const expected = {
    Num1: [479.491, 535],
    Num6: [380.007, 507],
    Num9: [322.377, 498],
    Num0: [313.255, 493],
    KeyQ: [468.711, 519],
    Space: [428.783, 452],
  }
  for (const [key, [x, contactY]] of Object.entries(expected)) {
    const src = `/interaction/keyboard/left-keys/${key}.png`
    const geometry = sleeveArmGeometry(keyboardConfig, interactionPalm(src, 36)!)
    assert.deepEqual(geometry.contact, { x, y: contactY })
    assert.equal(geometry.faceClear, true, key)
  }
  assert.equal(interactionPalm('/unknown.png'), undefined)
})

it('routes the contour below a protected expression without moving a valid root or contact', () => {
  const geometry = sleeveArmGeometry(keyboardConfig, { x: 313.255, y: 471 })
  assert.deepEqual(geometry.root, keyboardConfig.root)
  assert.deepEqual(geometry.palm, { x: 313.255, y: 471 })
  assert.equal(geometry.faceClear, true)
  // A misplaced cuff inside the face cannot be repaired by secretly moving it.
  const invalid = sleeveArmGeometry({ ...keyboardConfig, root: { x: 300, y: 330 } }, { x: 330, y: 471 })
  assert.deepEqual(invalid.root, { x: 300, y: 330 })
  assert.equal(invalid.faceClear, false)
})

it('handles non-finite input, excessive movement, coincident endpoints and malformed dimensions', () => {
  assert.deepEqual(catPointerPalm({ x: Number.NaN, y: Infinity }, false, Number.NaN), { x: 123, y: 413 })
  assert.deepEqual(catPointerPalm({ x: 1e8, y: -1e8 }, false, 36), { x: 45, y: 454 })
  for (const target of [{ x: Number.NaN, y: Infinity }, { x: 1e15, y: -1e15 }, pointerConfig.root]) {
    const arm = sleeveArmGeometry({ ...pointerConfig, cuff: { width: -10, angle: Infinity }, palm: { width: Number.NaN, height: -10 } }, target, Infinity)
    assert.ok(!/NaN|Infinity/.test(arm.path + arm.cuffPath))
    assert.ok(arm.sections.every(section => [section.left.x, section.left.y, section.right.x, section.right.y].every(Number.isFinite)))
  }
})
