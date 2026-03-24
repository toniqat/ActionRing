import { BUILTIN_ICON_MAP } from '@shared/icons'

interface SegmentIconProps {
  icon: string
  iconIsCustom: boolean
  size?: number
}

export function SegmentIcon({ icon, iconIsCustom, size = 24 }: SegmentIconProps): JSX.Element {
  if (iconIsCustom) {
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

  return (
    <span
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: size, height: size, flexShrink: 0, color: 'var(--ring-icon-color)' }}
      dangerouslySetInnerHTML={{ __html: builtinIcon.svg.replace('width="24" height="24"', `width="${size}" height="${size}"`) }}
    />
  )
}
