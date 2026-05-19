const cache = new Map();
const inflight = new Map();

function keyFor(lat, lng) {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
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

export function getCachedLocationName(lat, lng) {
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  return cache.get(keyFor(lat, lng)) || null;
}

export function isPinnedCoordinateString(s) {
  return typeof s === 'string' && /^Pinned location \(/.test(s.trim());
}

export async function reverseGeocode(lat, lng) {
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  const key = keyFor(lat, lng);
  if (cache.has(key)) return cache.get(key);
  if (inflight.has(key)) return inflight.get(key);

  const url =
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2` +
    `&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}` +
    `&zoom=18&addressdetails=1`;

  const promise = (async () => {
    try {
      const r = await fetch(url, {
        headers: { Accept: 'application/json', 'Accept-Language': 'en' },
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
