/**
 * Sub-ring angle calculation — shared between the ring overlay and the settings preview.
 *
 * Uses arc-length-preserving spacing: the pixel gap between sub-slots matches
 * the gap between primary ring slots, so the sub-ring feels equally dense
 * regardless of its larger radius.
 */
export function getSubSlotAngle(
  folderAngle: number,
  subIndex: number,
  numSubs: number,
  numPrimarySlots: number,
  radius: number,
  subRadius: number,
): number {
  if (numSubs === 1) return folderAngle
  const arcGap = (2 * Math.PI * radius) / numPrimarySlots
  const step = arcGap / subRadius
  const totalArc = (numSubs - 1) * step
  return folderAngle - totalArc / 2 + subIndex * step
}
