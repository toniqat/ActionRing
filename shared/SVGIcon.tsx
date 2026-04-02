import { prepareSvgForDisplay } from './svgUtils'

interface SVGIconProps {
  /** Raw SVG markup to render inline */
  svgString: string
  size?: number
  color?: string
  opacity?: number
  style?: React.CSSProperties
}

/**
 * Renders an SVG string as inline markup, enabling full CSS control over colors.
 * Automatically sanitizes the SVG and adjusts its size attributes.
 */
export function SVGIcon({ svgString, size = 24, color, opacity, style }: SVGIconProps): JSX.Element {
  const html = prepareSvgForDisplay(svgString, size)
  return (
    <span
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        flexShrink: 0,
        color,
        opacity,
        ...style,
      }}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
