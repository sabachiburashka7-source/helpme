// Glassmorphism primitives.
//
// Two different "glass" implementations live here on purpose:
//
//  * `GlassSurface` — translucent fill + bright rim + diagonal sheen. No
//    native blur, so it is safe to use hundreds of times inside a
//    ScrollView. This is the default for cards, fields, chips.
//  * `BlurSurface` — the same look, but backed by a real `BlurView`.
//    Android's blur is the experimental `dimezisBlurView` implementation
//    and gets expensive when it is scrolled or nested, so keep it for
//    *fixed chrome only* (tab bar, floating header) and never inside a
//    `Modal` — it misbehaves there.
//
// Both read through to `AmbientBackground`, which is what gives the glass
// something worth showing through.

import React, { useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, Animated, TextInput,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, glass, radius, shadows } from './theme';

const TONES = {
  light: { bg: glass.fill, border: glass.stroke },
  strong: { bg: glass.fillStrong, border: glass.stroke },
  // Use for any panel with body text sitting over a photo.
  read: { bg: glass.fillRead, border: glass.stroke },
  soft: { bg: glass.fillSoft, border: glass.strokeSoft },
  hollow: { bg: glass.fillHollow, border: glass.strokeSoft },
  accent: { bg: glass.accentFill, border: glass.accentStroke },
  dark: { bg: glass.darkFill, border: glass.darkStroke, dark: true },
  darkStrong: { bg: glass.darkFillStrong, border: glass.darkStroke, dark: true },
  danger: { bg: glass.dangerFill, border: glass.dangerStroke },
};

function sheenFor(spec) {
  return spec.dark
    ? { colors: glass.sheenDark, locations: glass.sheenDarkLocations }
    : { colors: glass.sheen, locations: glass.sheenLocations };
}

const SHADOWS = {
  none: null,
  subtle: shadows.glassSubtle,
  base: shadows.glass,
  lifted: shadows.glassLifted,
};

/* ------------------------------------------------------------------ */
/* Ambient background                                                  */
/* ------------------------------------------------------------------ */

