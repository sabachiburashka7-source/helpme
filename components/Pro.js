// Small pieces the Lite / Pro split needs on more than one screen: the lock
// drawn where a Pro-only price or filter would be, the Pro badge, and how a
// distance reads.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius } from './theme';

// Drawn with Views like the app's other glyphs (flag, block, search), so it
// has their line weight instead of looking like a pasted-in emoji padlock.
export function LockGlyph({ color = colors.textSecondary, size = 12 }) {
  const stroke = Math.max(1.4, size * 0.13);
  return (
    <View style={{ width: size, height: size * 1.15, alignItems: 'center' }}>
      <View
        style={{
          width: size * 0.64,
          height: size * 0.56,
          borderWidth: stroke,
          borderBottomWidth: 0,
          borderColor: color,
          borderTopLeftRadius: size * 0.32,
          borderTopRightRadius: size * 0.32,
        }}
      />
      <View
        style={{
          width: size,
          height: size * 0.6,
          borderRadius: size * 0.16,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

// "PRO" in Latin letters in every language, like the brand name.
export function ProBadge({ small = false, style }) {
  return (
    <View style={[styles.badge, small && styles.badgeSmall, style]}>
      <Text style={[styles.badgeText, small && styles.badgeTextSmall]}>PRO</Text>
    </View>
  );
}

// "800 m" reads oddly next to the km radius chips, so it is always km:
// one decimal while it is close, whole numbers further out.
export function formatKm(km) {
  if (typeof km !== 'number' || !Number.isFinite(km)) return '';
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  badgeSmall: { paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8, color: '#fff' },
  badgeTextSmall: { fontSize: 9.5, letterSpacing: 0.7 },
});
