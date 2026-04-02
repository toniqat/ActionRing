import { BUILTIN_ICON_MAP } from '@shared/icons'
import { SVGIcon } from '@shared/SVGIcon'
import { svgIconCache } from '../svgIconCache'

interface SegmentIconProps {
  icon: string
  iconIsCustom: boolean
  size?: number
  color?: string
}

export function SegmentIcon({ icon, iconIsCustom, size = 24, color }: SegmentIconProps): JSX.Element {
  if (iconIsCustom) {
    const svgString = svgIconCache.get(icon)
    if (svgString) {
      return <SVGIcon svgString={svgString} size={size} color={color ?? 'var(--ring-icon-color)'} />
    }
    // Fallback to <img> for non-SVG custom icons (PNG, JPG, ICO)
    return (
      <img
        src={`file://${icon}`}
        alt=""
        style={{ width: size, height: size, objectFit: 'contain' }}
      />
    )
  }

  const builtinIcon = BUILTIN_ICON_MAP[icon]
  if (!builtinIcon) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: 'var(--ring-icon-color)',
          opacity: 0.3
        }}
      />
    )
  }

  return <SVGIcon svgString={builtinIcon.svg} size={size} color={color ?? 'var(--ring-icon-color)'} />
}
