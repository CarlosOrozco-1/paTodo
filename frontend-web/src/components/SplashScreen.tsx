import { useEffect, useState } from 'react';
import { cn } from '@/utils/cn';

const HOLD_MS = 2100;
const FADE_MS = 650;

interface SplashScreenProps {
  onFinished: () => void;
}

export function SplashScreen({ onFinished }: SplashScreenProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const hold = window.setTimeout(() => setVisible(false), HOLD_MS);
    const finish = window.setTimeout(onFinished, HOLD_MS + FADE_MS + 60);
    return () => {
      window.clearTimeout(hold);
      window.clearTimeout(finish);
    };
  }, [onFinished]);

  return (
    <div
      aria-hidden="true"
      className={cn(
        'fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden px-6 transition-opacity duration-700 ease-in-out',
        visible ? 'opacity-100' : 'pointer-events-none opacity-0',
      )}
      style={{
        background:
          'linear-gradient(135deg, #064e3b 0%, #047857 45%, #059669 100%)',
      }}
    >
      {/* Destellos decorativos */}
      <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-brand-400/20 blur-3xl animate-blob" />
      <div className="pointer-events-none absolute -bottom-32 -right-20 h-96 w-96 rounded-full bg-emerald-300/20 blur-3xl animate-blob" style={{ animationDelay: '-3.5s' }} />
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-56 w-56 -translate-x-1/2 rounded-full bg-white/5 blur-2xl" />

      {/* Marca */}
      <div className="relative flex flex-col items-center animate-splash-float">
        <div className="flex h-28 w-28 items-center justify-center rounded-3xl bg-white p-3 shadow-2xl shadow-brand-950/40 ring-4 ring-white/20">
          <img
            src="/logos1.png"
            alt="PaTodo"
            className="h-full w-auto object-contain mix-blend-multiply"
          />
        </div>

        <h1 className="mt-6 text-3xl font-black tracking-tight text-white">
          PaTodo
        </h1>
        <p className="mt-1 text-xs font-semibold uppercase tracking-[0.3em] text-brand-100">
          Para todo lo que necesitas
        </p>

        {/* Barra de progreso */}
        <div className="mt-9 h-1 w-44 overflow-hidden rounded-full bg-white/20">
          <div className="h-full rounded-full bg-white animate-splash-bar" />
        </div>
      </div>

      <p className="absolute bottom-8 text-[10px] font-medium tracking-wider text-brand-200/80">
        Cargando experiencia PaTodo…
      </p>
    </div>
  );
}