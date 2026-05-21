// Image pickers backed by expo-image-picker.
// Returns data URLs (`data:image/jpeg;base64,...`) so callers can serialize
// them directly into our API payloads, same as before.

import * as ImagePicker from 'expo-image-picker';

const PROFILE_QUALITY = 0.85;
const OFFER_QUALITY = 0.82;
const OFFER_LIMIT = 6;

export function isImageUrl(value) {
  if (typeof value !== 'string' || !value) return false;
  return (
    value.startsWith('data:image') ||
    value.startsWith('http://') ||
    value.startsWith('https://')
  );
}

export async function pickProfileImage() {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    throw new Error('Photo library permission denied');
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    quality: PROFILE_QUALITY,
    base64: true,
    exif: false,
  });
  if (result.canceled || !result.assets || result.assets.length === 0) {
    return null;
  }
  return assetToDataUrl(result.assets[0]);
}

export async function pickOfferImages() {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    throw new Error('Photo library permission denied');
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsMultipleSelection: true,
    selectionLimit: OFFER_LIMIT,
    quality: OFFER_QUALITY,
    base64: true,
    exif: false,
  });
  if (result.canceled || !result.assets) return [];
  return result.assets.map(assetToDataUrl).filter(Boolean);
}

function assetToDataUrl(asset) {
  if (!asset) return null;
  if (asset.base64) {
    const mime = asset.mimeType || 'image/jpeg';
    return `data:${mime};base64,${asset.base64}`;
  }
  return asset.uri || null;
}
