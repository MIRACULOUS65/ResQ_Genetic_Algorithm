'use client';

import { useEffect, useRef, useState, useId } from 'react';

interface Marker {
  lat: number;
  lng: number;
  type: 'patient' | 'ambulance' | 'hospital';
  label?: string;
}

interface Route {
  coordinates: [number, number][]; // [lng, lat] pairs from ORS
}

interface LiveMapProps {
  center: [number, number]; // [lat, lng]
  zoom?: number;
  markers?: Marker[];
  route?: Route;
  height?: string;
}

export default function LiveMap({
  center,
  zoom = 14,
  markers = [],
  route,
  height = '400px',
}: LiveMapProps) {
  const uid = useId().replace(/:/g, '-'); // unique per instance, safe as HTML id
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const routeLayerRef = useRef<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;

    const initMap = async () => {
      // Guard: already initialized or container missing
      if (!mapRef.current || mapInstanceRef.current) return;

      const L = (await import('leaflet')).default;
      await import('leaflet/dist/leaflet.css');

      // Guard: component unmounted while awaiting imports
      if (!mounted || !mapRef.current) return;

      // Guard: Leaflet already owns this div (strict mode double-invoke)
      if ((mapRef.current as any)._leaflet_id) return;

      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      });

      const map = L.map(mapRef.current, {
        zoomControl: true,
        attributionControl: false,
      }).setView(center, zoom);

      L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        { subdomains: 'abcd', maxZoom: 19 }
      ).addTo(map);

      mapInstanceRef.current = map;
      if (mounted) setIsLoaded(true);
    };

    initMap();

    return () => {
      mounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        setIsLoaded(false);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update markers when they change
  useEffect(() => {
    if (!mapInstanceRef.current || !isLoaded) return;
    const L = require('leaflet');

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const iconColors: Record<Marker['type'], string> = {
      patient: '#ededed',
      ambulance: '#b0b0b0',
      hospital: '#7a7a7a',
    };

    markers.forEach((marker) => {
      const color = iconColors[marker.type];
      const svgIcon = L.divIcon({
        className: '',
        html: `<div style="
          width: 28px; height: 28px; border-radius: 50%;
          background: ${color}; border: 2px solid var(--bg-base);
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 2px 8px rgba(0,0,0,0.8);
          font-size: 12px; color: #050505; font-weight: 700;
        ">${marker.type === 'patient' ? '🚨' : marker.type === 'ambulance' ? '🚑' : '🏥'}</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        popupAnchor: [0, -16],
      });

      const m = L.marker([marker.lat, marker.lng], { icon: svgIcon })
        .addTo(mapInstanceRef.current);

      if (marker.label) {
        m.bindPopup(
          `<div style="background:#111;color:#eee;border:1px solid #2a2a2a;padding:6px 10px;border-radius:6px;font-family:monospace;font-size:12px">${marker.label}</div>`,
          { closeButton: false }
        );
      }

      markersRef.current.push(m);
    });
  }, [markers, isLoaded]);

  // Draw route
  useEffect(() => {
    if (!mapInstanceRef.current || !isLoaded) return;
    const L = require('leaflet');

    if (routeLayerRef.current) {
      routeLayerRef.current.remove();
      routeLayerRef.current = null;
    }

    if (route?.coordinates && route.coordinates.length > 0) {
      const latlngs = route.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]);
      routeLayerRef.current = L.polyline(latlngs, {
        color: '#ededed',
        weight: 3,
        opacity: 0.8,
      }).addTo(mapInstanceRef.current);

      mapInstanceRef.current.fitBounds(routeLayerRef.current.getBounds(), {
        padding: [30, 30],
      });
    }
  }, [route, isLoaded]);

  // Re-center when center prop changes
  useEffect(() => {
    if (mapInstanceRef.current && isLoaded) {
      mapInstanceRef.current.setView(center, zoom);
    }
  }, [center, zoom, isLoaded]);

  return (
    <div className="map-container" style={{ height }}>
      {!isLoaded && (
        <div
          className="skeleton"
          style={{
            height,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-faint)',
            fontSize: '0.875rem',
          }}
        >
          Loading map...
        </div>
      )}
      <div
        ref={mapRef}
        style={{ height, width: '100%', display: isLoaded ? 'block' : 'none' }}
        id={`live-map-${uid}`}
      />
    </div>
  );
}
