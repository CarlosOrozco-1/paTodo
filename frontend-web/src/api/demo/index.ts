import { isDemoMode } from '../mode';

export { isDemoMode };

const USER_KEY = 'paTodo_user';

export function currentUserId(): string | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return (JSON.parse(raw) as { id: string }).id;
  } catch {
    return null;
  }
}

export function sleep(ms = 200): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}