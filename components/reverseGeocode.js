const cache = new Map();
const inflight = new Map();

function keyFor(lat, lng, lang) {
  return `${lat.toFixed(4)},${lng.toFixed(4)},${lang || 'en'}`;
}

function composeName(address) {
  if (!address) return null;
  const street = address.road || address.pedestrian || address.footway || address.path || null;
  const district =
    address.suburb ||
    address.neighbourhood ||
    address.city_district ||
    address.quarter ||
    address.borough ||
    null;
  const city =
    address.city || address.town || address.village || address.municipality || address.hamlet || null;

  const parts = [];
  if (street) parts.push(street);
  if (district && district !== street) parts.push(district);
  if (city && !parts.includes(city)) parts.push(city);
  return parts.length ? parts.slice(0, 2).join(', ') : null;
}

export function getCachedLocationName(lat, lng, lang) {
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  return cache.get(keyFor(lat, lng, lang)) || null;
}

const RAW_COORDS_RE = /^\s*\(?\s*-?\d{1,3}(?:\.\d+)?\s*,\s*-?\d{1,3}(?:\.\d+)?\s*\)?\s*$/;

// True when the location text is just coordinates, with or without a wrapper
// (e.g. "Pinned location (41.71, 44.83)", "(41.71, 44.83)", "41.71, 44.83").
// Those are the cases where we should reverse-geocode to show a human address.
export function isPinnedCoordinateString(s) {
  if (typeof s !== 'string') return false;
  const t = s.trim();
  if (/^Pinned location\s*\(/i.test(t)) return true;
  return RAW_COORDS_RE.test(t);
}

export async function reverseGeocode(lat, lng, lang = 'en') {
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  const acceptLang = lang || 'en';
  const key = keyFor(lat, lng, acceptLang);
  if (cache.has(key)) return cache.get(key);
  if (inflight.has(key)) return inflight.get(key);

  const url =
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2` +
    `&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}` +
    `&zoom=18&addressdetails=1`;

  const promise = (async () => {
    try {
      const r = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'Accept-Language': acceptLang,
          // Nominatim's usage policy asks every client to identify itself.
          'User-Agent': 'helpme/1.0 (com.sabachiburashka.helpme)',
        },
      });
      if (!r.ok) return null;
      const data = await r.json();
      const name = composeName(data.address) || data.display_name || null;
      if (name) cache.set(key, name);
      return name;
    } catch {
      return null;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, promise);
  return promise;
}
