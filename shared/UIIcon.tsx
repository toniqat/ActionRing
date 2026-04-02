import { UI_ICONS } from './uiIcons'
import { prepareResourceSvg } from './svgUtils'

interface UIIconProps {
  /** Icon name from UI_ICONS registry (e.g. "close", "edit", "launch") */
  name: string
  size?: number
  /** Defaults to currentColor — inherits from parent text color */
  color?: string
  style?: React.CSSProperties
}

/**
 * Renders a named UI icon as inline SVG.
 * Colors are theme-aware via currentColor — set color via CSS on the parent or via the color prop.
 */
export function UIIcon({ name, size = 16, color = 'currentColor', style }: UIIconProps): JSX.Element | null {
  const svg = UI_ICONS[name]
  if (!svg) return null
  const html = prepareResourceSvg(svg, size)
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        flexShrink: 0,
        color,
        lineHeight: 1,
        ...style,
      }}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
