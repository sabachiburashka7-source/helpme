import { Platform } from 'react-native';

export function isImageUrl(value) {
  if (typeof value !== 'string' || !value) return false;
  return value.startsWith('data:image') || value.startsWith('http://') || value.startsWith('https://');
}

const PROFILE_MAX_SIZE = 256;
const PROFILE_QUALITY = 0.85;

const OFFER_MAX_SIZE = 1024;
const OFFER_QUALITY = 0.82;

// =====================================================================
// Public API
// =====================================================================

export async function pickProfileImage() {
  if (Platform.OS === 'web') {
    return pickWebSingle(PROFILE_MAX_SIZE, PROFILE_QUALITY);
  }
  return pickNativeSingle(PROFILE_MAX_SIZE, PROFILE_QUALITY);
}

export async function pickOfferImages() {
  if (Platform.OS === 'web') {
    return pickWebMultiple(OFFER_MAX_SIZE, OFFER_QUALITY);
  }
  return pickNativeMultiple(OFFER_MAX_SIZE, OFFER_QUALITY);
}

// =====================================================================
// Web — <input type=file> + canvas resize
// =====================================================================

function pickWebSingle(maxSize, quality) {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('File picker not available'));
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';

    let done = false;
    const finish = (fn, value) => {
      if (done) return;
      done = true;
      input.remove();
      fn(value);
    };

    input.addEventListener('change', async () => {
      const file = input.files && input.files[0];
      if (!file) return finish(resolve, null);
      try {
        const dataUrl = await resizeImageFileWeb(file, maxSize, quality);
        finish(resolve, dataUrl);
      } catch (err) {
        finish(reject, err);
      }
    });
    input.addEventListener('cancel', () => finish(resolve, null));

    document.body.appendChild(input);
    input.click();
  });
}

function pickWebMultiple(maxSize, quality) {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('File picker not available'));
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.style.display = 'none';

    let done = false;
    const finish = (fn, value) => {
      if (done) return;
      done = true;
      input.remove();
      fn(value);
    };

    input.addEventListener('change', async () => {
      const files = Array.from(input.files || []);
      if (files.length === 0) return finish(resolve, []);
      try {
        const out = await Promise.all(files.map((f) => resizeImageFileWeb(f, maxSize, quality)));
        finish(resolve, out);
      } catch (err) {
        finish(reject, err);
      }
    });
    input.addEventListener('cancel', () => finish(resolve, []));

    document.body.appendChild(input);
    input.click();
  });
}

function resizeImageFileWeb(file, maxSize, quality) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Could not load image'));
      img.onload = () => {
        const { width, height } = img;
        const scale = Math.min(1, maxSize / Math.max(width, height));
        const w = Math.round(width * scale);
        const h = Math.round(height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        try {
          resolve(canvas.toDataURL('image/jpeg', quality));
        } catch (err) {
          reject(err);
        }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// =====================================================================
// Native — expo-image-picker
// =====================================================================
// We return data URLs (data:image/jpeg;base64,...) to match the web shape so
// the existing API/serialization code keeps working unchanged.

async function pickNativeSingle(maxSize, quality) {
  const ImagePicker = await import('expo-image-picker');
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    throw new Error('Photo library permission denied');
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    quality,
    base64: true,
    exif: false,
  });
  if (result.canceled || !result.assets || result.assets.length === 0) {
    return null;
  }
  return assetToDataUrl(result.assets[0]);
}

async function pickNativeMultiple(maxSize, quality) {
  const ImagePicker = await import('expo-image-picker');
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    throw new Error('Photo library permission denied');
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsMultipleSelection: true,
    selectionLimit: 6,
    quality,
    base64: true,
    exif: false,
  });
  if (result.canceled || !result.assets) return [];
  return result.assets.map(assetToDataUrl).filter(Boolean);
}

function assetToDataUrl(asset) {
  if (!asset) return null;
  if (asset.base64) {
    // Mime is almost always image/jpeg from the picker; fall back to png if we can sniff.
    const mime = asset.mimeType || 'image/jpeg';
    return `data:${mime};base64,${asset.base64}`;
  }
  // Last resort — if base64 wasn't provided, return the file URI. Some
  // upload paths may not handle file:// URIs; this should rarely fire.
  return asset.uri || null;
}
