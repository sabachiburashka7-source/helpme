import { Platform } from 'react-native';

export function isImageUrl(value) {
  if (typeof value !== 'string' || !value) return false;
  return value.startsWith('data:image') || value.startsWith('http://') || value.startsWith('https://');
}

const MAX_SIZE = 256;
const JPEG_QUALITY = 0.85;

export function pickProfileImage() {
  return new Promise((resolve, reject) => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      reject(new Error('File picker is only available on web'));
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
      if (!file) {
        finish(resolve, null);
        return;
      }
      try {
        const dataUrl = await resizeImageFile(file);
        finish(resolve, dataUrl);
      } catch (err) {
        finish(reject, err);
      }
    });

    input.addEventListener('cancel', () => {
      finish(resolve, null);
    });

    document.body.appendChild(input);
    input.click();
  });
}

function resizeImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Could not load image'));
      img.onload = () => {
        const { width, height } = img;
        const scale = Math.min(1, MAX_SIZE / Math.max(width, height));
        const w = Math.round(width * scale);
        const h = Math.round(height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        try {
          resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
        } catch (err) {
          reject(err);
        }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
