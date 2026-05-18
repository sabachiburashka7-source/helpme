import React, { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';

export default function FadeInUp({ children, delay = 0, distance = 12, style }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(distance)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 380,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(ty, {
        toValue: 0,
        duration: 380,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, ty, delay]);

  return (
    <Animated.View style={[{ opacity, transform: [{ translateY: ty }] }, style]}>
      {children}
    </Animated.View>
  );
}
