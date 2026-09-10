import { pawPorts } from './key-paw-ports'

/**
 * Join only the original open wrist to a fixed shoulder. The hand below the
 * measured opening remains the upstream bitmap, including its contact point.
 */
export function keyPawBridge(src: string, anchorY: number, contactY: number, offsetY: number) {
  const port = pawPorts[src]
  const span = contactY - anchorY
  if (!port || offsetY <= 0 || !Number.isFinite(offsetY) || !Number.isFinite(span) || span <= 0) return null
  const scaleY = 1 + offsetY / span
  const rows = port.edges.map(([y, left, right]) => [anchorY + (y - anchorY) * scaleY, left, right])
  const [y, left, right] = rows[0]
  const last = rows[rows.length - 1]
  const leftSlope = (last[1] - left) / (last[0] - y)
  const rightSlope = (last[2] - right) / (last[0] - y)
  // Upstream's "right" key group is the paw on the viewer's left.
  const onLeft = port.side === 'right'
  const outerTop = onLeft
    ? `M174 310 C154 323 ${left - leftSlope * 20} ${y - 20} ${left} ${y}`
    : `M397 352 C400 374 ${left - leftSlope * 20} ${y - 20} ${left} ${y}`
  const outer = `${outerTop} ${rows.slice(1).map(([y, left]) => `L${left} ${y}`).join(' ')}`
  const reverse = [...rows].reverse()
  const [bottomY, , bottomRight] = reverse[0]
  const innerBottom = reverse.slice(1).map(([y, , right]) => `L${right} ${y}`).join(' ')
  const innerTop = onLeft
    ? `C${right - rightSlope * 20} ${y - 20} 223 338 223 320`
    : `C${right - rightSlope * 20} ${y - 20} 442 386 441 374`
  const fill = `${outer} L${bottomRight} ${bottomY} ${innerBottom} ${innerTop} ${onLeft ? 'L205 320 Q190 317 174 310 Z' : 'L444 355 Z'}`
  // End the hidden connector stroke two source rows before its fill overlap.
  // Round caps must stay inside that overlap rather than darken the original
  // bitmap's outline immediately below the join.
  const strokeRows = rows.slice(0, -2)
  const [strokeY, , strokeRight] = strokeRows[strokeRows.length - 1]
  const outerStroke = `${outerTop} ${strokeRows.slice(1).map(([y, left]) => `L${left} ${y}`).join(' ')}`
  const innerStroke = `M${strokeRight} ${strokeY} ${[...strokeRows].reverse().slice(1).map(([y, , right]) => `L${right} ${y}`).join(' ')} ${innerTop}`
  return {
    cut: port.cut,
    outer: outerStroke,
    inner: innerStroke,
    fill,
    // The parent group preserves the original affine paw transform; undo it
    // locally for this connector so its shoulder stays on the dressed body.
    inverse: `translate(0 ${anchorY}) scale(1 ${1 / scaleY}) translate(0 ${-anchorY})`,
  }
}
