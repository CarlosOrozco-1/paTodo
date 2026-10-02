import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import type { LineString } from 'geojson';
import {
  ArrowUp,
  Compass,
  CornerUpLeft,
  CornerUpRight,
  Navigation,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { JobTrackingPosition } from '@/api/firebase/jobTracking';
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || '';

interface NavigatorDestination {
  latitude: number;
  longitude: number;
  label: string;
}

interface InternalNavigatorProps {
  destination: NavigatorDestination;
  onPositionUpdate: (position: JobTrackingPosition) => void;
  className?: string;
}

interface DirectionsStep {
  distance: number;
  maneuver: { instruction: string; modifier?: string };
}

interface DirectionsRoute {
  distance: number;
  duration: number;
  geometry: LineString;
  legs?: Array<{ steps?: DirectionsStep[] }>;
}

interface DirectionsResponse {
  routes?: DirectionsRoute[];
}

interface UpcomingStep {
  instruction: string;
  distance: number;
  modifier?: string;
}

export function InternalNavigator({
  destination,
  onPositionUpdate,
  className = 'h-96 w-full',
}: InternalNavigatorProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const workerMarker = useRef<mapboxgl.Marker | null>(null);
  const destinationMarker = useRef<mapboxgl.Marker | null>(null);
  const onPositionUpdateRef = useRef(onPositionUpdate);
  const voiceEnabledRef = useRef(true);
  const lastSpokenInstruction = useRef('');
  const [currentStep, setCurrentStep] = useState('Esperando ubicación GPS…');
  const [distanceRemaining, setDistanceRemaining] = useState('--');
  const [durationRemaining, setDurationRemaining] = useState('--');
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [upcomingSteps, setUpcomingSteps] = useState<UpcomingStep[]>([]);
  const mapUnavailable = !mapboxgl.accessToken;

  useEffect(() => {
    onPositionUpdateRef.current = onPositionUpdate;
  }, [onPositionUpdate]);

  useEffect(() => {
    voiceEnabledRef.current = voiceEnabled;
  }, [voiceEnabled]);

  useEffect(() => {
    if (!mapContainer.current || !mapboxgl.accessToken) return;

    let mounted = true;
    let watchId: number | undefined;
    let firstFit = true;
    let lastDirectionsRequest = 0;
    let directionsRequestId = 0;

    const currentMap = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [destination.longitude, destination.latitude],
      zoom: 14,
    });
    map.current = currentMap;

    const destinationElement = document.createElement('div');
    destinationElement.className =
      'flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-amber-500 text-xs font-bold text-white shadow-lg';
    destinationElement.textContent = 'B';
    const popupContent = document.createElement('span');
    popupContent.textContent = destination.label;
    destinationMarker.current = new mapboxgl.Marker(destinationElement)
      .setLngLat([destination.longitude, destination.latitude])
      .setPopup(new mapboxgl.Popup().setDOMContent(popupContent))
      .addTo(currentMap);

    const addRoute = (geometry: LineString) => {
      if (!mounted || currentMap !== map.current) return;
      const data = { type: 'Feature' as const, properties: {}, geometry };
      if (currentMap.getSource('route')) {
        (currentMap.getSource('route') as mapboxgl.GeoJSONSource).setData(data);
      } else {
        currentMap.addSource('route', { type: 'geojson', data });
        currentMap.addLayer({
          id: 'route',
          type: 'line',
          source: 'route',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#059669', 'line-width': 6, 'line-opacity': 0.9 },
        });
      }
    };

    const updatePosition = async (position: GeolocationPosition) => {
      if (!mounted || currentMap !== map.current) return;
      const { latitude, longitude, accuracy, heading, speed } = position.coords;
      onPositionUpdateRef.current({
        latitude,
        longitude,
        accuracyMeters: Number.isFinite(accuracy) ? accuracy : undefined,
        headingDegrees: heading === null ? undefined : heading,
        speedMetersPerSecond: speed === null ? undefined : speed,
      });

      if (!workerMarker.current) {
        const markerElement = document.createElement('div');
        markerElement.className =
          'flex h-10 w-10 items-center justify-center rounded-full border-3 border-white bg-emerald-600 text-sm font-bold text-white shadow-xl';
        markerElement.textContent = 'T';
        workerMarker.current = new mapboxgl.Marker(markerElement)
          .setLngLat([longitude, latitude])
          .addTo(currentMap);
      } else {
        workerMarker.current.setLngLat([longitude, latitude]);
      }

      if (firstFit) {
        const bounds = new mapboxgl.LngLatBounds();
        bounds.extend([longitude, latitude]);
        bounds.extend([destination.longitude, destination.latitude]);
        currentMap.fitBounds(bounds, { padding: 72, maxZoom: 15, duration: 700 });
        firstFit = false;
      }

      const now = Date.now();
      if (now - lastDirectionsRequest < 12000) return;
      lastDirectionsRequest = now;
      const requestId = ++directionsRequestId;

      try {
        const response = await fetch(
          `https://api.mapbox.com/directions/v5/mapbox/driving/${longitude},${latitude};${destination.longitude},${destination.latitude}?geometries=geojson&steps=true&language=es&access_token=${mapboxgl.accessToken}`,
        );
        if (!response.ok) throw new Error('Directions request failed');
        const result = (await response.json()) as DirectionsResponse;
        const route = result.routes?.[0];
        if (!route || !mounted || requestId !== directionsRequestId) return;

        setDistanceRemaining(`${(route.distance / 1000).toFixed(1)} km`);
        setDurationRemaining(`${Math.round(route.duration / 60)} min`);
        const steps = route.legs?.[0]?.steps ?? [];
        const nextStep = steps[0];
        if (nextStep) {
          const metres = Math.round(nextStep.distance);
          const instruction = nextStep.maneuver.instruction;
          const text = metres > 10 ? `En ${metres} m: ${instruction}` : instruction;
          setCurrentStep(text);
          if (
            voiceEnabledRef.current &&
            'speechSynthesis' in window &&
            text !== lastSpokenInstruction.current
          ) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'es-ES';
            window.speechSynthesis.speak(utterance);
            lastSpokenInstruction.current = text;
          }
          setUpcomingSteps(
            steps.slice(1, 4).map((step) => ({
              instruction: step.maneuver.instruction,
              distance: Math.round(step.distance),
              modifier: step.maneuver.modifier,
            })),
          );
        }

        if (currentMap.isStyleLoaded()) addRoute(route.geometry);
        else currentMap.once('load', () => addRoute(route.geometry));
      } catch {
        if (mounted && requestId === directionsRequestId) {
          setCurrentStep('No se pudo actualizar la ruta. Sigue hacia el destino.');
        }
      }
    };

    if ('geolocation' in navigator) {
      watchId = navigator.geolocation.watchPosition(
        (position) => void updatePosition(position),
        () => setCurrentStep('Permite el acceso a la ubicación para iniciar la navegación.'),
        { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 },
      );
    }

    return () => {
      mounted = false;
      if (watchId !== undefined) navigator.geolocation.clearWatch(watchId);
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      currentMap.remove();
      map.current = null;
      workerMarker.current = null;
      destinationMarker.current = null;
    };
  }, [destination.latitude, destination.longitude, destination.label]);

  if (mapUnavailable) {
    return <div className={`flex items-center justify-center bg-gray-100 text-sm text-gray-600 ${className}`}>No se pudo cargar el mapa.</div>;
  }

  return (
    <div className={`relative flex flex-col overflow-hidden rounded-xl border border-gray-200 ${className}`}>
      <div className="absolute inset-x-3 top-3 z-10 flex items-center gap-3 rounded-xl border border-gray-700/60 bg-gray-950/95 p-3 text-white shadow-xl">
        <div className="shrink-0 rounded-lg bg-emerald-600 p-2">
          <Navigation className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-emerald-300">
              <Compass className="h-3 w-3" /> GPS en vivo
            </span>
            <button
              type="button"
              aria-label={voiceEnabled ? 'Silenciar instrucciones' : 'Activar instrucciones'}
              onClick={() => setVoiceEnabled((enabled) => !enabled)}
              className="rounded p-1 text-gray-300 hover:text-white"
            >
              {voiceEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </button>
          </div>
          <p className="mt-1 truncate text-sm font-semibold">{currentStep}</p>
        </div>
        <div className="shrink-0 border-l border-gray-700 pl-3 text-right">
          <p className="text-sm font-bold text-emerald-300">{distanceRemaining}</p>
          <p className="text-[10px] text-gray-300">{durationRemaining}</p>
        </div>
      </div>

      {upcomingSteps.length > 0 && (
        <div className="absolute inset-x-3 bottom-3 z-10 rounded-xl border border-gray-700/60 bg-gray-950/90 px-3 py-2 text-white shadow-lg">
          <p className="text-[10px] font-bold uppercase text-gray-400">Siguientes giros</p>
          {upcomingSteps.slice(0, 2).map((step, index) => (
            <div key={`${step.instruction}-${index}`} className="flex items-center justify-between gap-2 border-t border-gray-800 py-1.5 text-xs">
              <span className="flex min-w-0 items-center gap-2 truncate">
                {step.modifier?.includes('left') ? (
                  <CornerUpLeft className="h-4 w-4 shrink-0 text-amber-300" />
                ) : step.modifier?.includes('right') ? (
                  <CornerUpRight className="h-4 w-4 shrink-0 text-amber-300" />
                ) : (
                  <ArrowUp className="h-4 w-4 shrink-0 text-emerald-300" />
                )}
                <span className="truncate">{step.instruction}</span>
              </span>
              <span className="shrink-0 text-gray-300">{step.distance} m</span>
            </div>
          ))}
        </div>
      )}
      <div ref={mapContainer} className="h-full w-full" />
    </div>
  );
}