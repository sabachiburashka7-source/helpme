import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { colors, radius } from './theme';

// MapLibre runs inside a WebView. We host its JS/CSS from unpkg and use
// openfreemap tiles — no Google API key needed.

const MAPLIBRE_VERSION = '4.7.1';
const MAPLIBRE_JS = `https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.js`;
const MAPLIBRE_CSS = `https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.css`;
const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

function buildHtml({ latitude, longitude, draggable, accent }) {
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

export default function MapPicker({
  latitude,
  longitude,
  onChange,
  draggable = true,
  height = 220,
}) {
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

  const html = buildHtml({
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

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
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
