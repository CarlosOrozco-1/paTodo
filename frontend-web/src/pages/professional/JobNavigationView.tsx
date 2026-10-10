import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
import { RotateCcw, ArrowLeft, ArrowUpRight, Gauge, Clock, Navigation, Plus, Minus, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { InternalNavigator, type NavigatorDestination } from '@/components/ui/InternalNavigator';
import { jobsService } from '@/api/jobs.service';
import type { Job } from '@/types/job.types';
import { toast } from '@/stores/uiStore';
import { 
  publishJobTrackingPosition, 
  type JobTrackingPosition 
} from '@/api/firebase/jobTracking';

interface PublishedPosition {
  latitude: number;
  longitude: number;
  publishedAt: number;
}

function distanceMeters(first: PublishedPosition, next: JobTrackingPosition): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const deltaLatitude = radians(next.latitude - first.latitude);
  const deltaLongitude = radians(next.longitude - first.longitude);
  const latitude1 = radians(first.latitude);
  const latitude2 = radians(next.latitude);
  const haversine =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(latitude1) * Math.cos(latitude2) * Math.sin(deltaLongitude / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export function JobNavigationView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [customDestination, setCustomDestination] = useState<NavigatorDestination | null>(null);
  const [destinationInput, setDestinationInput] = useState('');
  const [speed, setSpeed] = useState<number>(0);
  const [eta, setEta] = useState<string>('Calculando...');
  const [distance, setDistance] = useState<string>('--');

  const [currentInstruction, setCurrentInstruction] = useState('Calculando ruta GPS...');
  const [voiceEnabled, setVoiceEnabled] = useState(true);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const lastPublishedPositions = useRef(new Map<string, PublishedPosition>());

  // WAKE LOCK: Mantiene la pantalla encendida
  useEffect(() => {
    let wakeLock: any = null;
    const requestWakeLock = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await (navigator as any).wakeLock.request('screen');
        }
      } catch (err) {
        // Fallo silencioso si la batería baja lo impide
      }
    };
    
    requestWakeLock();
    document.addEventListener('visibilitychange', requestWakeLock);
    
    return () => {
      document.removeEventListener('visibilitychange', requestWakeLock);
      if (wakeLock) wakeLock.release().catch(() => {});
    };
  }, []);

  const handlePositionUpdate = useCallback(async (jobId: string, position: JobTrackingPosition) => {
    if (!jobId) return;
    const now = Date.now();
    const previous = lastPublishedPositions.current.get(jobId);
    if (previous && now - previous.publishedAt < 10000 && distanceMeters(previous, position) < 20) {
      return;
    }

    lastPublishedPositions.current.set(jobId, {
      latitude: position.latitude,
      longitude: position.longitude,
      publishedAt: now,
    });
    try {
      await publishJobTrackingPosition(jobId, position);
    } catch (error) {
      console.warn('Rastreo en la nube no disponible:', error);
    }
  }, []);

  // Cargar datos y resetear estados 
  useEffect(() => {
    setEta('Calculando...');
    setDistance('--');
    setCurrentInstruction('Calculando ruta GPS...');
    setCustomDestination(null);
    setDestinationInput('');
    setSpeed(0);
    setLoading(true);

    const loadJob = async () => {
      if (!id) return;
      try {
        const data = await jobsService.getById(id);
        setJob(data);
      } catch {
        toast('error', 'No se pudo cargar la información de la ruta');
        navigate(-1);
      } finally {
        setLoading(false);
      }
    };
    loadJob();
  }, [id, navigate]);

  // Lectura de velocidad real por GPS
  useEffect(() => {
    const watchId = navigator.geolocation?.watchPosition(
      (position) => {
        if (position.coords.speed !== null && position.coords.speed >= 0) {
          setSpeed(Math.round(position.coords.speed * 3.6));
        }
      },
      () => {},
      { enableHighAccuracy: true }
    );
    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  // NUEVO: Recibimos los datos exactos que calculó el mapa para la ruta verde
  const handleRouteCalculated = useCallback((distMeters: number, durationSecs: number) => {
    const distKm = distMeters / 1000;
    setDistance(distKm < 1 ? `${Math.round(distMeters)} m` : `${distKm.toFixed(1)} km`);

    const timeMinutes = Math.max(1, Math.round(durationSecs / 60));
    if (timeMinutes > 59) {
      const hours = Math.floor(timeMinutes / 60);
      const mins = timeMinutes % 60;
      setEta(`${hours} h ${mins} min`);
    } else {
      setEta(`${timeMinutes} min`);
    }
  }, []);

  if (loading || !job) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-950 text-white">
        <p className="text-sm font-medium animate-pulse">Cargando sistema de navegación GPS...</p>
      </div>
    );
  }

  const originalDestination: NavigatorDestination = {
    longitude: job.location.coordinates?.[0],
    latitude: job.location.coordinates?.[1],
    addressText: job.location.address,
    label: job.location.address || 'Destino del trabajo',
  };

  const activeDestination = customDestination || originalDestination;
  const hasCustomDest = Boolean(customDestination);

  const handleSearchCustomDest = async () => {
    if (!destinationInput.trim()) return;
    try {
      setEta('Calculando...');
      const query = encodeURIComponent(`${destinationInput}, Guatemala`);
      const token = import.meta.env.VITE_MAPBOX_TOKEN || '';
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?access_token=${token}&country=gt&limit=1`
      );
      const data = await res.json();
      
      if (data.features && data.features.length > 0) {
        const coords = data.features[0].center;
        setCustomDestination({
          addressText: destinationInput,
          label: destinationInput,
          longitude: coords[0],
          latitude: coords[1]
        });
        toast('success', 'Ruta recalculada al nuevo destino temporal');
      } else {
        toast('error', 'No se encontró la dirección exacta');
      }
    } catch (err) {
      setCustomDestination({
        addressText: destinationInput,
        label: destinationInput,
      });
    }
  };

  const handleRestoreOriginal = () => {
    setCustomDestination(null);
    setDestinationInput('');
    setEta('Calculando...');
    setDistance('--');
    toast('success', 'Ruta restaurada al domicilio del cliente');
  };

  const handleZoomIn = () => {
    const canvas = document.querySelector('.mapboxgl-canvas') as HTMLCanvasElement;
    if (canvas) {
      canvas.focus();
      canvas.dispatchEvent(new KeyboardEvent('keydown', { key: '+', code: 'Equal', keyCode: 187, bubbles: true }));
    }
  };

  const handleZoomOut = () => {
    const canvas = document.querySelector('.mapboxgl-canvas') as HTMLCanvasElement;
    if (canvas) {
      canvas.focus();
      canvas.dispatchEvent(new KeyboardEvent('keydown', { key: '-', code: 'Minus', keyCode: 189, bubbles: true }));
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] h-screen w-screen flex flex-col bg-gray-950 overflow-hidden">
      
      {/* BARRA SUPERIOR (Buscador y Volver) */}
      <div className="absolute top-4 left-4 right-4 z-50 flex flex-col md:flex-row items-center justify-between gap-3 bg-gray-900/95 backdrop-blur-md p-3.5 rounded-2xl shadow-2xl border border-white/10 text-white pointer-events-auto">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate(-1)}
            className="bg-white/10 border-white/20 text-white hover:bg-white/20 shrink-0 cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Volver
          </Button>

          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-md">
              <ArrowUpRight className="h-6 w-6 animate-pulse" />
            </div>
            <div className="min-w-0 flex flex-col">
              <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">En ruta hacia el cliente</p>
              <p className="text-xs font-bold truncate max-w-xs sm:max-w-md">
                {job.details.title}
              </p>
              <p className="text-[10px] text-gray-300 truncate max-w-xs sm:max-w-md" title={activeDestination?.label || activeDestination?.addressText}>
                {activeDestination?.label || activeDestination?.addressText || 'Ubicación'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <input
            type="text"
            placeholder="Buscar parada (ej. Ferretería)..."
            value={destinationInput}
            onChange={(e) => setDestinationInput(e.target.value)}
            className="flex-1 md:w-56 text-xs px-3 py-2 rounded-xl bg-gray-800 border border-gray-700 text-white placeholder:text-gray-400 focus:outline-none focus:border-brand-500"
          />
          <Button
            size="sm"
            className="bg-brand-600 hover:bg-brand-700 text-white shrink-0 text-xs cursor-pointer"
            onClick={handleSearchCustomDest}
          >
            Ir
          </Button>

          {hasCustomDest && (
            <Button
              size="sm"
              variant="outline"
              className="text-emerald-400 border-emerald-500/40 bg-emerald-950/40 hover:bg-emerald-900/50 shrink-0 text-xs cursor-pointer"
              onClick={handleRestoreOriginal}
              title="Restaurar destino original"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* PANEL DE INSTRUCCIONES TIPO WAZE */}
      <div className="absolute top-24 left-4 right-4 sm:left-1/2 sm:-translate-x-1/2 sm:w-[450px] z-40 flex items-center justify-between gap-4 bg-emerald-600/95 backdrop-blur-md px-5 py-4 rounded-2xl shadow-2xl border border-emerald-400/30 text-white transition-all pointer-events-auto">
        <div className="flex items-center gap-4 min-w-0">
          <div className="bg-white/20 p-2 rounded-xl shrink-0">
             <Navigation className="h-6 w-6 text-white shrink-0 animate-pulse" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-emerald-100 uppercase tracking-wider">Siguiente paso</p>
            <p className="text-sm font-bold truncate text-white">{currentInstruction}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setVoiceEnabled(!voiceEnabled)}
          className="shrink-0 rounded-xl bg-black/10 p-2.5 hover:bg-black/20 transition-colors cursor-pointer"
          title={voiceEnabled ? 'Desactivar voz' : 'Activar voz'}
        >
          {voiceEnabled ? <Volume2 className="h-5 w-5 text-white" /> : <VolumeX className="h-5 w-5 text-emerald-200" />}
        </button>
      </div>

      {/* TARJETAS FLOTANTES (Velocidad y ETA Real) */}
      <div className="absolute bottom-6 left-4 right-4 sm:left-6 z-50 flex flex-wrap items-center gap-3 pointer-events-none">
        <div className="bg-gray-900/95 backdrop-blur-md px-4 py-3 rounded-2xl shadow-2xl border border-white/10 text-white flex items-center gap-4 pointer-events-auto">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-lg">
            <Clock className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-emerald-400 font-bold">Tiempo estimado</p>
            <p className="text-lg font-black text-white">{eta} <span className="text-xs font-medium text-gray-400">({distance})</span></p>
          </div>
        </div>

        <div className="bg-gray-900/95 backdrop-blur-md px-4 py-3 rounded-2xl shadow-2xl border border-white/10 text-white flex items-center gap-4 pointer-events-auto">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-white shadow-lg">
            <Gauge className="h-5 w-5 text-brand-200" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Velocidad actual</p>
            <p className="text-lg font-black text-white">{speed} <span className="text-xs font-normal text-gray-300">km/h</span></p>
          </div>
        </div>

        <div className="hidden lg:flex items-center gap-2 bg-gray-900/95 backdrop-blur-md px-4 py-3 rounded-2xl shadow-2xl border border-white/10 text-brand-300 text-xs font-semibold pointer-events-auto">
          <Navigation className="h-4 w-4 animate-spin text-brand-400" />
          <span>GPS activo</span>
        </div>
      </div>

      {/* BOTONES DE ZOOM */}
      <div className="absolute right-6 bottom-28 z-50 flex flex-col gap-2">
        <button
          onClick={handleZoomIn}
          title="Acercar mapa"
          className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-900/95 backdrop-blur-md border border-white/10 text-white shadow-2xl transition-transform hover:scale-105 active:scale-95 cursor-pointer pointer-events-auto"
        >
          <Plus className="h-6 w-6" />
        </button>
        <button
          onClick={handleZoomOut}
          title="Alejar mapa"
          className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-900/95 backdrop-blur-md border border-white/10 text-white shadow-2xl transition-transform hover:scale-105 active:scale-95 cursor-pointer pointer-events-auto"
        >
          <Minus className="h-6 w-6" />
        </button>
      </div>

      {/* MAPA */}
      <div ref={mapContainerRef} className="relative w-full h-full flex-1 overflow-hidden">
        <InternalNavigator
          destination={activeDestination}
          onPositionUpdate={(position) => {
            void handlePositionUpdate(job.id, position);
          }}
          onInstructionChange={setCurrentInstruction}
          // AQUÍ CONECTAMOS LA DISTANCIA DEL MAPA A LA TARJETA
          onRouteCalculated={handleRouteCalculated}
          voiceEnabled={voiceEnabled}
          className="h-full w-full absolute inset-0"
        />
      </div>

    </div>
  );
}