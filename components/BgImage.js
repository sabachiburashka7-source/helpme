// Drop-in replacement for `<View style={{ backgroundImage: url(...) }}>`.
// Renders an absolutely-positioned <Image> underneath any children, plus an
// optional placeholder colour + label for when `source` is empty/missing.

import React from 'react';
import { View, Image, Text, StyleSheet } from 'react-native';

export function BgImage({
  source,
  resizeMode = 'cover',
  placeholderText,
  placeholderBg = '#E4E2EC',
  placeholderTextColor = '#7A7596',
  style,
  children,
}) {
  const hasUri = typeof source === 'string' && source.length > 0;
  // SVG data URLs need react-native-svg to render — we don't have it,
  // so fall back to the placeholder for those.
  const isRasterUri = hasUri && !source.startsWith('data:image/svg');

  return (
    <View style={style}>
      {isRasterUri ? (
        <Image
          source={{ uri: source }}
          style={StyleSheet.absoluteFill}
          resizeMode={resizeMode}
        />
      ) : (
        <View
          style={[
            StyleSheet.absoluteFill,
            styles.placeholder,
            { backgroundColor: placeholderBg },
          ]}
        >
          {placeholderText ? (
            <Text style={[styles.placeholderText, { color: placeholderTextColor }]}>
              {placeholderText}
            </Text>
          ) : null}
        </View>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
