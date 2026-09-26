export function AuthLoadingScreen() {
  return (
    <div
      aria-label="Cargando PaTodo"
      className="fixed inset-0 z-[9998] flex flex-col items-center justify-center overflow-hidden bg-[#f3faf7]"
    >
      <div className="relative flex flex-col items-center animate-splash-float">
        <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-white p-3 shadow-xl shadow-brand-900/10 ring-1 ring-brand-100/80 animate-page-in">
          <img
            src="/logos1.png"
            alt="PaTodo"
            className="h-full w-auto object-contain mix-blend-multiply"
          />
        </div>

        <p className="mt-5 text-xs font-bold uppercase tracking-[0.32em] text-brand-700">
          PaTodo
        </p>

        <div className="mt-5 h-1 w-32 overflow-hidden rounded-full bg-brand-100">
          <div className="h-full rounded-full bg-brand-500 animate-splash-bar" />
        </div>
      </div>
    </div>
  );
}