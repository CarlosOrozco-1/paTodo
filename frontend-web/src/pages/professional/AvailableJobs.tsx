import { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { jobsService } from '@/api/jobs.service';
import { categoriesService } from '@/api/categories.service';
import { useAuthStore } from '@/stores/authStore';
import type { Category } from '@/types/category.types';
import type { Job } from '@/types/job.types';
import {
  JobFilters,
  type JobFiltersState,
} from '@/components/jobs/JobFilters';
import { JobCard } from '@/components/jobs/JobCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { WorkflowEmptyState } from '@/components/ui/WorkflowEmptyState';

const initialFilters: JobFiltersState = {
  search: '',
  categoryId: '',
  minPrice: '',
  maxPrice: '',
  zone: '',
  maxDistance: '',
  publishedFrom: '',
  sortBy: 'recent',
};

const ZONE_KEYWORDS: Record<string, string> = {
  capital: 'guatemala',
  zona10: 'zona 10',
  zona14: 'zona 14',
  mixco: 'mixco',
  villa_nueva: 'villa nueva',
};

function haversineKm(a: [number, number], b: [number, number]): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function AvailableJobs() {
  const { user } = useAuthStore();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<JobFiltersState>(initialFilters);

  useEffect(() => {
    const load = async () => {
      try {
        const [jobsRes, cats] = await Promise.all([
          jobsService.getAvailable({ limit: 100 }),
          categoriesService.getAll(),
        ]);
        setJobs(jobsRes.items);
        setCategories(cats);
      } catch {
        setJobs([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );

  const workerCoords = user?.availability?.serviceArea?.center?.coordinates;

  const distanceTo = useCallback(
    (job: Job): number | undefined => {
      if (!workerCoords || !job.location?.coordinates) return undefined;
      return haversineKm(workerCoords, job.location.coordinates);
    },
    [workerCoords],
  );

  const filtered = useMemo(() => {
    const zoneKeyword = ZONE_KEYWORDS[filters.zone];

    let result = jobs.filter((job) => {
      if (job.clientId === user?.id) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const matches =
          job.details.title.toLowerCase().includes(q) ||
          job.details.description.toLowerCase().includes(q) ||
          job.location.address.toLowerCase().includes(q);
        if (!matches) return false;
      }
      if (filters.categoryId && job.details.categoryId !== filters.categoryId)
        return false;
      if (filters.minPrice && job.pricing.proposedPrice < Number(filters.minPrice))
        return false;
      if (filters.maxPrice && job.pricing.proposedPrice > Number(filters.maxPrice))
        return false;
      if (
        zoneKeyword &&
        !job.location.address.toLowerCase().includes(zoneKeyword)
      )
        return false;
      if (filters.maxDistance) {
        const dist = distanceTo(job);
        if (dist === undefined || dist > Number(filters.maxDistance)) return false;
      }
      if (filters.publishedFrom) {
        const from = new Date(`${filters.publishedFrom}T00:00:00`).getTime();
        if (new Date(job.createdAt).getTime() < from) return false;
      }
      return true;
    });

    switch (filters.sortBy) {
      case 'price_asc':
        result = [...result].sort((a, b) => a.pricing.proposedPrice - b.pricing.proposedPrice);
        break;
      case 'price_desc':
        result = [...result].sort((a, b) => b.pricing.proposedPrice - a.pricing.proposedPrice);
        break;
      default:
        result = [...result].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
    }
    return result;
  }, [jobs, filters, user, distanceTo]);

  if (loading) return <Spinner label="Buscando trabajos disponibles..." />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <PageHeader
            title="Trabajos disponibles"
            subtitle="Clientes publicando trabajos en tu zona. ¡Haz tu oferta!"
            breadcrumbs={[{ label: 'Trabajos Disponibles' }]}
          />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-3.5 py-1.5 text-sm font-bold text-white shadow-md shadow-brand-600/25">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-white"></span>
            </span>
            {jobs.length} trabajos activos
          </span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        <div className="lg:col-span-1 space-y-4">
          <JobFilters categories={categories} filters={filters} onChange={setFilters} />
        </div>

        <div className="lg:col-span-3">
          {filtered.length === 0 ? (
            <WorkflowEmptyState
              icon={<ClipboardList className="h-9 w-9 text-brand-700" />}
              title="No hay trabajos que coincidan"
              description="Ajusta tus filtros o vuelve más tarde: los clientes publican nuevas solicitudes a diario."
              primaryAction={
                <Button
                  onClick={() => setFilters(initialFilters)}
                  className="rounded-xl bg-brand-600 text-white shadow-md shadow-brand-600/25 hover:bg-brand-700"
                >
                  Restablecer filtros
                </Button>
              }
              steps={[
                { title: 'Amplía tu búsqueda', description: 'Prueba con otra categoría, zona o rango de precio.' },
                { title: 'Aumenta la distancia', description: 'Revisa también trabajos un poco más lejos de tu área.' },
                { title: 'Vuelve más tarde', description: 'Nuevas solicitudes se publican constantemente.' },
              ]}
            />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2">
              {filtered.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  category={categoryMap.get(job.details.categoryId)}
                  to={`/profesional/trabajo/${job.id}`}
                  distanceKm={distanceTo(job)}
                  offerCta
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}