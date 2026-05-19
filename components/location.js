// Cross-platform "get current location" helper.
//
// Web:    browser geolocation API (asks the user via the browser).
// Native: expo-location (asks the user via the OS permission dialog).
//
// Both branches resolve to: { latitude: number, longitude: number }
// and reject with an Error if denied / unavailable / timed out.

import { Platform } from 'react-native';

export function getCurrentLocation({ highAccuracy = true, timeoutMs = 10000 } = {}) {
  if (Platform.OS === 'web') {
    return new Promise((resolve, reject) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        reject(new Error('Geolocation not available'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          }),
        (err) => reject(new Error(err?.message || 'Could not get location')),
        {
          enableHighAccuracy: highAccuracy,
          timeout: timeoutMs,
          maximumAge: 60000,
        }
      );
    });
  }

  // Native: use expo-location. Imported lazily so the web bundle isn't bloated.
  return (async () => {
    const Location = await import('expo-location');
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Location permission denied');
    }
    const pos = await Location.getCurrentPositionAsync({
      accuracy: highAccuracy
        ? Location.Accuracy.High
        : Location.Accuracy.Balanced,
    });
    return {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
    };
  })();
}
