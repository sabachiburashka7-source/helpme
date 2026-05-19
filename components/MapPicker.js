import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Platform, StyleSheet } from 'react-native';
import { colors, radius } from './theme';

const MAPLIBRE_VERSION = '4.7.1';
const MAPLIBRE_JS = `https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.js`;
const MAPLIBRE_CSS = `https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.css`;
const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

// =====================================================================
// Web — MapLibre injected directly into the DOM (original implementation)
// =====================================================================

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
  const el = document.createElement('div');
  el.style.cssText = 'width: 26px; height: 26px; cursor: grab;';

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

function MapPickerWeb({ latitude, longitude, onChange, draggable, height }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const [error, setError] = useState(null);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
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

// =====================================================================
// Native — same MapLibre, but rendered inside a WebView
// =====================================================================

function buildNativeHtml({ latitude, longitude, draggable, accent }) {
  const safeLat = Number(latitude) || 0;
  const safeLng = Number(longitude) || 0;
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<link rel="stylesheet" href="${MAPLIBRE_CSS}" />
<script src="${MAPLIBRE_JS}"></script>
<style>
  html, body, #map { margin: 0; padding: 0; height: 100%; width: 100%; background: #eef0f4; }
  .pin { width: 26px; height: 26px; border-radius: 50%;
         background: ${accent}; border: 3px solid #fff;
         box-shadow: 0 4px 10px rgba(0,0,0,0.28), 0 0 0 1px rgba(122,18,48,0.18);
         box-sizing: border-box; }
</style>
</head>
<body>
<div id="map"></div>
<script>
  function post(msg) {
    try {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify(msg));
      }
    } catch (e) {}
  }
  window.onerror = function (message, source, lineno, colno, error) {
    post({ type: 'error', message: String(message) + ' @' + lineno + ':' + colno });
    return false;
  };
  if (typeof maplibregl === 'undefined') {
    post({ type: 'error', message: 'MapLibre script failed to load' });
    throw new Error('MapLibre missing');
  }
  var map = new maplibregl.Map({
    container: 'map',
    style: '${STYLE_URL}',
    center: [${safeLng}, ${safeLat}],
    zoom: 14,
    attributionControl: false,
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

  var el = document.createElement('div');
  el.className = 'pin';
  var marker = new maplibregl.Marker({ element: el, draggable: ${draggable ? 'true' : 'false'}, anchor: 'center' })
    .setLngLat([${safeLng}, ${safeLat}])
    .addTo(map);

  ${draggable ? `
  marker.on('dragend', function () {
    var ll = marker.getLngLat();
    post({ type: 'pin', lat: ll.lat, lng: ll.lng });
  });
  map.on('click', function (e) {
    marker.setLngLat(e.lngLat);
    post({ type: 'pin', lat: e.lngLat.lat, lng: e.lngLat.lng });
  });` : ''}

  // Allow the parent to move the pin programmatically without a full reload.
  document.addEventListener('message', handleParentMsg);
  window.addEventListener('message', handleParentMsg);
  function handleParentMsg(ev) {
    try {
      var data = JSON.parse(ev.data);
      if (data && data.type === 'setPin' && typeof data.lat === 'number' && typeof data.lng === 'number') {
        marker.setLngLat([data.lng, data.lat]);
        map.easeTo({ center: [data.lng, data.lat], duration: 350 });
      }
    } catch (e) {}
  }
  post({ type: 'ready' });
</script>
</body>
</html>`;
}

function MapPickerNative({ latitude, longitude, onChange, draggable, height }) {
  // Lazy-require so the web bundle never pulls in react-native-webview.
  const { WebView } = require('react-native-webview');
  const webRef = useRef(null);
  const lastSentRef = useRef({ lat: latitude, lng: longitude });
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [errorMsg, setErrorMsg] = useState('');

  // Keep the WebView pin in sync when the parent updates lat/lng.
  useEffect(() => {
    if (typeof latitude !== 'number' || typeof longitude !== 'number') return;
    const { lat, lng } = lastSentRef.current;
    if (Math.abs((lat ?? 0) - latitude) < 1e-7 && Math.abs((lng ?? 0) - longitude) < 1e-7) return;
    lastSentRef.current = { lat: latitude, lng: longitude };
    if (webRef.current) {
      webRef.current.postMessage(JSON.stringify({ type: 'setPin', lat: latitude, lng: longitude }));
    }
  }, [latitude, longitude]);

  const html = buildNativeHtml({
    latitude,
    longitude,
    draggable,
    accent: colors.accent,
  });

  function handleMessage(event) {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'pin' && typeof data.lat === 'number' && typeof data.lng === 'number') {
        lastSentRef.current = { lat: data.lat, lng: data.lng };
        onChange?.(data.lat, data.lng);
      } else if (data.type === 'ready') {
        setStatus('ready');
      } else if (data.type === 'error') {
        setStatus('error');
        setErrorMsg(data.message || 'Map error');
      }
    } catch {}
  }

  return (
    <View style={[styles.wrap, { height }]}>
      <WebView
        ref={webRef}
        originWhitelist={['*']}
        source={{ html, baseUrl: 'https://localhost' }}
        onMessage={handleMessage}
        onError={(e) => {
          setStatus('error');
          setErrorMsg(e?.nativeEvent?.description || 'WebView failed to load');
        }}
        onHttpError={(e) => {
          setStatus('error');
          setErrorMsg(`HTTP ${e?.nativeEvent?.statusCode || '?'} loading map`);
        }}
        style={{ flex: 1, backgroundColor: 'transparent' }}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        mixedContentMode="always"
        allowFileAccess
        allowUniversalAccessFromFileURLs
      />
      {status !== 'ready' ? (
        <View style={styles.overlay} pointerEvents="none">
          <Text style={styles.overlayText}>
            {status === 'error' ? `Map: ${errorMsg}` : 'Loading map…'}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

// =====================================================================
// Entry point — picks the right implementation per platform.
// =====================================================================

export default function MapPicker({
  latitude,
  longitude,
  onChange,
  draggable = true,
  height = 220,
}) {
  if (Platform.OS === 'web') {
    return (
      <MapPickerWeb
        latitude={latitude}
        longitude={longitude}
        onChange={onChange}
        draggable={draggable}
        height={height}
      />
    );
  }
  return (
    <MapPickerNative
      latitude={latitude}
      longitude={longitude}
      onChange={onChange}
      draggable={draggable}
      height={height}
    />
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
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(244,242,250,0.85)',
  },
  overlayText: {
    fontSize: 12,
    color: colors.textTertiary,
    fontWeight: '600',
    paddingHorizontal: 12,
    textAlign: 'center',
  },
});
