import { useEffect, useState } from 'react';

import { ClipboardList } from 'lucide-react';

import { adminService } from '@/api/admin.service';

import { categoriesService } from '@/api/categories.service';

import type { Category } from '@/types/category.types';

import type { Job } from '@/types/job.types';

import { JobCard } from '@/components/jobs/JobCard';

import { Spinner } from '@/components/ui/Spinner';

import { EmptyState } from '@/components/ui/EmptyState';

import { cn } from '@/utils/cn';



const tabs = ['all', 'pending', 'published', 'assigned', 'in_progress', 'completed', 'cancelled'] as const;

type Tab = (typeof tabs)[number];



const tabLabels: Record<Tab, string> = {

  all: 'Todos',

  pending: 'Pendientes',

  published: 'Publicados',

  assigned: 'Asignados',

  in_progress: 'En progreso',

  completed: 'Completados',

  cancelled: 'Cancelados',

};



export function AllJobs() {

  const [jobs, setJobs] = useState<Job[]>([]);

  const [categories, setCategories] = useState<Category[]>([]);

  const [loading, setLoading] = useState(true);

  const [tab, setTab] = useState<Tab>('all');



  useEffect(() => {

    const load = async () => {

      try {

        const [jobsRes, cats] = await Promise.all([

          adminService.getAllJobs({ limit: 100 }),

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



  const categoryMap = new Map(categories.map((c) => [c.id, c]));



  const filtered = tab === 'all' ? jobs : jobs.filter((j) => j.status === tab);



  if (loading) return <Spinner label="Cargando todos los trabajos..." />;



  return (

    <div className="space-y-6">

      {/* Encabezado */}

      <div>

        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Todos los Trabajos</h1>

        <p className="mt-1 text-sm text-gray-500">

          Supervisa y administra el estado de todas las solicitudes publicadas en la plataforma PaTodo

        </p>

      </div>



      {/* Pestañas de Filtrado */}

      <div className="flex flex-wrap gap-2">

        {tabs.map((t) => {

          const isActive = tab === t;

          const count = t === 'all' ? jobs.length : jobs.filter((j) => j.status === t).length;



          return (

            <button

              key={t}

              onClick={() => setTab(t)}

              className={cn(

                'flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition-all cursor-pointer',

                isActive

                  ? 'bg-brand-600 text-white shadow-md shadow-brand-600/20'

                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 hover:border-gray-300'

              )}

            >

              <span>{tabLabels[t]}</span>

              <span

                className={cn(

                  'flex h-4 min-w-4 items-center justify-center rounded-full px-1.5 text-[10px] font-extrabold',

                  isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-700'

                )}

              >

                {count}

              </span>

            </button>

          );

        })}

      </div>



      {/* Grid de Trabajos */}

      {filtered.length === 0 ? (

        <EmptyState

          title="No hay trabajos en esta categoría"

          description="Los trabajos de la plataforma correspondientes a este estado aparecerán aquí."

          icon={<ClipboardList className="h-8 w-8 text-gray-400" />}

        />

      ) : (

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">

          {filtered.map((job) => (

            <JobCard

              key={job.id}

              job={job}

              category={categoryMap.get(job.details.categoryId)}

              to={`/cliente/trabajo/${job.id}`}

            />

          ))}

        </div>

      )}

    </div>

  );

} 

