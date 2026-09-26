export type ApiMode = 'demo' | 'real' | 'auto';

const FALLBACK_KEY = 'paTodo_backend_down';

function readRemoteMode(): ApiMode {
  const raw = import.meta.env.VITE_API_MODE as string | undefined;
  if (raw === 'real' || raw === 'auto') return raw;
  if (raw === 'demo') return 'demo';
  // Por defecto: demo (comportamiento previo) salvo que se configure algo más.
  return 'demo';
}

let cachedBackendAvailable: boolean | null = localStorage.getItem(FALLBACK_KEY)
  ? localStorage.getItem(FALLBACK_KEY) === 'true'
  : null;

export function getApiMode(): ApiMode {
  return readRemoteMode();
}

export function isDemoMode(): boolean {
  const mode = readRemoteMode();
  if (mode === 'demo') return true;
  if (mode === 'real') return false;
  return !isBackendAvailable();
}

export function isRealMode(): boolean {
  const mode = readRemoteMode();
  if (mode === 'real') return true;
  if (mode === 'demo') return false;
  return isBackendAvailable();
}

export function isBackendAvailable(): boolean {
  return cachedBackendAvailable === true;
}

export function setBackendAvailable(value: boolean): void {
  cachedBackendAvailable = value;
  if (value) {
    localStorage.removeItem(FALLBACK_KEY);
  } else {
    localStorage.setItem(FALLBACK_KEY, 'true');
  }
}

/**
 * Sondeo único al arrancar (solo modo auto). Usa el health check de la API
 * REST (Firebase) para decidir si la app opera en modo real o cae a demo.
 */
export async function probeBackend(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(
      `${import.meta.env.VITE_API_URL || 'https://patodo.onrender.com'}/`,
      { signal: controller.signal },
    );
    clearTimeout(timer);
    const available = response.ok;
    setBackendAvailable(available);
    return available;
  } catch {
    setBackendAvailable(false);
    return false;
  }
}