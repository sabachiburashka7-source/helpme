// Legacy button API, re-skinned on top of the glass primitives so older
// call sites keep working. New code should reach for `GlassButton` /
// `GlassIconButton` in ./Glass directly.

import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { colors, radius } from './theme';
import { GlassButton, GlassSurface, usePressScale } from './Glass';

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  style,
  icon = null,
  fullWidth = true,
}) {
  const mapped =
    variant === 'primary' ? 'primary' : variant === 'outline' ? 'glass' : 'ghost';
  return (
    <GlassButton
      title={title}
      onPress={onPress}
      variant={mapped}
      size={size}
      loading={loading}
      disabled={disabled}
      style={[fullWidth && { alignSelf: 'stretch' }, style]}
    />
  );
}

export function IconButton({ children, onPress, style, activeBg }) {
  const { scale, onPressIn, onPressOut } = usePressScale(0.92);
  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}>
        <GlassSurface
          tone="strong"
          radius={radius.pill}
          shadow="subtle"
          style={[styles.iconBtn, activeBg && { backgroundColor: activeBg }]}
        >
          {children}
        </GlassSurface>
      </Pressable>
    </Animated.View>
  );
}

export function PressableScale({ children, onPress, style }) {
  const { scale, onPressIn, onPressOut } = usePressScale(0.98);
  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}>
        {children}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
