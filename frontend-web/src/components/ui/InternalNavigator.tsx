import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/utils/cn';
import type { JobTrackingPosition } from '@/api/firebase/jobTracking';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || '';

export type NavigatorDestination = {
  latitude?: number;
  longitude?: number;
  addressText?: string;
  label?: string;
};

type InternalNavigatorProps = {
  destination?: NavigatorDestination;
  onPositionUpdate?: (position: JobTrackingPosition) => void;
  onInstructionChange?: (instruction: string) => void;
  // NUEVO: Pasamos el tiempo y distancia exactos de la ruta verde hacia las tarjetas
  onRouteCalculated?: (distanceMeters: number, durationSeconds: number) => void;
  voiceEnabled?: boolean;
  className?: string;
};

export function InternalNavigator({
  destination,
  onPositionUpdate,
  onInstructionChange,
  onRouteCalculated,
  voiceEnabled = true,
  className,
}: InternalNavigatorProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const destinationMarkerRef = useRef<mapboxgl.Marker | null>(null);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const lastSpokenInstruction = useRef<string>('');
  const voiceEnabledRef = useRef(voiceEnabled);
  const lastUserCoords = useRef<[number, number] | null>(null);
  const hasArrived = useRef<boolean>(false);

  const destAddress = destination?.addressText;
  const destLat = destination?.latitude;
  const destLng = destination?.longitude;

  useEffect(() => {
    voiceEnabledRef.current = voiceEnabled;
  }, [voiceEnabled]);

  const speak = (text: string) => {
    if (!voiceEnabledRef.current || !('speechSynthesis' in window)) return;
    if (lastSpokenInstruction.current === text) return;
    lastSpokenInstruction.current = text;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-ES';
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    if (!mapContainer.current || !mapboxgl.accessToken) return;

    let mounted = true;
    let watchId: number | null = null;

    const currentMap = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/navigation-day-v1',
      center: [-90.5069, 14.6349],
      zoom: 15,
      pitch: 45,
    });
    map.current = currentMap;

    const resolveDestCoords = async (): Promise<[number, number] | null> => {
      if (destAddress && destAddress.trim().length > 0) {
        try {
          const query = encodeURIComponent(`${destAddress}, Guatemala`);
          const res = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?access_token=${mapboxgl.accessToken}&country=gt&limit=1`
          );
          const data = await res.json();
          if (data.features && data.features.length > 0) {
            return data.features[0].center as [number, number];
          }
        } catch {
          // Fallback silencioso
        }
      }
      if (destLng !== undefined && destLat !== undefined && destLng !== 0 && destLat !== 0) {
        return [destLng, destLat];
      }
      return [-90.5069, 14.6349];
    };

    const fetchRoute = async (userCoords: [number, number], destCoords: [number, number]) => {
      if (!map.current || !mounted) return;
      try {
        const res = await fetch(
          `https://api.mapbox.com/directions/v5/mapbox/driving/${userCoords[0]},${userCoords[1]};${destCoords[0]},${destCoords[1]}?steps=true&geometries=geojson&language=es&access_token=${mapboxgl.accessToken}`
        );
        const data = await res.json();
        if (data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          const distanceMeters = route.distance;
          
          // NUEVO: Enviar la distancia y duración 100% exactas de la ruta pintada
          if (onRouteCalculated) {
            onRouteCalculated(distanceMeters, route.duration);
          }
          
          if (distanceMeters < 30) {
            if (!hasArrived.current) {
              hasArrived.current = true;
              const arrivalMsg = 'Has llegado a tu destino.';
              if (onInstructionChange) onInstructionChange(arrivalMsg);
              speak(arrivalMsg);
            }
            return;
          } else {
            hasArrived.current = false;
          }

          if (route.legs?.[0]?.steps?.[0]) {
            const instruction = route.legs[0].steps[0].maneuver.instruction;
            if (onInstructionChange) onInstructionChange(instruction);
            speak(instruction); 
          }

          if (map.current.getSource('route-nav')) {
            (map.current.getSource('route-nav') as mapboxgl.GeoJSONSource).setData({
              type: 'Feature',
              properties: {},
              geometry: route.geometry,
            });
          } else {
            map.current.addSource('route-nav', {
              type: 'geojson',
              data: {
                type: 'Feature',
                properties: {},
                geometry: route.geometry,
              },
            });
            map.current.addLayer({
              id: 'route-nav-layer',
              type: 'line',
              source: 'route-nav',
              layout: { 'line-join': 'round', 'line-cap': 'round' },
              paint: { 'line-color': '#059669', 'line-width': 6, 'line-opacity': 0.85 },
            });
          }
        }
      } catch {
        // Red silenciosa
      }
    };

    const initNavigator = async () => {
      const destCoords = await resolveDestCoords();
      if (!mounted || !destCoords) return;

      if (!destinationMarkerRef.current) {
        const destEl = document.createElement('div');
        destEl.className = 'w-8 h-8 bg-amber-500 border-2 border-white rounded-full shadow-lg flex items-center justify-center text-white font-bold text-xs';
        destEl.innerText = 'B';
        destinationMarkerRef.current = new mapboxgl.Marker(destEl).setLngLat(destCoords).addTo(currentMap);
      } else {
        destinationMarkerRef.current.setLngLat(destCoords);
      }

      if (navigator.geolocation) {
        watchId = navigator.geolocation.watchPosition(
          async (position) => {
            if (!mounted || !map.current) return;
            setErrorMsg(null);
            const { latitude, longitude, heading } = position.coords;
            onPositionUpdate?.({ latitude, longitude });

            const userCoords: [number, number] = [longitude, latitude];
            lastUserCoords.current = userCoords;

            if (!markerRef.current) {
              const el = document.createElement('div');
              el.className = 'w-11 h-11 bg-emerald-600 rounded-full border-4 border-white shadow-2xl flex items-center justify-center text-white transition-transform duration-300';
              el.innerHTML = '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>';
              markerRef.current = new mapboxgl.Marker(el).setLngLat(userCoords).addTo(currentMap);
            } else {
              markerRef.current.setLngLat(userCoords);
              if (heading !== null && !isNaN(heading)) {
                const el = markerRef.current.getElement();
                el.style.transform = `rotate(${heading}deg)`;
              }
            }

            currentMap.easeTo({ center: userCoords, duration: 1000, pitch: 50 });
            await fetchRoute(userCoords, destCoords);
          },
          () => {
            setErrorMsg('Buscando señal GPS...');
          },
          { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
        );
      }
    };

    initNavigator();

    return () => {
      mounted = false;
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      currentMap.remove();
      markerRef.current = null;
      destinationMarkerRef.current = null;
    };
  }, [destAddress, destLat, destLng]);

  return (
    <div className={cn('relative overflow-hidden rounded-2xl border border-emerald-200 shadow-md bg-white', className)}>
      {errorMsg && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 rounded-lg bg-amber-500/90 px-4 py-2 text-sm font-semibold text-white shadow-lg">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
      <div ref={mapContainer} className="h-full w-full min-h-[320px]" />
    </div>
  );
}