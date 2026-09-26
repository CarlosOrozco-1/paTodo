export function guessZone(address?: string): string {
  if (!address) return 'Guatemala';
  const clean = address.trim();
  const a = clean.toLowerCase();
  const zoneMatch = a.match(/zona\s*(\d+)/);
  if (zoneMatch) return `Zona ${zoneMatch[1]}, Guatemala`;
  if (a.includes('villa nueva')) return 'Villa Nueva, Guatemala';
  if (a.includes('mixco')) return 'Mixco, Guatemala';
  if (a.includes('ciudad de guatemala') || a.includes('guatemala'))
    return 'Ciudad de Guatemala';
  return clean.split(',')[0] || 'Guatemala';
}

export function isNewJob(createdAt: string, hours = 24): boolean {
  const diff = Date.now() - new Date(createdAt).getTime();
  return diff > 0 && diff < hours * 3600 * 1000;
}