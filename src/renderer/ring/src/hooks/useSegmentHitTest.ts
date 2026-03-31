// Converts mouse position relative to ring center → segment index (0-7)
// Segment 0 = top (270° or -90°), going clockwise

export function getSegmentIndex(
  mouseX: number,
  mouseY: number,
  centerX: number,
  centerY: number,
  numSlots: number,
  innerDeadZone: number = 30
): number | null {
  const dx = mouseX - centerX
  const dy = mouseY - centerY
  const distance = Math.sqrt(dx * dx + dy * dy)

  if (distance < innerDeadZone) return null

  // atan2 returns angle from -π to π, with 0 = right (east)
  // We want 0 = top (north), going clockwise
  let angle = Math.atan2(dy, dx) // -π to π, 0 = east
  angle = angle + Math.PI / 2    // rotate so 0 = north
  if (angle < 0) angle += 2 * Math.PI // normalize to 0–2π

  // Each slot i is visually centered at i * segmentAngle.
  // Adding half a segment before flooring ensures the detection sector is
  // centered on the button rather than starting at its position.
  // Sector for slot i: [(i - 0.5) * segmentAngle, (i + 0.5) * segmentAngle)
  const segmentAngle = (2 * Math.PI) / numSlots
  const index = Math.floor((angle + segmentAngle / 2) / segmentAngle) % numSlots
  return index
}

export function useSegmentHitTest(
  numSlots: number,
  centerX: number,
  centerY: number,
  innerDeadZone: number = 30
): (mouseX: number, mouseY: number) => number | null {
  return (mouseX: number, mouseY: number) =>
    getSegmentIndex(mouseX, mouseY, centerX, centerY, numSlots, innerDeadZone)
}
