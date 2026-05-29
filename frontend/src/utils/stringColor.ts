/** Stable hue (0–359) from any string — use for per-employee chart/avatar colors. */
export function stringToHue(seed: string): number {
  const value = seed.trim() || 'unknown'
  let h = 0
  for (let i = 0; i < value.length; i++) h = value.charCodeAt(i) + ((h << 5) - h)
  return Math.abs(h) % 360
}

export function stringToHueColor(seed: string) {
  return `hsl(${stringToHue(seed)} 62% 42%)`
}
