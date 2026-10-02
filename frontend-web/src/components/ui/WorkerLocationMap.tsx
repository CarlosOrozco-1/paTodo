import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import { MapPin } from 'lucide-react';
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

export function WorkerLocationMap({ jobId, destination }: WorkerLocationMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const workerMarker = useRef<mapboxgl.Marker | null>(null);
  const hasFitBounds = useRef(false);
  const [tracking, setTracking] = useState<{
    jobId: string;
    position: JobTrackingSnapshot | null;
  } | null>(null);
  const [trackingErrorJobId, setTrackingErrorJobId] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const mapUnavailable = !mapboxgl.accessToken;
  const position = tracking?.jobId === jobId ? tracking.position : null;
  const trackingError = trackingErrorJobId === jobId;

  useEffect(() => {
    if (!mapContainer.current || !mapboxgl.accessToken) return;

    const currentMap = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [destination.longitude, destination.latitude],
      zoom: 12,
    });
    map.current = currentMap;

    const destinationElement = document.createElement('div');
    destinationElement.className =
      'flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-amber-500 text-xs font-bold text-white shadow-lg';
    destinationElement.textContent = 'D';
    const destinationPopup = document.createElement('span');
    destinationPopup.textContent = destination.label;
    new mapboxgl.Marker(destinationElement)
      .setLngLat([destination.longitude, destination.latitude])
      .setPopup(new mapboxgl.Popup().setDOMContent(destinationPopup))
      .addTo(currentMap);

    return () => {
      currentMap.remove();
      map.current = null;
      workerMarker.current = null;
      hasFitBounds.current = false;
    };
  }, [destination.latitude, destination.longitude, destination.label]);

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

  useEffect(() => {
    const currentMap = map.current;
    if (!currentMap || !position) return;

    if (!workerMarker.current) {
      const workerElement = document.createElement('div');
      workerElement.className =
        'flex h-10 w-10 items-center justify-center rounded-full border-3 border-white bg-emerald-600 text-sm font-bold text-white shadow-xl';
      workerElement.textContent = 'P';
      const workerPopup = document.createElement('span');
      workerPopup.textContent = 'Profesional';
      workerMarker.current = new mapboxgl.Marker(workerElement)
        .setLngLat([position.longitude, position.latitude])
        .setPopup(new mapboxgl.Popup().setDOMContent(workerPopup))
        .addTo(currentMap);
    } else {
      workerMarker.current.setLngLat([position.longitude, position.latitude]);
    }

    if (!hasFitBounds.current) {
      const bounds = new mapboxgl.LngLatBounds();
      bounds.extend([position.longitude, position.latitude]);
      bounds.extend([destination.longitude, destination.latitude]);
      currentMap.fitBounds(bounds, { padding: 56, maxZoom: 14 });
      hasFitBounds.current = true;
    }
  }, [position, destination.latitude, destination.longitude]);

  const updatedAt = position ? new Date(position.updatedAt) : null;
  const isStale = updatedAt && now > 0 ? now - updatedAt.getTime() > 45000 : false;

  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
          <MapPin className="h-4 w-4 text-emerald-700" />
          Seguimiento del profesional
        </div>
        <span className="text-xs text-gray-500">
          {trackingError
            ? 'Ubicación no disponible'
            : !position
              ? 'Esperando ubicación…'
              : isStale
                ? 'Última ubicación recibida'
                : 'En vivo'}
        </span>
      </div>
      {mapUnavailable ? (
        <div className="flex h-64 items-center justify-center bg-gray-50 px-4 text-center text-sm text-gray-600">
          No se pudo cargar el mapa.
        </div>
      ) : (
        <div ref={mapContainer} className="h-64 w-full" />
      )}
      {position && updatedAt && (
        <p className="px-4 py-2 text-xs text-gray-500">
          Actualizado {updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      )}
    </section>
  );
}