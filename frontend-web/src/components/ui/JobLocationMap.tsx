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

  useEffect(() => {
    if (!mapContainer.current || !mapboxgl.accessToken) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [-90.5069, 14.6349],
      zoom: 11,
    });

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
          // Si falla la búsqueda, pasa a las coordenadas por defecto
        }
      }

      if (loc.lng !== undefined && loc.lat !== undefined) {
        return [loc.lng, loc.lat];
      }

      return [-90.5069, 14.6349];
    };

    const setupMapData = async () => {
      const originCoords = (await resolveCoords(origin)) || [-90.5069, 14.6349];
      const destCoords = destination ? await resolveCoords(destination) : null;

      if (!map.current) return;

      // Marcador A (Origen)
      const originEl = document.createElement('div');
      originEl.className =
        'w-7 h-7 bg-emerald-600 border-2 border-white rounded-full shadow-lg flex items-center justify-center text-white text-xs font-bold';
      originEl.innerText = 'A';

      new mapboxgl.Marker(originEl)
        .setLngLat(originCoords)
        .setPopup(new mapboxgl.Popup().setHTML(`<b>${origin.label || 'Ubicación'}</b>`))
        .addTo(map.current);

      const bounds = new mapboxgl.LngLatBounds().extend(originCoords);

      // Marcador B (Destino) y Trazado de Ruta
      if (destCoords) {
        const destEl = document.createElement('div');
        destEl.className =
          'w-7 h-7 bg-amber-500 border-2 border-white rounded-full shadow-lg flex items-center justify-center text-white text-xs font-bold';
        destEl.innerText = 'B';

        new mapboxgl.Marker(destEl)
          .setLngLat(destCoords)
          .setPopup(new mapboxgl.Popup().setHTML(`<b>${destination?.label || 'Destino'}</b>`))
          .addTo(map.current);

        bounds.extend(destCoords);

        try {
          const directionsRes = await fetch(
            `https://api.mapbox.com/directions/v5/mapbox/driving/${originCoords[0]},${originCoords[1]};${destCoords[0]},${destCoords[1]}?geometries=geojson&access_token=${mapboxgl.accessToken}`
          );
          const directionsData = await directionsRes.json();

          if (directionsData.routes && directionsData.routes.length > 0) {
            const routeGeometry = directionsData.routes[0].geometry;

            map.current.on('load', () => {
              if (!map.current) return;

              map.current.addSource('route', {
                type: 'geojson',
                data: {
                  type: 'Feature',
                  properties: {},
                  geometry: routeGeometry,
                },
              });

              map.current.addLayer({
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
            });
          }
        } catch {
          // Si falla el trazado de la ruta, conserva los marcadores A y B
        }
      }

      map.current.fitBounds(bounds, { padding: 60, maxZoom: 14 });
    };

    setupMapData();

    return () => {
      map.current?.remove();
    };
  }, [origin.addressText, origin.lat, origin.lng, destination?.addressText, destination?.lat, destination?.lng]);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-stone-200/80 shadow-xs">
      <div ref={mapContainer} className={className} />
    </div>
  );
}