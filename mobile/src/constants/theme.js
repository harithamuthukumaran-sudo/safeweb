/**
 * SafeWeb shared design tokens — colours, spacing, typography, shadows.
 * Import this in every screen and component for consistency.
 */
export const colors = {
  // Backgrounds
  bg:        '#050d1a',
  surface:   '#0a1628',
  surfaceAlt:'#0f2040',
  border:    'rgba(255,255,255,0.08)',
  borderFocus:'rgba(0,212,255,0.5)',

  // Brand
  cyan:      '#00d4ff',
  purple:    '#8b5cf6',
  emerald:   '#10b981',
  amber:     '#f59e0b',
  rose:      '#f43f5e',

  // Text
  textPrimary:   '#ffffff',
  textSecondary: 'rgba(255,255,255,0.6)',
  textMuted:     'rgba(255,255,255,0.3)',
}

export const gradients = {
  brand:    [colors.cyan, colors.purple],
  safe:     ['#10b981', '#059669'],
  suspicious:['#f59e0b', '#d97706'],
  dangerous: ['#f43f5e', '#dc2626'],
  bg:        ['#050d1a', '#0a1628'],
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
}

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
}

export const fontSize = {
  xs:   11,
  sm:   13,
  base: 15,
  md:   17,
  lg:   20,
  xl:   24,
  xxl:  32,
  hero: 42,
}

export const shadow = {
  cyan:   { shadowColor: '#00d4ff', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8 },
  card:   { shadowColor: '#000',    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 8,  elevation: 4 },
}

export const classificationColors = {
  safe:       { text: colors.emerald, bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.3)' },
  suspicious: { text: colors.amber,   bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.3)' },
  dangerous:  { text: colors.rose,    bg: 'rgba(244,63,94,0.15)',  border: 'rgba(244,63,94,0.3)' },
}
