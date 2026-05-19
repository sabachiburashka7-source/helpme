// Cross-platform "div with backgroundImage" replacement.
//
// On web, React Native Web translates `backgroundImage` CSS to the DOM, so
// the old code worked. On native (Android/iOS) `backgroundImage` is silently
// ignored — `View` simply doesn't support it.
//
// This component renders an absolutely-positioned <Image> under any children,
// giving the same visual result without depending on `backgroundImage`.
//
// `source` is a plain string URI (`https://...`, `data:image/...`, etc.) or
// null. When null/empty, an optional placeholder colour + label render
// instead, so callers don't have to branch.

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
  // SVG data URLs need react-native-svg to render natively; we don't have it,
  // so treat them the same as missing → fall through to the placeholder.
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
