import {
  Wrench,
  Droplets,
  Zap,
  Hammer,
  Paintbrush,
  Flower2,
  Sparkles,
  Scale,
  Car,
  Plug,
  Shovel,
  type LucideIcon,
} from 'lucide-react';
import type { Category } from '@/types/category.types';

const ICON_BY_KEY: Record<string, LucideIcon> = {
  wrench: Wrench,
  droplets: Droplets,
  droplet: Droplets,
  zap: Zap,
  hammer: Hammer,
  paintbrush: Paintbrush,
  flower: Flower2,
  sparkles: Sparkles,
  scale: Scale,
  car: Car,
  plug: Plug,
  shovel: Shovel,
};

export function getCategoryIcon(category?: Category | null): LucideIcon {
  if (!category) return Wrench;
  const key = (category.icon || category.slug || '').toLowerCase();
  return ICON_BY_KEY[key] || ICON_BY_KEY[category.name.toLowerCase()] || Wrench;
}

export function renderCategoryIcon(
  category: Category | null | undefined,
  className?: string,
) {
  const Icon = getCategoryIcon(category);
  return <Icon className={className} />;
}