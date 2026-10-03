import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import { Navigation, Volume2, VolumeX, AlertCircle } from 'lucide-react';
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
  className?: string;
};

export function InternalNavigator({
  destination,
  onPositionUpdate,
  className,
}: InternalNavigatorProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const destinationMarkerRef = useRef<mapboxgl.Marker | null>(null);

  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [currentInstruction, setCurrentInstruction] = useState('Calculando ruta GPS en vivo...');
  const [distanceText, setDistanceText] = useState('--');
  const [durationText, setDurationText] = useState('--');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const lastSpokenInstruction = useRef<string>('');
  const voiceEnabledRef = useRef(voiceEnabled);
  const lastUserCoords = useRef<[number, number] | null>(null);
  const hasArrived = useRef<boolean>(false);

  useEffect(() => {
    voiceEnabledRef.current = voiceEnabled;
  }, [voiceEnabled]);

  const speak = (text: string) => {
    if (!voiceEnabledRef.current || !('speechSynthesis' in window)) return;
    // Si la instrucción es idéntica, no se repite en bucle (evita spam si estás detenido)
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

    const resolveDestCoords = async (dest?: NavigatorDestination): Promise<[number, number] | null> => {
      if (dest?.addressText && dest.addressText.trim().length > 0) {
        try {
          const query = encodeURIComponent(`${dest.addressText}, Guatemala`);
          const res = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?access_token=${mapboxgl.accessToken}&country=gt&limit=1`
          );
          const data = await res.json();
          if (data.features && data.features.length > 0) {
            return data.features[0].center as [number, number];
          }
        } catch {
          // Fallback
        }
      }

      if (dest?.longitude !== undefined && dest?.latitude !== undefined && dest.longitude !== 0 && dest.latitude !== 0) {
        return [dest.longitude, dest.latitude];
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
          
          setDistanceText((distanceMeters / 1000).toFixed(1) + ' km');
          setDurationText(Math.ceil(route.duration / 60) + ' min');

          // Comportamiento Waze al llegar (< 30 metros del destino)
          if (distanceMeters < 30) {
            if (!hasArrived.current) {
              hasArrived.current = true;
              const arrivalMsg = 'Has llegado a tu destino.';
              setCurrentInstruction(arrivalMsg);
              speak(arrivalMsg);
            }
            return;
          } else {
            hasArrived.current = false;
          }

          if (route.legs?.[0]?.steps?.[0]) {
            const instruction = route.legs[0].steps[0].maneuver.instruction;
            setCurrentInstruction(instruction);
            speak(instruction); // Habla de forma progresiva según cambie la instrucción de Mapbox
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
      const destCoords = await resolveDestCoords(destination);
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
          (err) => {
            setErrorMsg('Buscando señal GPS...');
            console.warn(err);
          },
          { enableHighAccuracy: false, maximumAge: 30000, timeout: 20000 }
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
  }, [destination?.addressText, destination?.latitude, destination?.longitude]);

  return (
    <div className={cn('relative overflow-hidden rounded-2xl border border-emerald-200 shadow-md bg-white', className)}>
      <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between rounded-xl bg-gray-900/90 backdrop-blur-md px-4 py-2.5 text-white shadow-lg">
        <div className="flex items-center gap-3 min-w-0">
          <Navigation className="h-5 w-5 text-emerald-400 shrink-0 animate-pulse" />
          <div className="min-w-0">
            <p className="text-xs font-semibold truncate text-emerald-300">{currentInstruction}</p>
            <p className="text-[10px] text-gray-300 truncate">Destino: {destination?.label || destination?.addressText || 'Ubicación'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0 pl-2">
          <div className="text-right">
            <span className="text-xs font-bold text-emerald-400">{distanceText}</span>
            <span className="block text-[10px] text-gray-300">{durationText}</span>
          </div>
          <button
            type="button"
            onClick={() => setVoiceEnabled(!voiceEnabled)}
            className="rounded-lg bg-white/10 p-1.5 hover:bg-white/20 transition-colors"
            title={voiceEnabled ? 'Desactivar voz' : 'Activar voz'}
          >
            {voiceEnabled ? <Volume2 className="h-4 w-4 text-emerald-400" /> : <VolumeX className="h-4 w-4 text-gray-400" />}
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="absolute bottom-3 left-3 right-3 z-10 flex items-center gap-2 rounded-lg bg-amber-500/90 p-2 text-xs text-white">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div ref={mapContainer} className="h-full w-full min-h-[320px]" />
    </div>
  );
}