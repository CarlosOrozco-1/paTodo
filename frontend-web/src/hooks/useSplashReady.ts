import { useEffect, useState } from 'react';

const MIN_HOLD_MS = 550;

export function useSplashReady(isLoading: boolean): boolean {
  const [ready, setReady] = useState(() => !isLoading);

  useEffect(() => {
    if (!isLoading) {
      const timer = window.setTimeout(() => setReady(true), MIN_HOLD_MS);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [isLoading]);

  return ready;
}