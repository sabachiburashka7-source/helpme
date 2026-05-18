import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Platform, StyleSheet } from 'react-native';
import { colors, radius } from './theme';

const MAPLIBRE_VERSION = '4.7.1';
const MAPLIBRE_JS = `https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.js`;
const MAPLIBRE_CSS = `https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.css`;
const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

let loadPromise = null;
function loadMapLibre() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve(null);
  }
  if (window.maplibregl) return Promise.resolve(window.maplibregl);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    if (!document.querySelector('link[data-maplibre="1"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = MAPLIBRE_CSS;
      link.setAttribute('data-maplibre', '1');
      document.head.appendChild(link);
    }
    const existing = document.querySelector('script[data-maplibre="1"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.maplibregl));
      existing.addEventListener('error', reject);
      return;
    }
    const script = document.createElement('script');
    script.src = MAPLIBRE_JS;
    script.async = true;
    script.setAttribute('data-maplibre', '1');
    script.onload = () => resolve(window.maplibregl);
    script.onerror = (e) => {
      loadPromise = null;
      reject(e instanceof Error ? e : new Error('Failed to load MapLibre'));
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}

function buildMarkerElement(accent) {
  // Outer element: MapLibre owns its `transform` (used for positioning).
  // Do NOT modify outer's transform — that's what caused the pin to jump.
  const el = document.createElement('div');
  el.style.cssText = 'width: 26px; height: 26px; cursor: grab;';

  // Inner element: visual look + press-scale feedback.
  const inner = document.createElement('div');
  inner.style.cssText = [
    'width: 100%',
    'height: 100%',
    'border-radius: 50%',
    `background: ${accent}`,
    'border: 3px solid #fff',
    'box-shadow: 0 4px 10px rgba(0, 0, 0, 0.28), 0 0 0 1px rgba(122, 18, 48, 0.18)',
    'box-sizing: border-box',
    'transition: transform 120ms ease',
    'pointer-events: none',
  ].join(';');
  el.appendChild(inner);

  el.addEventListener('mousedown', () => {
    el.style.cursor = 'grabbing';
    inner.style.transform = 'scale(1.12)';
  });
  const release = () => {
    el.style.cursor = 'grab';
    inner.style.transform = '';
  };
  el.addEventListener('mouseup', release);
  el.addEventListener('mouseleave', release);
  return el;
}

export default function MapPicker({
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

    loadMapLibre()
      .then((maplibregl) => {
        if (cancelled || !maplibregl || !containerRef.current || mapRef.current) return;

        const map = new maplibregl.Map({
          container: containerRef.current,
          style: STYLE_URL,
          center: [longitude, latitude],
          zoom: 14,
          attributionControl: false,
        });
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

        const markerEl = buildMarkerElement(colors.accent);
        const marker = new maplibregl.Marker({ element: markerEl, draggable, anchor: 'center' })
          .setLngLat([longitude, latitude])
          .addTo(map);

        if (draggable) {
          marker.on('dragend', () => {
            const ll = marker.getLngLat();
            onChangeRef.current?.(ll.lat, ll.lng);
          });
          map.on('click', (e) => {
            marker.setLngLat(e.lngLat);
            onChangeRef.current?.(e.lngLat.lat, e.lngLat.lng);
          });
        }

        mapRef.current = map;
        markerRef.current = marker;

        setTimeout(() => {
          if (!cancelled && mapRef.current) mapRef.current.resize();
        }, 60);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Failed to load map');
      });

    return () => {
      cancelled = true;
      if (markerRef.current) markerRef.current.remove();
      if (mapRef.current) mapRef.current.remove();
      markerRef.current = null;
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!markerRef.current || !mapRef.current) return;
    if (typeof latitude !== 'number' || typeof longitude !== 'number') return;
    const cur = markerRef.current.getLngLat();
    if (Math.abs(cur.lat - latitude) > 1e-7 || Math.abs(cur.lng - longitude) > 1e-7) {
      markerRef.current.setLngLat([longitude, latitude]);
      mapRef.current.easeTo({ center: [longitude, latitude], duration: 350 });
    }
  }, [latitude, longitude]);

  if (Platform.OS !== 'web') return null;

  return (
    <View style={[styles.wrap, { height }]}>
      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>Map failed to load</Text>
          <Text style={styles.errorHint}>{error}</Text>
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
    marginBottom: 4,
  },
  errorHint: {
    fontSize: 11,
    color: colors.textTertiary,
    textAlign: 'center',
  },
});
