/** Stable hue (0–359) from any string — use for per-employee chart/avatar colors. */
export function stringToHue(seed: string): number {
  const value = seed.trim() || 'unknown'
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = value.charCodeAt(i) + ((hash << 5) - hash)
    hash = hash & hash // Convert to 32bit integer
  }
  // Scramble using Knuth's multiplicative hash to ensure high dispersion
  // for strings with sequential patterns (e.g. 'EMP-0001', 'EMP-0002')
  const scrambled = Math.abs(hash) * 2654435761
  return scrambled % 360
}

export function stringToHueColor(seed: string) {
  return `hsl(${stringToHue(seed)} 62% 42%)`
}
