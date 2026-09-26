import { SlidersHorizontal, RotateCcw, MapPin, CalendarRange } from 'lucide-react';
import type { Category } from '@/types/category.types';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';

export interface JobFiltersState {
  search: string;
  categoryId: string;
  minPrice: string;
  maxPrice: string;
  zone: string;
  maxDistance: string;
  publishedFrom: string;
  sortBy: 'recent' | 'price_asc' | 'price_desc';
}

interface JobFiltersProps {
  categories: Category[];
  filters: JobFiltersState;
  onChange: (filters: JobFiltersState) => void;
}

const ZONE_OPTIONS = [
  { value: '', label: 'Todas las zonas' },
  { value: 'capital', label: 'Ciudad de Guatemala' },
  { value: 'zona10', label: 'Zona 10' },
  { value: 'zona14', label: 'Zona 14' },
  { value: 'mixco', label: 'Mixco' },
  { value: 'villa_nueva', label: 'Villa Nueva' },
];

const EMPTY_FILTERS: JobFiltersState = {
  search: '',
  categoryId: '',
  minPrice: '',
  maxPrice: '',
  zone: '',
  maxDistance: '',
  publishedFrom: '',
  sortBy: 'recent',
};

export function JobFilters({ categories, filters, onChange }: JobFiltersProps) {
  const set = (patch: Partial<JobFiltersState>) => onChange({ ...filters, ...patch });

  const hasActiveFilters = Boolean(
    filters.search ||
      filters.categoryId ||
      filters.minPrice ||
      filters.maxPrice ||
      filters.zone ||
      filters.maxDistance ||
      filters.publishedFrom ||
      filters.sortBy !== 'recent',
  );

  const handleReset = () => onChange(EMPTY_FILTERS);

  const inputClass =
    'text-xs rounded-2xl border-brand-100/80 bg-gray-50/60 focus:bg-white focus:border-brand-300';

  return (
    <div className="rounded-3xl border border-brand-100/70 bg-white p-5 shadow-sm shadow-brand-900/5 sticky top-4">
      {/* Cabecera */}
      <div className="mb-4 flex items-center justify-between border-b border-brand-100/70 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
            <SlidersHorizontal className="h-4 w-4" />
          </div>
          <h3 className="text-sm font-bold text-gray-900">Filtrar trabajos</h3>
        </div>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1 text-[11px] font-semibold text-brand-600 hover:text-brand-700 transition-colors cursor-pointer"
          >
            <RotateCcw className="h-3 w-3" />
            Limpiar
          </button>
        )}
      </div>

      <div className="space-y-4">
        {/* Búsqueda por título o descripción */}
        <Input
          placeholder="Buscar por título o descripción..."
          value={filters.search}
          onChange={(e) => set({ search: e.target.value })}
          className={inputClass}
        />

        {/* Categoría */}
        <div>
          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-gray-400">
            Categoría
          </label>
          <Select
            placeholder="Todas las categorías"
            options={categories
              .filter((c) => c.isActive)
              .map((c) => ({ value: c.id, label: c.name }))}
            value={filters.categoryId}
            onChange={(e) => set({ categoryId: e.target.value })}
            className={inputClass}
          />
        </div>

        {/* Zona local */}
        <div>
          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1">
            <MapPin className="h-3 w-3 text-brand-500" />
            Zona local
          </label>
          <Select
            options={ZONE_OPTIONS}
            value={filters.zone}
            onChange={(e) => set({ zone: e.target.value })}
            className={inputClass}
          />
        </div>

        {/* Distancia máxima */}
        <div>
          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-gray-400">
            Distancia máxima (km)
          </label>
          <Input
            type="number"
            min="0"
            step="0.5"
            placeholder="Ej. 10"
            value={filters.maxDistance}
            onChange={(e) => set({ maxDistance: e.target.value })}
            className={inputClass}
          />
        </div>

        {/* Rango de precios */}
        <div>
          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-gray-400">
            Rango de precio (Q)
          </label>
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="number"
              min="0"
              placeholder="Mín"
              value={filters.minPrice}
              onChange={(e) => set({ minPrice: e.target.value })}
              className={inputClass}
            />
            <Input
              type="number"
              min="0"
              placeholder="Máx"
              value={filters.maxPrice}
              onChange={(e) => set({ maxPrice: e.target.value })}
              className={inputClass}
            />
          </div>
        </div>

        {/* Fecha de publicación */}
        <div>
          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1">
            <CalendarRange className="h-3 w-3 text-brand-500" />
            Publicado después de
          </label>
          <Input
            type="date"
            value={filters.publishedFrom}
            onChange={(e) => set({ publishedFrom: e.target.value })}
            className={inputClass}
          />
        </div>

        {/* Ordenamiento */}
        <div>
          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-gray-400">
            Ordenar resultados
          </label>
          <Select
            options={[
              { value: 'recent', label: 'Más recientes' },
              { value: 'price_asc', label: 'Menor precio' },
              { value: 'price_desc', label: 'Mayor precio' },
            ]}
            value={filters.sortBy}
            onChange={(e) => set({ sortBy: e.target.value as JobFiltersState['sortBy'] })}
            className={inputClass}
          />
        </div>

        {hasActiveFilters && (
          <div className="space-y-2 pt-2">
            <Button
              size="sm"
              fullWidth
              onClick={() => onChange({ ...filters })}
              className="rounded-xl bg-brand-600 text-white shadow-md shadow-brand-600/25 hover:bg-brand-700"
            >
              Aplicar filtros
            </Button>
            <Button
              variant="outline"
              size="sm"
              fullWidth
              onClick={handleReset}
              className="rounded-xl border-brand-200 text-xs font-semibold text-brand-700 hover:bg-brand-50 hover:text-brand-800"
            >
              Limpiar filtros
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}