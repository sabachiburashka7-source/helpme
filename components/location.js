// Cross-platform "get current location" — wraps expo-location.
// Resolves to: { latitude: number, longitude: number }.
// Rejects with an Error if permission was denied or the lookup failed.

import * as Location from 'expo-location';

export async function getCurrentLocation({ highAccuracy = true } = {}) {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Location permission denied');
  }
  const pos = await Location.getCurrentPositionAsync({
    accuracy: highAccuracy ? Location.Accuracy.High : Location.Accuracy.Balanced,
  });
  return {
    latitude: pos.coords.latitude,
    longitude: pos.coords.longitude,
  };
}
