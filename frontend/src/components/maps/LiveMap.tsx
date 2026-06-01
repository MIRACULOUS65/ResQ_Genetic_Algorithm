'use client';

import { useEffect, useRef, useState, useId } from 'react';

interface Marker {
  lat: number;
  lng: number;
  type: 'patient' | 'ambulance' | 'hospital';
  label?: string;
}

interface Route {
  coordinates: [number, number][]; // [lng, lat] pairs
}

interface LiveMapProps {
  center: [number, number]; // [lat, lng] — only used for initial map creation
  zoom?: number;            // only used for initial map creation
  markers?: Marker[];
  route?: Route;
  height?: string;
}

function buildStyle() {
  return {
    version: 8 as const,
    sources: {
      carto: {
        type: 'raster' as const,
        tiles: [
          'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
          'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
          'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
        ],
        tileSize: 256,
        maxzoom: 19,
        attribution: '© <a href="https://carto.com/">CARTO</a> © <a href="https://www.openstreetmap.org/copyright">OSM</a>',
      },
    },
    layers: [{ id: 'carto-dark', type: 'raster' as const, source: 'carto' }],
  };
}

function createMarkerEl(type: Marker['type']): HTMLElement {
  const el = document.createElement('div');
  el.style.cursor = 'pointer';
  el.style.transition = 'transform 0.2s ease';
  el.style.filter = 'drop-shadow(0 3px 10px rgba(0,0,0,0.95))';
  el.addEventListener('mouseenter', () => { el.style.transform = 'scale(1.18)'; });
  el.addEventListener('mouseleave', () => { el.style.transform = 'scale(1)'; });

  const cfg: Record<Marker['type'], { emoji: string; bg: string; border: string; size: number }> = {
    patient:   { emoji: '🚨', bg: '#EDEDED', border: '#050505', size: 40 },
    ambulance: { emoji: '🚑', bg: '#111111', border: '#EDEDED', size: 44 },
    hospital:  { emoji: '🏥', bg: '#0A0A0A', border: '#7A7A7A', size: 36 },
  };
  const { emoji, bg, border, size } = cfg[type];
  el.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${size/2}" cy="${size/2}" r="${size/2-2}" fill="${bg}" stroke="${border}" stroke-width="2.5"/>
      <text x="${size/2}" y="${size/2+6}" text-anchor="middle" font-size="${Math.round(size*0.44)}">${emoji}</text>
    </svg>`;
  return el;
}

// Key by type only — one of each at most, so position updates reuse the
// same MapLibre Marker instance via setLngLat() (smooth, no flicker).
const markerKey = (m: Marker) => m.type;

export default function LiveMap({
  center,
  zoom = 14,
  markers = [],
  route,
  height = '400px',
}: LiveMapProps) {
  const uid = useId().replace(/:/g, '-');
  const containerRef = useRef<HTMLDivElement>(null);

  const mapRef    = useRef<any>(null);
  const mlRef     = useRef<typeof import('maplibre-gl') | null>(null);

  // type → MapLibre Marker instance
  const markerMapRef  = useRef<Map<string, any>>(new Map());
  const activeKeysRef = useRef<Set<string>>(new Set());

  // Fire fitBounds ONCE when both patient + ambulance are on the map together.
  // After that the user can zoom/pan freely without interference.
  const hasFittedBothRef = useRef(false);
  // Same idea for the route: fit to the route once, never snap again.
  const hasFittedRouteRef = useRef(false);

  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  // ─── Init map (runs once) ─────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;

    (async () => {
      if (!containerRef.current || mapRef.current) return;

      const ml = await import('maplibre-gl');
      await import('maplibre-gl/dist/maplibre-gl.css');
      if (!mounted || !containerRef.current) return;

      mlRef.current = ml;

      try {
        const map = new ml.Map({
          container: containerRef.current,
          style: buildStyle() as any,
          center: [center[1], center[0]], // [lng, lat]
          zoom,
          attributionControl: false,
          fadeDuration: 150,
        });

        map.addControl(new ml.AttributionControl({ compact: true }), 'bottom-right');
        map.addControl(new ml.NavigationControl({ showCompass: false }), 'bottom-right');

        map.on('load', () => {
          if (mounted) { mapRef.current = map; setIsLoaded(true); }
        });
        map.on('error', (e: any) => console.warn('[LiveMap]', e));
      } catch (err) {
        console.error('[LiveMap] init failed:', err);
        if (mounted) setHasError(true);
      }
    })();

    return () => {
      mounted = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerMapRef.current.clear();
        activeKeysRef.current.clear();
        hasFittedBothRef.current = false;
        hasFittedRouteRef.current = false;
        setIsLoaded(false);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // ← intentionally empty: center/zoom only apply at creation time

  // ─── Markers — smart diff, NO full destroy/recreate ──────────────────────
  useEffect(() => {
    const map = mapRef.current;
    const ml  = mlRef.current;
    if (!map || !ml || !isLoaded) return;

    const incomingKeys = new Set<string>();

    markers.forEach((marker) => {
      const key = markerKey(marker);
      incomingKeys.add(key);

      if (markerMapRef.current.has(key)) {
        // Already on map — reposition smoothly (no DOM teardown)
        markerMapRef.current.get(key).setLngLat([marker.lng, marker.lat]);
      } else {
        // New marker type — create once
        const el = createMarkerEl(marker.type);
        const mapMarker = new ml.Marker({ element: el, anchor: 'center' })
          .setLngLat([marker.lng, marker.lat])
          .addTo(map);

        if (marker.label) {
          const popup = new ml.Popup({
            offset: 24, closeButton: false, closeOnClick: false, maxWidth: '240px',
          }).setHTML(
            `<div style="background:#111;color:#EDEDED;border:1px solid #2A2A2A;padding:6px 12px;border-radius:6px;font-family:ui-monospace,monospace;font-size:11px;white-space:nowrap">${marker.label}</div>`
          );
          el.addEventListener('click', () => {
            mapMarker.getPopup()?.isOpen()
              ? mapMarker.getPopup()?.remove()
              : (mapMarker.setPopup(popup), mapMarker.togglePopup());
          });
        }

        markerMapRef.current.set(key, mapMarker);
        activeKeysRef.current.add(key);
      }
    });

    // Remove markers that are no longer in the incoming list
    const toRemove: string[] = [];
    for (const key of activeKeysRef.current) {
      if (!incomingKeys.has(key)) toRemove.push(key);
    }
    toRemove.forEach((key) => {
      markerMapRef.current.get(key)?.remove();
      markerMapRef.current.delete(key);
    });
    activeKeysRef.current = incomingKeys;

    // ── One-time fitBounds when both patient + ambulance are visible ────────
    // This gives the user a perfect initial view of both pins.
    // After this fires once, the user can zoom/pan freely — we never auto-pan again.
    if (!hasFittedBothRef.current && incomingKeys.size >= 2) {
      hasFittedBothRef.current = true;
      const lats = markers.map((m) => m.lat);
      const lngs = markers.map((m) => m.lng);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);

      // Only fit if markers are actually at different positions
      const latDiff = maxLat - minLat;
      const lngDiff = maxLng - minLng;
      if (latDiff > 0.0001 || lngDiff > 0.0001) {
        map.fitBounds(
          [[minLng, minLat], [maxLng, maxLat]],
          { padding: 100, duration: 700, maxZoom: 15 }
        );
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markers, isLoaded]);

  // ─── Route polyline ────────────────────────────────────────────────────────
  // Smart update: create the source/layers once, then only swap the GeoJSON data
  // on subsequent route changes. fitBounds runs ONCE (first non-empty route) so
  // the user's zoom/pan is never snapped back on live route updates.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isLoaded) return;

    const SRC = 'live-route', GLOW = 'live-route-glow', LINE = 'live-route-line';

    // No route → tear down any existing layers/source and reset the fit flag.
    if (!route?.coordinates?.length) {
      [GLOW, LINE].forEach((id) => { if (map.getLayer(id)) map.removeLayer(id); });
      if (map.getSource(SRC)) map.removeSource(SRC);
      hasFittedRouteRef.current = false;
      return;
    }

    const geojson = {
      type: 'Feature' as const,
      properties: {},
      geometry: { type: 'LineString' as const, coordinates: route.coordinates },
    };

    const existing = map.getSource(SRC);
    if (existing) {
      // Smooth update — just replace the line data, no layer churn.
      existing.setData(geojson);
    } else {
      map.addSource(SRC, { type: 'geojson', data: geojson });
      map.addLayer({ id: GLOW, type: 'line', source: SRC,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#EDEDED', 'line-width': 10, 'line-opacity': 0.1, 'line-blur': 6 } });
      map.addLayer({ id: LINE, type: 'line', source: SRC,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#EDEDED', 'line-width': 2.5, 'line-opacity': 0.8 } });
    }

    // Fit to the full route exactly once.
    if (!hasFittedRouteRef.current) {
      hasFittedRouteRef.current = true;
      const lngs = route.coordinates.map(([lng]) => lng);
      const lats = route.coordinates.map(([, lat]) => lat);
      map.fitBounds(
        [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
        { padding: 60, duration: 700, maxZoom: 16 }
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, isLoaded]);

  // NOTE: The easeTo re-center effect has been intentionally removed.
  // Re-centering on every location update would snap the user's zoom level back
  // to the default (14) and interrupt manual panning — causing the "buggy zoom" issue.
  // The map is centered correctly at creation time. fitBounds handles the initial
  // two-pin view. After that the user has full control.

  return (
    <div className="map-container" style={{
      height, position: 'relative', borderRadius: '8px',
      overflow: 'hidden', border: '1px solid #2A2A2A', background: '#0A0A0A',
    }}>
      {!isLoaded && !hasError && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 10,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: '12px', background: '#0A0A0A',
        }}>
          <div style={{
            width: 32, height: 32, border: '2px solid #2A2A2A',
            borderTopColor: '#EDEDED', borderRadius: '50%',
            animation: 'spin 0.85s linear infinite',
          }} />
          <span style={{ fontSize: '0.8rem', color: '#7A7A7A', letterSpacing: '0.06em', fontFamily: 'monospace' }}>
            Loading map...
          </span>
        </div>
      )}

      {hasError && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 10,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: '8px', background: '#0A0A0A', color: '#7A7A7A', fontSize: '0.875rem',
        }}>
          <span style={{ fontSize: '1.5rem' }}>⚠️</span>Map failed to load
        </div>
      )}

      <div ref={containerRef} id={`livemap-${uid}`} style={{ width: '100%', height: '100%' }} />

      <style>{`
        #livemap-${uid} .maplibregl-ctrl-attrib {
          background: rgba(10,10,10,0.85) !important; color: #7A7A7A !important;
          font-size: 10px !important; border-radius: 4px !important; border: 1px solid #2A2A2A !important;
        }
        #livemap-${uid} .maplibregl-ctrl-attrib a { color: #B0B0B0 !important; }
        #livemap-${uid} .maplibregl-ctrl-group {
          background: #111111 !important; border: 1px solid #2A2A2A !important;
          border-radius: 6px !important; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.6) !important;
        }
        #livemap-${uid} .maplibregl-ctrl-group button {
          background: #111111 !important; border-bottom-color: #2A2A2A !important; color: #EDEDED;
        }
        #livemap-${uid} .maplibregl-ctrl-group button:hover { background: #1A1A1A !important; }
        #livemap-${uid} .maplibregl-ctrl-icon { filter: invert(1); opacity: 0.75; }
        #livemap-${uid} .maplibregl-popup-content {
          background: transparent !important; padding: 0 !important; box-shadow: none !important;
        }
        #livemap-${uid} .maplibregl-popup-tip { display: none !important; }
      `}</style>
    </div>
  );
}
