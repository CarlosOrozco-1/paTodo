import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || '';

export interface JobMapLocation {
  lng?: number;
  lat?: number;
  addressText?: string;
  label?: string;
}

interface JobLocationMapProps {
  origin: JobMapLocation;
  destination?: JobMapLocation;
  className?: string;
}

export function JobLocationMap({ origin, destination, className = 'h-64 w-full' }: JobLocationMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const mapUnavailable = !mapboxgl.accessToken;
  const hasDestination = destination !== undefined;

  const originLng = origin.lng;
  const originLat = origin.lat;
  const originAddress = origin.addressText;
  const originLabel = origin.label;

  const destLng = destination?.lng;
  const destLat = destination?.lat;
  const destAddress = destination?.addressText;
  const destLabel = destination?.label;

  useEffect(() => {
    if (!mapContainer.current || !mapboxgl.accessToken) return;

    let mounted = true;
    const currentMap = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [-90.5069, 14.6349],
      zoom: 11,
    });
    map.current = currentMap;

    // PRIORIDAD AL TEXTO DE LA DIRECCIÓN: Evita que coordenadas de prueba/mock idénticas arruinen el mapa
    const resolveCoords = async (loc: JobMapLocation): Promise<[number, number] | null> => {
      if (loc.addressText && loc.addressText.trim().length > 0) {
        try {
          const query = encodeURIComponent(`${loc.addressText}, Guatemala`);
          const res = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?access_token=${mapboxgl.accessToken}&country=gt&limit=1`
          );
          const data = await res.json();
          if (data.features && data.features.length > 0) {
            return data.features[0].center as [number, number];
          }
        } catch {
          // Si falla la red, intenta con las coordenadas directas abajo
        }
      }

      // Si no hay texto o falló la red, usamos las coordenadas numéricas directas
      if (loc.lng !== undefined && loc.lat !== undefined && loc.lng !== 0 && loc.lat !== 0) {
        return [loc.lng, loc.lat];
      }

      return null;
    };

    const setupMapData = async () => {
      const [originCoords, destCoords] = await Promise.all([
        resolveCoords({
          lng: originLng,
          lat: originLat,
          addressText: originAddress,
          label: originLabel,
        }),
        hasDestination
          ? resolveCoords({
              lng: destLng,
              lat: destLat,
              addressText: destAddress,
              label: destLabel,
            })
          : Promise.resolve(null),
      ]);

      if (!mounted || !originCoords) return;

      // Marcador A (Origen)
      const originEl = document.createElement('div');
      originEl.className =
        'w-7 h-7 bg-emerald-600 border-2 border-white rounded-full shadow-lg flex items-center justify-center text-white text-xs font-bold';
      originEl.innerText = 'A';

      new mapboxgl.Marker(originEl)
        .setLngLat(originCoords)
        .setPopup(new mapboxgl.Popup().setText(originLabel || 'Ubicación actual'))
        .addTo(currentMap);

      const bounds = new mapboxgl.LngLatBounds().extend(originCoords);

      // Marcador B (Destino) y Trazado de Ruta
      if (destCoords) {
        const destEl = document.createElement('div');
        destEl.className =
          'w-7 h-7 bg-amber-500 border-2 border-white rounded-full shadow-lg flex items-center justify-center text-white text-xs font-bold';
        destEl.innerText = 'B';

        new mapboxgl.Marker(destEl)
          .setLngLat(destCoords)
          .setPopup(new mapboxgl.Popup().setText(destLabel || 'Destino del trabajo'))
          .addTo(currentMap);

        bounds.extend(destCoords);

        try {
          const directionsRes = await fetch(
            `https://api.mapbox.com/directions/v5/mapbox/driving/${originCoords[0]},${originCoords[1]};${destCoords[0]},${destCoords[1]}?geometries=geojson&access_token=${mapboxgl.accessToken}`
          );
          const directionsData = await directionsRes.json();

          if (directionsData.routes && directionsData.routes.length > 0) {
            const routeGeometry = directionsData.routes[0].geometry;

            const addRoute = () => {
              if (!mounted || !currentMap.isStyleLoaded()) return;

              currentMap.addSource('route', {
                type: 'geojson',
                data: {
                  type: 'Feature',
                  properties: {},
                  geometry: routeGeometry,
                },
              });

              currentMap.addLayer({
                id: 'route',
                type: 'line',
                source: 'route',
                layout: {
                  'line-join': 'round',
                  'line-cap': 'round',
                },
                paint: {
                  'line-color': '#059669',
                  'line-width': 4,
                  'line-opacity': 0.8,
                },
              });
            };

            if (currentMap.isStyleLoaded()) addRoute();
            else currentMap.once('load', addRoute);
          }
        } catch {
          // Si falla la ruta, se mantienen los marcadores
        }
      }

      currentMap.fitBounds(bounds, { padding: 60, maxZoom: 14 });
    };

    setupMapData();

    return () => {
      mounted = false;
      currentMap.remove();
      map.current = null;
    };
  }, [originLng, originLat, originAddress, originLabel, destLng, destLat, destAddress, destLabel, hasDestination]);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-stone-200/80 shadow-xs">
      {mapUnavailable ? (
        <div className={`flex items-center justify-center bg-gray-50 text-sm text-gray-500 ${className}`}>
          El mapa no está disponible.
        </div>
      ) : (
        <div ref={mapContainer} className={className} />
      )}
    </div>
  );
}