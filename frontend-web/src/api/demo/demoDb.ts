import type { DemoDb } from './mockData';
import { seedData } from './mockData';

const DB_KEY = 'paTodo_demo_db_v1';

let cache: DemoDb | null = null;

export function loadDb(): DemoDb {
  if (cache) return cache;
  const raw = localStorage.getItem(DB_KEY);
  if (raw) {
    try {
      cache = JSON.parse(raw) as DemoDb;
      return cache;
    } catch {
      // datos corruptos, recrear desde el seed
    }
  }
  cache = structuredClone(seedData);
  saveDb(cache);
  return cache;
}

export function saveDb(db: DemoDb): void {
  cache = db;
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

export function resetDemoDb(): void {
  localStorage.removeItem(DB_KEY);
  cache = null;
  loadDb();
}

export function db(): DemoDb {
  return loadDb();
}

export function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function daysAgo(days: number, hour = 10): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}