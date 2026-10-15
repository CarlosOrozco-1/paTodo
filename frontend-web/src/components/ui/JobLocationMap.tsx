import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import { Plus, Minus } from 'lucide-react';

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
  interactive?: boolean;
  onLocationSelect?: (location: { lat: number; lng: number; addressText: string }) => void;
}

export function JobLocationMap({
  origin,
  destination,
  className = 'h-64 w-full',
  interactive = false,
  onLocationSelect,
}: JobLocationMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const isUserInteracting = useRef(false);

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

  // Traduce coordenadas a dirección en texto (Reverse Geocoding)
  const fetchAddress = async (lng: number, lat: number): Promise<string> => {
    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${mapboxgl.accessToken}&country=gt&limit=1`
      );
      const data = await res.json();
      if (data.features && data.features.length > 0) {
        return data.features[0].place_name;
      }
    } catch {
      // Fallback si falla la red
    }
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  };

  const handleZoomIn = () => {
    if (map.current) map.current.zoomIn();
  };

  const handleZoomOut = () => {
    if (map.current) map.current.zoomOut();
  };

  // Resuelve coordenadas priorizando texto o números
  const resolveCoords = async (loc: JobMapLocation): Promise<[number, number] | null> => {
    if (loc.lng !== undefined && loc.lat !== undefined && loc.lng !== 0 && loc.lat !== 0) {
      return [loc.lng, loc.lat];
    }

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
        // Fallo de red
      }
    }

    return null;
  };

  useEffect(() => {
    if (!mapContainer.current || !mapboxgl.accessToken) return;

    let mounted = true;

    const setupMap = async () => {
      const originCoords = await resolveCoords({
        lng: originLng,
        lat: originLat,
        addressText: originAddress,
        label: originLabel,
      });

      const initialLng = originCoords ? originCoords[0] : -90.5069;
      const initialLat = originCoords ? originCoords[1] : 14.6349;

      const currentMap = new mapboxgl.Map({
        container: mapContainer.current!,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [initialLng, initialLat],
        zoom: 13,
      });
      map.current = currentMap;

      const bounds = new mapboxgl.LngLatBounds();

      // MODO INTERACTIVO (Creación o selección de ubicación)
      if (interactive) {
        const originEl = document.createElement('div');
        originEl.className =
          'w-8 h-8 bg-emerald-600 border-2 border-white rounded-full shadow-xl flex items-center justify-center text-white text-xs font-bold cursor-pointer';
        originEl.innerText = '📍';

        const popup = new mapboxgl.Popup({ offset: 25, closeButton: true }).setText(
          originLabel || originAddress || 'Ubicación seleccionada'
        );
        popupRef.current = popup;

        const marker = new mapboxgl.Marker({
          element: originEl,
          draggable: true,
        })
          .setLngLat([initialLng, initialLat])
          .setPopup(popup)
          .addTo(currentMap);

        markerRef.current = marker;

        if (onLocationSelect) {
          const handleSelection = async (lng: number, lat: number) => {
            isUserInteracting.current = true; // Bloquea efectos externos momentáneamente

            if (markerRef.current) {
              markerRef.current.setLngLat([lng, lat]);
            }

            if (map.current) {
              map.current.easeTo({ center: [lng, lat], duration: 300 });
            }

            const addressText = await fetchAddress(lng, lat);

            if (mounted) {
              if (popupRef.current) {
                popupRef.current.setText(addressText);
                if (!popupRef.current.isOpen() && markerRef.current) {
                  markerRef.current.togglePopup();
                }
              }
              onLocationSelect({ lng, lat, addressText });
            }

            // Mantiene el bloqueo unos segundos para evitar el rebote de coordenadas
            setTimeout(() => {
              isUserInteracting.current = false;
            }, 1200);
          };

          marker.on('dragend', async () => {
            const lngLat = marker.getLngLat();
            await handleSelection(lngLat.lng, lngLat.lat);
          });

          currentMap.on('click', async (e) => {
            const { lng, lat } = e.lngLat;
            await handleSelection(lng, lat);
          });
        }
      } else {
        // MODO VISUALIZACIÓN / RUTA (Trabajos Activos)
        if (originCoords) {
          const originEl = document.createElement('div');
          originEl.className =
            'w-7 h-7 bg-emerald-600 border-2 border-white rounded-full shadow-lg flex items-center justify-center text-white text-xs font-bold';
          originEl.innerText = 'A';

          new mapboxgl.Marker(originEl)
            .setLngLat(originCoords)
            .setPopup(new mapboxgl.Popup().setText(originLabel || 'Ubicación actual'))
            .addTo(currentMap);

          bounds.extend(originCoords);
        }

        if (hasDestination) {
          const destCoords = await resolveCoords({
            lng: destLng,
            lat: destLat,
            addressText: destAddress,
            label: destLabel,
          });

          if (destCoords && originCoords) {
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
              // Fallo silencioso
            }
          }
        }

        if (!bounds.isEmpty()) {
          currentMap.fitBounds(bounds, { padding: 60, maxZoom: 14 });
        }
      }
    };

    setupMap();

    return () => {
      mounted = false;
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
      markerRef.current = null;
      popupRef.current = null;
    };
  }, [interactive]);

  // Sincronización controlada para modo interactivo (evita saltos si el usuario hizo clic)
  useEffect(() => {
    if (!map.current || !markerRef.current || isUserInteracting.current || !interactive) return;
    if (originLng === undefined || originLat === undefined) return;

    const currentMarkerPos = markerRef.current.getLngLat();
    const deltaLng = Math.abs(currentMarkerPos.lng - originLng);
    const deltaLat = Math.abs(currentMarkerPos.lat - originLat);

    if (deltaLng < 0.0002 && deltaLat < 0.0002) return;

    markerRef.current.setLngLat([originLng, originLat]);
    map.current.easeTo({ center: [originLng, originLat], duration: 300 });
  }, [originLng, originLat, interactive]);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-stone-200/80 shadow-xs">
      <style>{`
        .mapboxgl-popup-content {
          border-radius: 12px !important;
          padding: 12px 30px 12px 14px !important;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12) !important;
          font-family: inherit !important;
          font-size: 12px !important;
          line-height: 1.4 !important;
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
          outline: none !important;
          font-size: 14px !important;
          line-height: 1 !important;
          cursor: pointer !important;
          transition: background-color 0.15s ease, color 0.15s ease !important;
        }
        .mapboxgl-popup-close-button:hover {
          background-color: #f3f4f6 !important;
          color: #111827 !important;
        }
      `}</style>

      {mapUnavailable ? (
        <div className={`flex items-center justify-center bg-gray-50 text-sm text-gray-500 ${className}`}>
          El mapa no está disponible.
        </div>
      ) : (
        <>
          <div ref={mapContainer} className={className} />

          {/* BOTONES DE ZOOM */}
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
        </>
      )}
    </div>
  );
}