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

  accent: '#4F46E5',
  accentHover: '#4338CA',
  accentPress: '#3730A3',
  accentSoft: '#EEF2FF',
  accentSoftBorder: '#E0E7FF',

  danger: '#DC2626',
  dangerSoft: '#FEF2F2',

  shadow: 'rgba(15, 15, 30, 0.08)',
  shadowStrong: 'rgba(15, 15, 30, 0.18)',
};

export const radius = {
  sm: 8,
  md: 10,
  lg: 14,
  xl: 18,
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
  card: {
    shadowColor: '#0F0F1E',
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardHover: {
    shadowColor: '#0F0F1E',
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  button: {
    shadowColor: '#4F46E5',
    shadowOpacity: 0.25,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
};

export const transitions = {
  fast: 'all 140ms cubic-bezier(0.2, 0.8, 0.2, 1)',
  base: 'all 200ms cubic-bezier(0.2, 0.8, 0.2, 1)',
  slow: 'all 320ms cubic-bezier(0.2, 0.8, 0.2, 1)',
};
