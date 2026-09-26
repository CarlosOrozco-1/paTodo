import { apiClient } from '../axiosClient';

function normalizeValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(normalizeValue);
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (typeof obj._seconds === 'number' && typeof obj._nanoseconds === 'number') {
      return new Date(
        obj._seconds * 1000 + Math.round(obj._nanoseconds / 1000000),
      ).toISOString();
    }
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(obj)) {
      out[key] = normalizeValue(item);
    }
    return out;
  }
  return value;
}

export async function apiPost<T = unknown>(url: string, body?: unknown): Promise<T> {
  const { data } = await apiClient.post(url, body ?? {});
  return normalizeValue(data) as T;
}

export async function apiGet<T = unknown>(url: string): Promise<T> {
  const { data } = await apiClient.get(url);
  return normalizeValue(data) as T;
}