import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View, Platform } from 'react-native';
import { colors, transitions } from './theme';

export default function SegmentedTabs({ tabs, value, onChange, hideIndicator = false }) {
  const [width, setWidth] = useState(0);
  const tx = useRef(new Animated.Value(0)).current;
  const index = Math.max(0, tabs.findIndex((t) => t.value === value));

  useEffect(() => {
    if (width === 0 || hideIndicator) return;
    Animated.spring(tx, {
      toValue: (width / tabs.length) * index,
      useNativeDriver: true,
      speed: 24,
      bounciness: 6,
    }).start();
  }, [index, width, tabs.length, tx, hideIndicator]);

  return (
    <View style={styles.wrap} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {hideIndicator ? null : (
        <View style={styles.track}>
          {width > 0 ? (
            <Animated.View
              style={[
                styles.thumb,
                {
                  width: width / tabs.length,
                  transform: [{ translateX: tx }],
                },
              ]}
            />
          ) : null}
        </View>
      )}
      <View style={styles.row}>
        {tabs.map((t, i) => {
          const active = t.value === value;
          const isLast = i === tabs.length - 1;
          return (
            <Pressable
              key={t.value}
              onPress={() => onChange(t.value)}
              style={({ hovered }) => [
                styles.tab,
                isLast && { marginRight: 0 },
                Platform.OS === 'web' && { transition: transitions.fast, cursor: 'pointer' },
                hovered && !active && styles.tabHover,
              ]}
            >
              <Text style={[styles.text, active && styles.textActive]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  track: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 2,
    backgroundColor: colors.border,
  },
  thumb: {
    position: 'absolute',
    bottom: 0,
    height: 2,
    backgroundColor: colors.accent,
    borderRadius: 2,
  },
  row: { flexDirection: 'row' },
  tab: { paddingVertical: 12, marginRight: 24, marginBottom: 0 },
  tabHover: {},
  text: { fontSize: 14, color: colors.textTertiary, fontWeight: '500' },
  textActive: { color: colors.text, fontWeight: '600' },
});
