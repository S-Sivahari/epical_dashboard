import type { CSSProperties } from 'react'
import { stringToHue, stringToHueColor } from '@/utils/stringColor'

export function getMetalRoutingCardTheme(seed: string) {
  const hue = stringToHue(seed)
  return {
    accent: stringToHueColor(seed),
    bgStart: `hsl(${hue} 82% 96%)`,
    border: `hsl(${hue} 52% 84%)`,
    iconBg: `hsl(${hue} 72% 92%)`,
    iconColor: `hsl(${hue} 48% 36%)`,
  }
}

export function metalRoutingCardStyle(seed: string): CSSProperties {
  const theme = getMetalRoutingCardTheme(seed)
  return {
    '--pdk-card-accent': theme.accent,
    '--pdk-card-icon-bg': theme.iconBg,
    '--pdk-card-icon-color': theme.iconColor,
    background: `linear-gradient(135deg, ${theme.bgStart} 0%, #ffffff 78%)`,
    borderColor: theme.border,
  } as CSSProperties
}

export function metalRoutingListRowStyle(seed: string): CSSProperties {
  const hue = stringToHue(seed)
  const theme = getMetalRoutingCardTheme(seed)
  return {
    '--pdk-card-accent': theme.accent,
    '--pdk-card-icon-bg': theme.iconBg,
    '--pdk-card-icon-color': theme.iconColor,
    '--pdk-card-icon-bg-hover': `hsl(${hue} 68% 91%)`,
    '--pdk-card-icon-color-hover': `hsl(${hue} 44% 32%)`,
    '--pdk-card-bg': `linear-gradient(135deg, ${theme.bgStart} 0%, rgba(255, 255, 255, 0.92) 88%)`,
    '--pdk-card-bg-hover': `linear-gradient(to left, hsl(${hue} 72% 95%) 0%, hsl(${hue} 78% 97%) 42%, rgba(255, 255, 255, 0.94) 100%)`,
    borderBottomColor: theme.border,
  } as CSSProperties
}
