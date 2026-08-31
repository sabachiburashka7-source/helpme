// Palette is unchanged — the glassmorphism pass only adds translucent
// derivatives of these exact colors. Do not re-tint the brand here.
export const colors = {
  bg: '#F7F7F8',
  surface: '#FFFFFF',
  surfaceAlt: '#F4F4F5',
  border: '#E4E4E7',
  borderStrong: '#D4D4D8',

  text: '#0A0A0A',
  textSecondary: '#52525B',
  textTertiary: '#A1A1AA',
  textMuted: '#D4D4D8',

  accent: '#7A1230',
  accentHover: '#5A0E25',
  accentPress: '#3D0612',
  accentSoft: '#FBEFF3',
  accentSoftBorder: '#F0CCD7',
  accentDeep: '#3D0612',

  danger: '#DC2626',
  dangerSoft: '#FEF2F2',

  shadow: 'rgba(15, 15, 30, 0.08)',
  shadowStrong: 'rgba(15, 15, 30, 0.18)',
};

// Translucent versions of the palette above. Glass panels are white at a
// low alpha so the ambient background reads through them; the bright rim
// (`stroke`) plus the diagonal `sheen` gradient is what makes a flat
// translucent rectangle actually look like a pane of glass.
export const glass = {
  fill: 'rgba(255, 255, 255, 0.58)',
  fillStrong: 'rgba(255, 255, 255, 0.78)',
  fillSoft: 'rgba(255, 255, 255, 0.36)',
  fillHollow: 'rgba(255, 255, 255, 0.14)',

  stroke: 'rgba(255, 255, 255, 0.75)',
  strokeSoft: 'rgba(228, 228, 231, 0.9)',
  strokeInner: 'rgba(255, 255, 255, 0.9)',

  // #7A1230 at low alpha — tinted glass, still the brand color.
  accentFill: 'rgba(122, 18, 48, 0.09)',
  accentFillMd: 'rgba(122, 18, 48, 0.15)',
  accentFillStrong: 'rgba(122, 18, 48, 0.88)',
  accentStroke: 'rgba(122, 18, 48, 0.22)',
  accentStrokeStrong: 'rgba(122, 18, 48, 0.42)',
  accentGlow: 'rgba(122, 18, 48, 0.30)',

  // Smoked glass, for chips laid over photography.
  darkFill: 'rgba(10, 10, 10, 0.42)',
  darkFillStrong: 'rgba(10, 10, 10, 0.62)',
  darkStroke: 'rgba(255, 255, 255, 0.30)',

  dangerFill: 'rgba(220, 38, 38, 0.10)',
  dangerStroke: 'rgba(220, 38, 38, 0.26)',

  // Diagonal light pass across a panel. Top-left catches the light.
  sheen: ['rgba(255, 255, 255, 0.38)', 'rgba(255, 255, 255, 0.06)', 'rgba(255, 255, 255, 0)'],
  sheenSoft: ['rgba(255, 255, 255, 0.20)', 'rgba(255, 255, 255, 0)'],
  sheenDark: ['rgba(255, 255, 255, 0.18)', 'rgba(255, 255, 255, 0)'],

  // Backdrop behind modal glass.
  scrim: 'rgba(10, 10, 18, 0.42)',
};

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 26,
  xxl: 32,
  glass: 26,
  pill: 999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const typography = {
  display: { fontSize: 30, fontWeight: '800', letterSpacing: -0.8, color: colors.text },
  h1: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3, color: colors.text },
  h2: { fontSize: 17, fontWeight: '700', color: colors.text },
  body: { fontSize: 14, color: colors.text, lineHeight: 20 },
  bodySecondary: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  caption: { fontSize: 12, color: colors.textSecondary },
  label: {
    fontSize: 11,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '600',
  },
};

export const shadows = {
  // Android note: `elevation` on a translucent view with a large
  // `borderRadius` paints a fill inset from the edges by the radius — it
  // shows up as a hard-edged bright rectangle inside the panel. Glass
  // surfaces therefore carry NO elevation; their bright rim and the
  // translucent fill do the floating. Elevation is only used on opaque
  // things (the accent button, image frames).
  glass: {
    shadowColor: '#0F0F1E',
    shadowOpacity: 0.1,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 0,
  },
  glassLifted: {
    shadowColor: '#0F0F1E',
    shadowOpacity: 0.16,
    shadowRadius: 34,
    shadowOffset: { width: 0, height: 18 },
    elevation: 0,
  },
  glassSubtle: {
    shadowColor: '#0F0F1E',
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 0,
  },
  card: {
    shadowColor: '#0F0F1E',
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  cardHover: {
    shadowColor: '#0F0F1E',
    shadowOpacity: 0.14,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 14 },
    elevation: 8,
  },
  button: {
    shadowColor: '#7A1230',
    shadowOpacity: 0.32,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
};

export const transitions = {
  fast: 'all 140ms cubic-bezier(0.2, 0.8, 0.2, 1)',
  base: 'all 200ms cubic-bezier(0.2, 0.8, 0.2, 1)',
  slow: 'all 320ms cubic-bezier(0.2, 0.8, 0.2, 1)',
};
