// Platform-aware key/value storage.
// On web: localStorage (synchronous).
// On native (Android/iOS): AsyncStorage (asynchronous).
// We expose an async API everywhere so callers don't have to branch.

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const isWeb = Platform.OS === 'web';

export async function getItem(key) {
  try {
    if (isWeb) {
      if (typeof window === 'undefined') return null;
      return window.localStorage.getItem(key);
    }
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function setItem(key, value) {
  try {
    if (isWeb) {
      if (typeof window === 'undefined') return;
      window.localStorage.setItem(key, value);
      return;
    }
    await AsyncStorage.setItem(key, value);
  } catch {}
}

export async function removeItem(key) {
  try {
    if (isWeb) {
      if (typeof window === 'undefined') return;
      window.localStorage.removeItem(key);
      return;
    }
    await AsyncStorage.removeItem(key);
  } catch {}
}