export function AmbientBackground({ children, style }) {
  return (
    <View style={[styles.ambientRoot, style]}>
      {/* Neutral light only. Smooth full-screen washes — discrete shapes and
          stacked rings band visibly on the device panel. */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <LinearGradient
          colors={['#FFFFFF', colors.bg, colors.border]}
          locations={[0, 0.46, 1]}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={['rgba(255, 255, 255, 0.95)', 'rgba(255, 255, 255, 0)']}
          start={{ x: 0.05, y: 0 }}
          end={{ x: 0.85, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={['rgba(24, 24, 27, 0)', 'rgba(24, 24, 27, 0.055)']}
          start={{ x: 0.15, y: 0.42 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </View>
      {children}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Photo scrim                                                         */
/* ------------------------------------------------------------------ */

// A bottom-aligned white wash for the foot of a photo. Drop it inside the
// image frame (as a child of `BgImage`, or as a sibling above the image)
// wherever a glass panel overlaps a picture. Without it the panel inherits
// whatever the illustration happened to contain — often dark and busy —
// and the text on the panel becomes unreadable. With it, the panel always
// has a calm near-white backdrop, and the photo still ghosts through.
export function PhotoScrim({ height = '52%', style }) {
  return (
    <LinearGradient
      pointerEvents="none"
      colors={glass.photoScrim}
      locations={glass.photoScrimLocations}
      style={[
        { position: 'absolute', left: 0, right: 0, bottom: 0, height },
        style,
      ]}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Surfaces                                                            */
/* ------------------------------------------------------------------ */

// The sheen is painted by the surface itself rather than by an absolutely
// positioned overlay: Yoga insets absolute children by the parent's padding,
// so an overlay on a padded panel lands as a hard-edged rectangle over the
// content box instead of covering the whole card.
export function GlassSurface({
  tone = 'light',
  radius: r = radius.glass,
  shadow = 'base',
  sheen = true,
  clip = true,
  style,
  children,
}) {
  const spec = TONES[tone] || TONES.light;
  const base = [
    {
      borderRadius: r,
      backgroundColor: spec.bg,
      borderWidth: 1,
      borderColor: spec.border,
    },
    clip && { overflow: 'hidden' },
    SHADOWS[shadow],
    style,
  ];

  if (!sheen) return <View style={base}>{children}</View>;

  const ramp = sheenFor(spec);
  return (
    <LinearGradient
      colors={ramp.colors}
      locations={ramp.locations}
      start={{ x: 0.25, y: 0 }}
      end={{ x: 0.75, y: 1 }}
      style={base}
    >
      {children}
    </LinearGradient>
  );
}

// A frosted panel with a real blur behind it. Padding goes in
// `contentStyle`, never in `style`: the blur/tint/sheen layers are
// absolutely positioned, and Yoga insets absolute children by the
// parent's padding, so padding on the outer view would shrink them to the
// content box and leave a hard-edged rectangle.
//
// Use this where something worth seeing sits behind the panel — a photo,
// the avatar, scrolling content. Blur is what makes the glass legible AND
// transparent at the same time. Never inside a `Modal` (Android's blur
// misrenders there); pass `blur={false}` in that case.
export function GlassPanel({
  tone = 'strong',
  radius: r = 26,
  blur = true,
  intensity = 42,
  shadow = 'none',
  style,
  contentStyle,
  children,
}) {
  const spec = TONES[tone] || TONES.strong;
  const ramp = sheenFor(spec);
  return (
    <View
      style={[
        { borderRadius: r, overflow: 'hidden', borderWidth: 1, borderColor: spec.border },
        SHADOWS[shadow],
        style,
      ]}
    >
      {blur ? (
        <BlurView
          intensity={intensity}
          tint="light"
          experimentalBlurMethod="dimezisBlurView"
          blurReductionFactor={4}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: spec.bg }]}
      />
      <LinearGradient
        pointerEvents="none"
        colors={ramp.colors}
        locations={ramp.locations}
        start={{ x: 0.25, y: 0 }}
        end={{ x: 0.75, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={contentStyle}>{children}</View>
    </View>
  );
}

// Real frosted blur. Fixed chrome only — see the note at the top.
export function BlurSurface({
  tone = 'soft',
  intensity = 30,
  radius: r = 0,
  style,
  children,
}) {
  const spec = TONES[tone] || TONES.soft;
  return (
    <View style={[{ borderRadius: r, overflow: 'hidden' }, style]}>
      <BlurView
        intensity={intensity}
        tint="light"
        experimentalBlurMethod="dimezisBlurView"
        blurReductionFactor={4}
        style={StyleSheet.absoluteFill}
      />
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: spec.bg }]}
      />
      {children}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Press feedback                                                      */
/* ------------------------------------------------------------------ */

export function usePressScale(to = 0.97) {
  const scale = useRef(new Animated.Value(1)).current;
  const animate = (v) =>
    Animated.spring(scale, {
      toValue: v,
      useNativeDriver: true,
      speed: 40,
      bounciness: 6,
    }).start();
  return {
    scale,
    onPressIn: () => animate(to),
    onPressOut: () => animate(1),
  };
}

export function PressableGlass({ onPress, style, children, disabled, scaleTo = 0.98 }) {
  const { scale, onPressIn, onPressOut } = usePressScale(scaleTo);
  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={disabled}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

/* ------------------------------------------------------------------ */
/* Buttons                                                             */
/* ------------------------------------------------------------------ */

export function GlassButton({
  title,
  onPress,
  variant = 'primary', // primary | glass | ghost | danger
  size = 'md', // sm | md | lg
  loading = false,
  disabled = false,
  style,
  textStyle,
}) {
  const { scale, onPressIn, onPressOut } = usePressScale(0.97);
  const isDisabled = !!(disabled || loading);
  const pad =
    size === 'sm'
      ? { paddingVertical: 10, paddingHorizontal: 16 }
      : size === 'lg'
        ? { paddingVertical: 17, paddingHorizontal: 26 }
        : { paddingVertical: 15, paddingHorizontal: 22 };

  const body = (
    <Text
      style={[
        styles.btnText,
        size === 'sm' && { fontSize: 13 },
        variant === 'primary' && styles.btnTextPrimary,
        variant === 'glass' && styles.btnTextGlass,
        variant === 'ghost' && styles.btnTextGhost,
        variant === 'danger' && styles.btnTextDanger,
        textStyle,
      ]}
      numberOfLines={1}
    >
      {loading ? '···' : title}
    </Text>
  );

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        onPress={onPress}
        onPressIn={() => !isDisabled && onPressIn()}
        onPressOut={onPressOut}
        disabled={isDisabled}
      >
        {variant === 'primary' ? (
          <LinearGradient
            colors={['rgba(255,255,255,0.30)', 'rgba(255,255,255,0.05)', 'rgba(0,0,0,0.12)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.4, y: 1 }}
            style={[
              styles.btnBase,
              pad,
              { backgroundColor: colors.accent, borderColor: glass.accentStrokeStrong },
              shadows.button,
              isDisabled && styles.btnDisabled,
            ]}
          >
            {body}
          </LinearGradient>
        ) : (
          <GlassSurface
            tone={variant === 'danger' ? 'danger' : variant === 'ghost' ? 'hollow' : 'strong'}
            radius={radius.pill}
            shadow={variant === 'ghost' ? 'none' : 'subtle'}
            style={[
              styles.btnBase,
              pad,
              variant === 'ghost' && { borderColor: 'transparent', backgroundColor: 'transparent' },
              isDisabled && styles.btnDisabled,
            ]}
            sheen={variant !== 'ghost'}
          >
            {body}
          </GlassSurface>
        )}
      </Pressable>
    </Animated.View>
  );
}

export function GlassIconButton({ children, onPress, size = 42, tone = 'strong', style, accessibilityLabel }) {
  const { scale, onPressIn, onPressOut } = usePressScale(0.92);
  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        accessibilityLabel={accessibilityLabel}
      >
        <GlassSurface
          tone={tone}
          radius={radius.pill}
          shadow="subtle"
          style={{
            width: size,
            height: size,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {children}
        </GlassSurface>
      </Pressable>
    </Animated.View>
  );
}

/* ------------------------------------------------------------------ */
/* Chips & pills                                                       */
/* ------------------------------------------------------------------ */

export function GlassChip({ label, active, onPress, style, textStyle }) {
  const content = (
    <GlassSurface
      tone={active ? 'accent' : 'strong'}
      radius={radius.pill}
      shadow={active ? 'subtle' : 'none'}
      style={[
        styles.chip,
        active && { borderColor: glass.accentStrokeStrong },
        style,
      ]}
    >
      <Text
        style={[
          styles.chipText,
          active && styles.chipTextActive,
          textStyle,
        ]}
      >
        {label}
      </Text>
    </GlassSurface>
  );
  if (!onPress) return content;
  return (
    <PressableGlass onPress={onPress} scaleTo={0.94}>
      {content}
    </PressableGlass>
  );
}

/* ------------------------------------------------------------------ */
/* Segmented control                                                   */
/* ------------------------------------------------------------------ */

export function GlassSegmented({ tabs, value, onChange, style }) {
  const [innerW, setInnerW] = React.useState(0);
  const tx = useRef(new Animated.Value(0)).current;
  const index = Math.max(0, tabs.findIndex((tb) => tb.value === value));
  const segmentW = innerW > 0 ? innerW / tabs.length : 0;

  React.useEffect(() => {
    if (segmentW === 0) return;
    Animated.spring(tx, {
      toValue: segmentW * index,
      useNativeDriver: true,
      speed: 20,
      bounciness: 9,
    }).start();
  }, [index, segmentW, tx]);

  return (
    <GlassSurface
      tone="soft"
      radius={radius.pill}
      shadow="subtle"
      sheen={false}
      style={[styles.segOuter, style]}
    >
      <View
        style={styles.segInner}
        onLayout={(e) => setInnerW(e.nativeEvent.layout.width)}
      >
        {segmentW > 0 ? (
          <Animated.View
            style={[
              styles.segThumbWrap,
              { width: segmentW, transform: [{ translateX: tx }] },
            ]}
          >
            <GlassSurface
              tone="strong"
              radius={radius.pill}
              shadow="subtle"
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        ) : null}
        {tabs.map((tb) => {
          const active = tb.value === value;
          return (
            <Pressable key={tb.value} onPress={() => onChange(tb.value)} style={styles.segTab}>
              <Text style={[styles.segText, active && styles.segTextActive]} numberOfLines={1}>
                {tb.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </GlassSurface>
  );
}

/* ------------------------------------------------------------------ */
/* Inputs                                                              */
/* ------------------------------------------------------------------ */

export function GlassField({
  label,
  multiline,
  left,
  containerStyle,
  inputStyle,
  ...inputProps
}) {
  const [focused, setFocused] = React.useState(false);
  return (
    <View style={[styles.fieldWrap, containerStyle]}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <GlassSurface
        tone="strong"
        radius={multiline ? radius.xl : radius.lg}
        shadow={focused ? 'base' : 'subtle'}
        style={[
          styles.fieldSurface,
          focused && {
            borderColor: glass.accentStrokeStrong,
            shadowColor: colors.accent,
            shadowOpacity: 0.22,
          },
        ]}
      >
        <View style={styles.fieldRow}>
          {left}
          <TextInput
            {...inputProps}
            multiline={multiline}
            onFocus={(e) => {
              setFocused(true);
              inputProps.onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              inputProps.onBlur?.(e);
            }}
            placeholderTextColor={colors.textMuted}
            style={[
              styles.fieldInput,
              multiline && styles.fieldInputMultiline,
              inputStyle,
            ]}
          />
        </View>
      </GlassSurface>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Section label                                                       */
/* ------------------------------------------------------------------ */

export function SectionLabel({ children, style }) {
  return <Text style={[styles.sectionLabel, style]}>{children}</Text>;
}

const styles = StyleSheet.create({
  ambientRoot: { flex: 1, backgroundColor: colors.bg },

  btnBase: {
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    overflow: 'hidden',
  },
  btnDisabled: { opacity: 0.5 },
  btnText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  btnTextPrimary: { color: '#fff' },
  btnTextGlass: { color: colors.accent },
  btnTextGhost: { color: colors.textSecondary, fontWeight: '600' },
  btnTextDanger: { color: colors.danger },

  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.2,
  },
  chipTextActive: { color: colors.accent },

  segOuter: { padding: 5 },
  segInner: { flexDirection: 'row', position: 'relative' },
  segThumbWrap: { position: 'absolute', top: 0, bottom: 0, left: 0 },
  segTab: {
    flex: 1,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textTertiary,
    letterSpacing: 0.2,
  },
  segTextActive: { color: colors.accent, fontWeight: '800' },

  fieldWrap: { marginTop: 16 },
  fieldLabel: {
    fontSize: 11,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '700',
    marginBottom: 8,
    marginLeft: 6,
  },
  fieldSurface: { paddingHorizontal: 2 },
  fieldRow: { flexDirection: 'row', alignItems: 'center' },
  fieldInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 15,
    fontSize: 15,
    color: colors.text,
  },
  fieldInputMultiline: {
    minHeight: 104,
    textAlignVertical: 'top',
    paddingTop: 15,
  },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: colors.textTertiary,
    textTransform: 'uppercase',
  },
});
