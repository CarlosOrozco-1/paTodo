import { useState } from 'react';
import { FlaskConical, PlugZap, RotateCcw, X } from 'lucide-react';
import { isDemoMode, sleep } from '@/api/demo';
import { getApiMode } from '@/api/mode';
import { resetDemoDb } from '@/api/demo/demoDb';
import { toast } from '@/stores/uiStore';

function DemoBadge({ onHide }: { onHide: () => void }) {
  const [resetting, setResetting] = useState(false);
  const isAutoFallback = getApiMode() === 'auto';

  const handleReset = async () => {
    setResetting(true);
    await sleep(300);
    resetDemoDb();
    setResetting(false);
    toast('info', 'Datos de demostración restablecidos');
    window.location.reload();
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 shadow-lg">
      <FlaskConical className="h-4 w-4 text-amber-600" />
      <span className="text-xs font-semibold text-amber-800">Demo</span>
      <span className="hidden text-xs text-amber-600 sm:inline">
        {isAutoFallback
          ? 'El servidor no está disponible, los datos se guardan en tu navegador'
          : 'Los datos se guardan en tu navegador'}
      </span>
      <button
        onClick={handleReset}
        disabled={resetting}
        title="Restablecer datos de demostración"
        className="rounded-md p-1 text-amber-600 transition-colors hover:bg-amber-100 disabled:opacity-50"
      >
        <RotateCcw className={`h-4 w-4 ${resetting ? 'animate-spin' : ''}`} />
      </button>
      <button
        onClick={onHide}
        title="Ocultar"
        className="rounded-md p-1 text-amber-600 transition-colors hover:bg-amber-100"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function RealBadge({ onHide }: { onHide: () => void }) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 shadow-lg">
      <PlugZap className="h-4 w-4 text-emerald-600" />
      <span className="text-xs font-semibold text-emerald-800">Conectado</span>
      <button
        onClick={onHide}
        title="Ocultar"
        className="rounded-md p-1 text-emerald-600 transition-colors hover:bg-emerald-100"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function DemoBanner() {
  const [hidden, setHidden] = useState(false);

  if (hidden) return null;

  if (isDemoMode()) {
    return <DemoBadge onHide={() => setHidden(true)} />;
  }
  return <RealBadge onHide={() => setHidden(true)} />;
}