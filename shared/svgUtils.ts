/**
 * Strips potentially dangerous elements and attributes from SVG strings.
 * Removes: <script> tags, event handler attributes (on*), javascript: URIs.
 */
export function sanitizeSvg(svg: string): string {
  return svg
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '')
    .replace(/\s+href\s*=\s*["']?\s*javascript:[^"'\s>]*/gi, '')
    .replace(/\s+xlink:href\s*=\s*["']?\s*javascript:[^"'\s>]*/gi, '')
}

/**
 * Prepares a resource SVG (Material Design icon format) for inline rendering.
 * - Replaces hardcoded fill color with currentColor so CSS color applies
 * - Replaces width/height with the requested size
 */
export function prepareResourceSvg(svg: string, size: number): string {
  return sanitizeSvg(svg)
    .replace(/(<svg\b[^>]*?)\sfill="(?!none)[^"]*"/, `$1 fill="currentColor"`)
    .replace(/(<svg\b[^>]*?)\swidth="[^"]*"/, `$1 width="${size}"`)
    .replace(/(<svg\b[^>]*?)\sheight="[^"]*"/, `$1 height="${size}"`)
}

/**
 * Prepares any SVG string for inline display at the given size.
 * - Material Design icons (viewBox="0 -960 960 960"): applies currentColor + size
 * - All other SVGs: sanitizes and adjusts width/height attributes
 */
export function prepareSvgForDisplay(svg: string, size: number): string {
  if (svg.includes('viewBox="0 -960 960 960"')) {
    return prepareResourceSvg(svg, size)
  }
  return sanitizeSvg(svg)
    .replace(/(<svg\b[^>]*?)\swidth="[^"]*"/, `$1 width="${size}"`)
    .replace(/(<svg\b[^>]*?)\sheight="[^"]*"/, `$1 height="${size}"`)
}
