import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Platform, StyleSheet } from 'react-native';
import { colors, radius } from './theme';

let apiKeyPromise = null;
function fetchApiKey() {
  if (apiKeyPromise) return apiKeyPromise;
  apiKeyPromise = fetch('/api/config')
    .then((r) => r.json())
    .then((c) => c.googleMapsApiKey || null)
    .catch(() => null);
  return apiKeyPromise;
}

let mapsPromise = null;
function loadGoogleMaps(apiKey) {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  if (mapsPromise) return mapsPromise;
  if (!apiKey) return Promise.reject(new Error('Missing Google Maps API key'));

  mapsPromise = new Promise((resolve, reject) => {
    const cbName = '__gmaps_cb_' + Math.random().toString(36).slice(2);
    window[cbName] = () => {
      resolve(window.google.maps);
      try { delete window[cbName]; } catch {}
    };
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&callback=${cbName}&v=weekly`;
    script.async = true;
    script.defer = true;
    script.onerror = (e) => {
      mapsPromise = null;
      reject(e instanceof Error ? e : new Error('Failed to load Google Maps'));
    };
    document.head.appendChild(script);
  });
  return mapsPromise;
}

export default function GoogleMapPicker({
  latitude,
  longitude,
  onChange,
  draggable = true,
  height = 220,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const [error, setError] = useState(null);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    let cancelled = false;

    fetchApiKey().then((apiKey) => {
      if (cancelled) return;
      if (!apiKey) {
        setError('Google Maps API key not configured');
        return;
      }
      loadGoogleMaps(apiKey)
        .then((maps) => {
          if (cancelled || !containerRef.current || mapRef.current) return;
          const center = { lat: latitude, lng: longitude };
          const map = new maps.Map(containerRef.current, {
            center,
            zoom: 15,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
            clickableIcons: false,
          });
          const marker = new maps.Marker({
            position: center,
            map,
            draggable,
          });
          if (draggable) {
            marker.addListener('dragend', (e) => {
              onChangeRef.current?.(e.latLng.lat(), e.latLng.lng());
            });
            map.addListener('click', (e) => {
              marker.setPosition(e.latLng);
              onChangeRef.current?.(e.latLng.lat(), e.latLng.lng());
            });
          }
          mapRef.current = map;
          markerRef.current = marker;
        })
        .catch((err) => {
          if (!cancelled) setError(err.message || 'Failed to load map');
        });
    });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        if (window.google?.maps?.event && markerRef.current) {
          window.google.maps.event.clearInstanceListeners(markerRef.current);
          window.google.maps.event.clearInstanceListeners(mapRef.current);
        }
        if (markerRef.current) markerRef.current.setMap(null);
        mapRef.current = null;
        markerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!markerRef.current || !mapRef.current) return;
    if (typeof latitude !== 'number' || typeof longitude !== 'number') return;
    const cur = markerRef.current.getPosition();
    if (!cur) return;
    if (Math.abs(cur.lat() - latitude) > 1e-7 || Math.abs(cur.lng() - longitude) > 1e-7) {
      const next = { lat: latitude, lng: longitude };
      markerRef.current.setPosition(next);
      mapRef.current.setCenter(next);
    }
  }, [latitude, longitude]);

  if (Platform.OS !== 'web') return null;

  return (
    <View style={[styles.wrap, { height }]}>
      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.errorHint}>
            Add GOOGLE_MAPS_API_KEY in Vercel env vars and redeploy.
          </Text>
        </View>
      ) : (
        React.createElement('div', {
          ref: (el) => {
            containerRef.current = el;
          },
          style: { width: '100%', height: '100%' },
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  errorBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  errorText: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  errorHint: {
    fontSize: 11,
    color: colors.textTertiary,
    textAlign: 'center',
  },
});
