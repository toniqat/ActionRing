/**
 * Derives consistent button colors from slot configuration.
 *
 * Rule: the user's chosen color (bgColor) becomes the **icon** color;
 * the button background is a pale / translucent version of that color.
 * If `iconColor` is explicitly set it takes priority over `bgColor` for the icon.
 */
export function getSlotButtonColors(
  slot: { bgColor?: string; iconColor?: string },
  defaults: {
    iconColor: string
    bg: string
    bgActive: string
  },
  isActive: boolean = false
): { iconColor: string; bg: string } {
  const base = slot.bgColor

  if (base) {
    return {
      iconColor: slot.iconColor ?? base,
      bg: isActive ? base + '44' : base + '22',
    }
  }

  return {
    iconColor: slot.iconColor ?? defaults.iconColor,
    bg: isActive ? defaults.bgActive : defaults.bg,
  }
}
