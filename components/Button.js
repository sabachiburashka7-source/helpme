import React, { useRef } from 'react';
import {
  Animated, Pressable, StyleSheet, Text, View, ActivityIndicator, Platform,
} from 'react-native';
import { colors, radius, shadows, transitions } from './theme';

const SCALE_PRESSED = 0.97;
const SCALE_REST = 1;

function usePressAnim() {
  const scale = useRef(new Animated.Value(SCALE_REST)).current;
  const animate = (to) =>
    Animated.spring(scale, {
      toValue: to,
      useNativeDriver: true,
      speed: 40,
      bounciness: 6,
    }).start();
  return {
    scale,
    onPressIn: () => animate(SCALE_PRESSED),
    onPressOut: () => animate(SCALE_REST),
  };
}

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
  const { scale, onPressIn, onPressOut } = usePressAnim();

  const isPrimary = variant === 'primary';
  const isGhost = variant === 'ghost';
  const isOutline = variant === 'outline';

  return (
    <Animated.View
      style={[
        { transform: [{ scale }] },
        fullWidth && { alignSelf: 'stretch' },
        style,
      ]}
    >
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={disabled || loading}
        style={({ hovered }) => [
          styles.base,
          size === 'sm' && styles.sm,
          size === 'md' && styles.md,
          size === 'lg' && styles.lg,
          isPrimary && styles.primary,
          isPrimary && hovered && styles.primaryHover,
          isPrimary && !disabled && shadows.button,
          isOutline && styles.outline,
          isOutline && hovered && styles.outlineHover,
          isGhost && styles.ghost,
          isGhost && hovered && styles.ghostHover,
          (disabled || loading) && styles.disabled,
          Platform.OS === 'web' && { transition: transitions.fast, cursor: disabled ? 'not-allowed' : 'pointer' },
        ]}
      >
        {loading ? (
          <ActivityIndicator color={isPrimary ? '#fff' : colors.accent} size="small" />
        ) : (
          <View style={styles.row}>
            {icon ? <View style={styles.icon}>{icon}</View> : null}
            <Text
              style={[
                styles.text,
                isPrimary && styles.textPrimary,
                isOutline && styles.textOutline,
                isGhost && styles.textGhost,
                size === 'sm' && styles.textSm,
              ]}
            >
              {title}
            </Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

export function IconButton({ children, onPress, style, hoverStyle, activeBg }) {
  const { scale, onPressIn, onPressOut } = usePressAnim();
  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={({ hovered }) => [
          styles.iconBtn,
          activeBg && { backgroundColor: activeBg },
          hovered && (hoverStyle || styles.iconBtnHover),
          Platform.OS === 'web' && { transition: transitions.fast, cursor: 'pointer' },
        ]}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

export function PressableScale({ children, onPress, style, hoverLift = false }) {
  const { scale, onPressIn, onPressOut } = usePressAnim();
  const lift = useRef(new Animated.Value(0)).current;

  return (
    <Animated.View
      style={[
        {
          transform: [
            { scale },
            { translateY: lift },
          ],
        },
        style,
      ]}
    >
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onHoverIn={() =>
          hoverLift &&
          Animated.timing(lift, { toValue: -3, duration: 180, useNativeDriver: true }).start()
        }
        onHoverOut={() =>
          hoverLift &&
          Animated.timing(lift, { toValue: 0, duration: 180, useNativeDriver: true }).start()
        }
        style={Platform.OS === 'web' ? { transition: transitions.fast, cursor: 'pointer' } : undefined}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sm: { paddingVertical: 9, paddingHorizontal: 14 },
  md: { paddingVertical: 13, paddingHorizontal: 18 },
  lg: { paddingVertical: 15, paddingHorizontal: 22 },

  primary: { backgroundColor: colors.accent },
  primaryHover: { backgroundColor: colors.accentHover },

  outline: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  outlineHover: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.borderStrong,
  },

  ghost: { backgroundColor: 'transparent' },
  ghostHover: { backgroundColor: colors.surfaceAlt },

  disabled: { opacity: 0.55 },

  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  icon: { marginRight: 8 },

  text: { fontSize: 14, fontWeight: '600', letterSpacing: 0.1 },
  textPrimary: { color: '#fff' },
  textOutline: { color: colors.text },
  textGhost: { color: colors.textSecondary },
  textSm: { fontSize: 13 },

  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnHover: { backgroundColor: colors.surfaceAlt },
});
