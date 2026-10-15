import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import { MapPin, Navigation, Plus, Minus } from 'lucide-react';
import {
  subscribeToJobTracking,
  type JobTrackingSnapshot,
} from '@/api/firebase/jobTracking';
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || '';

interface WorkerLocationMapProps {
  jobId: string;
  destination: { latitude: number; longitude: number; label: string };
}

// Convierte minutos a formato "X hr Y min" o "X min"
function formatDuration(totalMinutes: number): string {
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0 ? `${hours} hr ${minutes} min` : `${hours} hr`;
}

// Asegura el orden correcto para Mapbox en Guatemala: [Longitud (-90.x), Latitud (14.x)]
function parseCoords(val1?: number, val2?: number): [number, number] {
  if (val1 === undefined || val2 === undefined) return [-90.5069, 14.6349];
  const num1 = Number(val1);
  const num2 = Number(val2);
  if (isNaN(num1) || isNaN(num2) || (num1 === 0 && num2 === 0)) return [-90.5069, 14.6349];

  let lat = Math.abs(num1) < Math.abs(num2) ? Math.abs(num1) : Math.abs(num2);
  let lng = -Math.abs(Math.abs(num1) > Math.abs(num2) ? num1 : num2);
  return [lng, lat];
}

export function WorkerLocationMap({ jobId, destination }: WorkerLocationMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const workerMarker = useRef<mapboxgl.Marker | null>(null);
  const destinationMarker = useRef<mapboxgl.Marker | null>(null);
  const hasFitBounds = useRef(false);

  const [tracking, setTracking] = useState<{
    jobId: string;
    position: JobTrackingSnapshot | null;
  } | null>(null);
  const [trackingErrorJobId, setTrackingErrorJobId] = useState<string | null>(null);
  const [now, setNow] = useState(0);

  const [routeInfo, setRouteInfo] = useState<{ distanceKm: string; durationText: string } | null>(null);

  const mapUnavailable = !mapboxgl.accessToken;
  const position = tracking?.jobId === jobId ? tracking.position : null;
  const trackingError = trackingErrorJobId === jobId;

  // Coordenadas del Destino (Cliente)
  const destCoords = parseCoords(destination.latitude, destination.longitude);

  const handleZoomIn = () => map.current?.zoomIn();
  const handleZoomOut = () => map.current?.zoomOut();

  // Inicialización del Mapa y Marcador D (Destino)
  useEffect(() => {
    if (!mapContainer.current || !mapboxgl.accessToken) return;

    const currentMap = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: destCoords,
      zoom: 13,
    });
    map.current = currentMap;

    const destEl = document.createElement('div');
    destEl.className =
      'flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-amber-500 text-xs font-bold text-white shadow-lg cursor-pointer';
    destEl.textContent = 'D';

    const destPopup = new mapboxgl.Popup({ offset: 25, closeButton: true }).setText(
      `Destino: ${destination.label || 'Ubicación del trabajo'}`
    );

    destinationMarker.current = new mapboxgl.Marker({ element: destEl })
      .setLngLat(destCoords)
      .setPopup(destPopup)
      .addTo(currentMap);

    return () => {
      currentMap.remove();
      map.current = null;
      workerMarker.current = null;
      destinationMarker.current = null;
      hasFitBounds.current = false;
    };
  }, [destCoords[0], destCoords[1], destination.label]);

  //GPS del Profesional
  useEffect(() => {
    return subscribeToJobTracking(
      jobId,
      (nextPosition) => setTracking({ jobId, position: nextPosition }),
      () => setTrackingErrorJobId(jobId),
    );
  }, [jobId]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 10000);
    return () => window.clearInterval(timer);
  }, []);

  //  Marcador P (Profesional) y trazar Ruta
  useEffect(() => {
    const currentMap = map.current;
    if (!currentMap || !position) return;

    const workerCoords = parseCoords(position.latitude, position.longitude);

    if (!workerMarker.current) {
      const workerEl = document.createElement('div');
      workerEl.className =
        'flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-emerald-600 text-xs font-bold text-white shadow-xl cursor-pointer';
      workerEl.textContent = 'P';

      const workerPopup = new mapboxgl.Popup({ offset: 25, closeButton: true }).setText(
        'Ubicación actual del Profesional'
      );

      workerMarker.current = new mapboxgl.Marker({ element: workerEl })
        .setLngLat(workerCoords)
        .setPopup(workerPopup)
        .addTo(currentMap);
    } else {
      workerMarker.current.setLngLat(workerCoords);
    }

    if (!hasFitBounds.current) {
      const bounds = new mapboxgl.LngLatBounds();
      bounds.extend(workerCoords);
      bounds.extend(destCoords);
      currentMap.fitBounds(bounds, { padding: 60, maxZoom: 14 });
      hasFitBounds.current = true;
    }

    const fetchLiveRoute = async () => {
      try {
        const res = await fetch(
          `https://api.mapbox.com/directions/v5/mapbox/driving/${workerCoords[0]},${workerCoords[1]};${destCoords[0]},${destCoords[1]}?geometries=geojson&access_token=${mapboxgl.accessToken}`
        );
        const data = await res.json();
        if (data.routes && data.routes.length > 0) {
          const route = data.routes[0];

          const distKm = (route.distance / 1000).toFixed(1);
          const durationMins = Math.max(1, Math.round(route.duration / 60));

          setRouteInfo({
            distanceKm: distKm,
            durationText: formatDuration(durationMins),
          });

          const routeSource = currentMap.getSource('route-live') as mapboxgl.GeoJSONSource;
          if (routeSource) {
            routeSource.setData({
              type: 'Feature',
              properties: {},
              geometry: route.geometry,
            });
          } else {
            currentMap.addSource('route-live', {
              type: 'geojson',
              data: {
                type: 'Feature',
                properties: {},
                geometry: route.geometry,
              },
            });

            currentMap.addLayer({
              id: 'route-live-layer',
              type: 'line',
              source: 'route-live',
              layout: { 'line-join': 'round', 'line-cap': 'round' },
              paint: {
                'line-color': '#059669',
                'line-width': 5,
                'line-opacity': 0.85,
              },
            });
          }
        }
      } catch {
        // Ignorar fallos de red
      }
    };

    fetchLiveRoute();
  }, [position, destCoords[0], destCoords[1]]);

  const updatedAt = position ? new Date(position.updatedAt) : null;
  const isStale = updatedAt && now > 0 ? now - updatedAt.getTime() > 45000 : false;

  return (
    <section className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xs">
      <style>{`
        .mapboxgl-popup-content {
          border-radius: 12px !important;
          padding: 12px 30px 12px 14px !important;
          box-shadow: 0 4px 12px rgba(0,0,0,0.12) !important;
          font-family: inherit !important;
          font-size: 12px !important;
          color: #1f2937 !important;
        }
        .mapboxgl-popup-close-button {
          top: 6px !important;
          right: 6px !important;
          background-color: #ffffff !important;
          border-radius: 9999px !important;
          width: 20px !important;
          height: 20px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          color: #6b7280 !important;
          border: none !important;
          font-size: 14px !important;
          cursor: pointer !important;
        }
        .mapboxgl-popup-close-button:hover {
          background-color: #f3f4f6 !important;
          color: #111827 !important;
        }
      `}</style>

      {/* Encabezado */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 bg-white">
        <div className="flex items-center gap-2 text-sm font-bold text-gray-900">
          <MapPin className="h-4 w-4 text-emerald-600" />
          Seguimiento del profesional
        </div>

        {routeInfo && position && (
          <div className="flex items-center gap-2.5 rounded-full bg-emerald-50 px-3.5 py-1 border border-emerald-200/80 text-xs font-bold text-emerald-800">
            <span className="text-emerald-300">•</span>
            <span className="flex items-center gap-1 text-emerald-700">
              <Navigation className="h-3.5 w-3.5" />
              {routeInfo.distanceKm} km
            </span>
          </div>
        )}

        <span className="text-xs font-semibold text-gray-500">
          {trackingError
            ? 'Ubicación no disponible'
            : !position
              ? 'Esperando que inicie el viaje…'
              : isStale
                ? 'Última ubicación recibida'
                : 'En vivo'}
        </span>
      </div>

      {/* Mapa y Zoom */}
      {mapUnavailable ? (
        <div className="flex h-64 items-center justify-center bg-gray-50 px-4 text-center text-sm text-gray-500">
          No se pudo cargar el mapa.
        </div>
      ) : (
        <div className="relative">
          <div ref={mapContainer} className="h-64 w-full" />

          <div className="absolute right-3 bottom-3 z-10 flex flex-col gap-1.5">
            <button
              type="button"
              onClick={handleZoomIn}
              title="Acercar mapa"
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/95 backdrop-blur-md border border-gray-200 text-gray-700 shadow-md transition-transform hover:scale-105 active:scale-95 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleZoomOut}
              title="Alejar mapa"
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/95 backdrop-blur-md border border-gray-200 text-gray-700 shadow-md transition-transform hover:scale-105 active:scale-95 cursor-pointer"
            >
              <Minus className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Pie de mapa */}
      {position && updatedAt && (
        <div className="flex items-center justify-between border-t border-gray-100 px-4 py-2 text-xs text-gray-500 bg-gray-50/50">
          <span>
            Actualizado {updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          {routeInfo && (
            <span className="font-medium text-emerald-700">
              El profesional se desplaza hacia tu ubicación
            </span>
          )}
        </div>
      )}
    </section>
  );
}