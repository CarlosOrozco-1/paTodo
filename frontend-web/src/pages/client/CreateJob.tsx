import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  ArrowLeft,
  MapPin,
  Tag,
  Coins,
  FileText,
  CheckCircle2,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Rocket,
  Save,
} from 'lucide-react';
import { categoriesService, skillsService } from '@/api/categories.service';
import { jobsService } from '@/api/jobs.service';
import type { Category, Skill } from '@/types/category.types';
import type { CreateJobDto } from '@/types/job.types';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { JobLocationMap } from '@/components/ui/JobLocationMap';
import { toast } from '@/stores/uiStore';
import { cn } from '@/utils/cn';

const DRAFT_KEY = 'paTodo_draft_job';

const steps = [
  { num: 1, label: 'Detalles', icon: <FileText className="h-4 w-4" /> },
  { num: 2, label: 'Ubicación', icon: <MapPin className="h-4 w-4" /> },
  { num: 3, label: 'Presupuesto', icon: <Coins className="h-4 w-4" /> },
  { num: 4, label: 'Publicar', icon: <Rocket className="h-4 w-4" /> },
];

export function CreateJob() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [step, setStep] = useState(1);
  const [maxVisited, setMaxVisited] = useState(1);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [address, setAddress] = useState('');
  
  // Coordenadas dinámicas basadas en la dirección escrita (por defecto Ciudad de Guatemala)
  const [coordinates, setCoordinates] = useState<[number, number]>([-90.5069, 14.6349]);

  const [price, setPrice] = useState('');
  const [priceType, setPriceType] = useState<'fixed' | 'negotiable'>('fixed');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Efecto para buscar las coordenadas en Mapbox cuando el usuario escribe la dirección
  useEffect(() => {
    const resolveCoordinates = async () => {
      if (!address || address.trim().length < 3) return;
      const token = import.meta.env.VITE_MAPBOX_TOKEN;
      if (!token) return;

      try {
        const query = encodeURIComponent(`${address}, Guatemala`);
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?access_token=${token}&country=gt&limit=1`
        );
        const data = await res.json();
        if (data.features && data.features.length > 0) {
          const [lng, lat] = data.features[0].center;
          setCoordinates([lng, lat]);
        }
      } catch {
        // Fallback silencioso en caso de error de red
      }
    };

    const timer = setTimeout(() => {
      resolveCoordinates();
    }, 500);

    return () => clearTimeout(timer);
  }, [address]);

  useEffect(() => {
    const load = async () => {
      try {
        const [cats, skls] = await Promise.all([
          categoriesService.getAll(),
          skillsService.getAll(),
        ]);
        setCategories(cats);
        setSkills(skls);

        const draft = localStorage.getItem(DRAFT_KEY);
        if (draft) {
          try {
            const parsed = JSON.parse(draft);
            if (parsed.title) setTitle(parsed.title);
            if (parsed.description) setDescription(parsed.description);
            if (parsed.categoryId) setCategoryId(parsed.categoryId);
            if (parsed.skillIds?.length) setSelectedSkills(parsed.skillIds);
            if (parsed.address) setAddress(parsed.address);
            if (parsed.price) setPrice(parsed.price);
            if (parsed.priceType) setPriceType(parsed.priceType);
          } catch {
            localStorage.removeItem(DRAFT_KEY);
          }
        }
      } catch {
        setCategories([]);
        setSkills([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const activeCategories = useMemo(
    () => categories.filter((c) => c.isActive),
    [categories],
  );

  const category = useMemo(
    () => activeCategories.find((c) => c.id === categoryId),
    [activeCategories, categoryId],
  );

  const skillsForCategory = useMemo(
    () => (categoryId ? skills.filter((s) => s.categoryIds.includes(categoryId)) : skills),
    [skills, categoryId],
  );

  const toggleSkill = (skillId: string) => {
    setSelectedSkills((prev) =>
      prev.includes(skillId)
        ? prev.filter((id) => id !== skillId)
        : [...prev, skillId],
    );
  };

  const validateStep = (s: number): boolean => {
    const next: Record<string, string> = {};
    if (s === 1) {
      if (!title.trim()) next.title = 'El título es obligatorio';
      if (!description.trim()) next.description = 'La descripción es obligatoria';
      if (!categoryId) next.categoryId = 'Selecciona una categoría';
      if (selectedSkills.length === 0) next.skills = 'Selecciona al menos una habilidad';
    }
    if (s === 2) {
      if (!address.trim()) next.address = 'La dirección es obligatoria';
    }
    if (s === 3) {
      if (!price || Number(price) <= 0) next.price = 'Ingresa un precio válido mayor a 0';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const goNext = () => {
    if (!validateStep(step)) return;
    const next = Math.min(step + 1, steps.length);
    setMaxVisited((v) => Math.max(v, next));
    setStep(next);
    setErrors({});
  };

  const goToStep = (s: number) => {
    if (s <= maxVisited) {
      setStep(s);
      setErrors({});
    }
  };

  const buildPayload = (): CreateJobDto => ({
    details: {
      title: title.trim(),
      description: description.trim(),
      categoryId,
      skillIds: selectedSkills,
    },
    location: {
      coordinates: coordinates, // Envía las coordenadas reales encontradas por el buscador
      address: address.trim(),
    },
    pricing: {
      proposedPrice: Number(price),
      currency: 'GTQ',
      priceType,
    },
  });

  const saveDraft = () => {
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ title, description, categoryId, skillIds: selectedSkills, address, price, priceType }),
    );
    toast('success', 'Borrador guardado correctamente');
  };

  const publish = async () => {
    if (!validateStep(step)) return;
    setSubmitting(true);
    try {
      await jobsService.create(buildPayload());
      localStorage.removeItem(DRAFT_KEY);
      toast('success', 'Trabajo publicado correctamente');
      navigate('/cliente/mis-trabajos');
    } catch {
      toast('error', 'No se pudo publicar el trabajo');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Spinner label="Cargando formulario de solicitud..." />;

  const tips = [
    'Describe alcance, medidas y materiales con precisión.',
    'Añade fotos o medidas para ahorrar idas y vueltas.',
    'Define tu zona y presupuesto para ofertas realistas.',
  ];

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/cliente/mis-trabajos"
          className="mb-3 inline-flex items-center gap-2 text-xs font-bold text-gray-500 transition-colors hover:text-brand-600"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a mis trabajos
        </Link>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-black tracking-tight text-gray-900">Publicar un trabajo</h1>
          <Sparkles className="h-5 w-5 text-brand-600" />
        </div>
        <p className="mt-1 text-sm text-gray-500">
          Sigue los pasos y recibe ofertas competitivas de profesionales en tu área
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Barra de progreso por pasos */}
          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="flex items-center">
              {steps.map((s, i) => {
                const isDone = step > s.num;
                const isCurrent = step === s.num;
                return (
                  <div key={s.num} className="flex flex-1 items-center last:flex-none">
                    <button
                      type="button"
                      onClick={() => goToStep(s.num)}
                      className={cn(
                        'flex flex-col items-center gap-1.5 cursor-pointer',
                        isCurrent ? '' : 'group',
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-10 w-10 items-center justify-center rounded-2xl border-2 font-black text-sm transition-all duration-300',
                          isDone
                            ? 'border-emerald-500 bg-emerald-500 text-white'
                            : isCurrent
                              ? 'border-brand-600 bg-brand-600 text-white shadow-lg shadow-brand-600/30 scale-110'
                              : 'border-gray-200 bg-white text-gray-400 group-hover:border-brand-200 group-hover:text-brand-600',
                        )}
                      >
                        {isDone ? <CheckCircle2 className="h-5 w-5" /> : s.num}
                      </span>
                      <span
                        className={cn(
                          'flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider',
                          isCurrent ? 'text-brand-700' : isDone ? 'text-emerald-600' : 'text-gray-400',
                        )}
                      >
                        {s.icon}
                        {s.label}
                      </span>
                    </button>
                    {i < steps.length - 1 && (
                      <div className="mx-2 flex-1">
                        <div
                          className={cn(
                            'h-0.5 rounded-full transition-colors duration-500',
                            step > s.num ? 'bg-emerald-400' : 'bg-gray-200',
                          )}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Panel del paso actual */}
          <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
            {step === 1 && (
              <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-600">Paso 1 de 4</p>
                  <h2 className="mt-0.5 text-lg font-black text-gray-900">¿Qué necesitas hacer?</h2>
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Input
                    label="Título del trabajo *"
                    placeholder="Ej: Cambio de llanta urgente"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    error={errors.title}
                  />
                  <Select
                    label="Categoría *"
                    placeholder="Selecciona una categoría"
                    options={activeCategories.map((c) => ({ value: c.id, label: c.name }))}
                    value={categoryId}
                    onChange={(e) => {
                      setCategoryId(e.target.value);
                      setSelectedSkills([]);
                    }}
                    error={errors.categoryId}
                  />
                </div>
                <Textarea
                  label="Descripción del trabajo *"
                  placeholder="Describe qué necesitas, con detalles como dimensiones, materiales, urgencia, etc."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  error={errors.description}
                />
                {categoryId && (
                  <div className="rounded-2xl bg-gray-50/80 p-4 border border-gray-100">
                    <p className="mb-2.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-500">
                      <Tag className="h-3.5 w-3.5 text-brand-600" />
                      Habilidades requeridas *
                    </p>
                    {skillsForCategory.length === 0 ? (
                      <p className="text-xs text-gray-500 italic">
                        No hay habilidades específicas registradas para esta categoría.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {skillsForCategory.map((skill) => {
                          const isSelected = selectedSkills.includes(skill.id);
                          return (
                            <button
                              key={skill.id}
                              type="button"
                              onClick={() => toggleSkill(skill.id)}
                              className={cn(
                                'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer shadow-xs',
                                isSelected
                                  ? 'bg-brand-600 text-white shadow-md shadow-brand-600/20 ring-2 ring-brand-600/30'
                                  : 'border border-gray-200 bg-white text-gray-700 hover:border-brand-300 hover:bg-brand-50/50',
                              )}
                            >
                              {isSelected && <CheckCircle2 className="h-3.5 w-3.5" />}
                              {skill.name}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {errors.skills && <p className="mt-2 text-xs font-medium text-red-600">{errors.skills}</p>}
                  </div>
                )}
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-teal-600">Paso 2 de 4</p>
                  <h2 className="mt-0.5 text-lg font-black text-gray-900">¿Dónde se realizará el trabajo?</h2>
                </div>
                <Input
                  label="Dirección de ubicación *"
                  placeholder="Ej: Zona 10, Ciudad de Guatemala (15 Avenida 10-23)"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  leftIcon={<MapPin className="h-4 w-4 text-brand-600" />}
                  error={errors.address}
                />
                <div className="space-y-2 pt-1">
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-600">
                    Vista previa de ubicación
                  </label>
                  <JobLocationMap
                    origin={{
                      addressText: address || 'Ciudad de Guatemala',
                      lat: coordinates[1], // Se actualiza dinámicamente con la búsqueda
                      lng: coordinates[0], // Se actualiza dinámicamente con la búsqueda
                      label: `${address || 'Ubicación aproximada'}, Guatemala`,
                    }}
                    className="h-56 w-full rounded-2xl"
                  />
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-600">Paso 3 de 4</p>
                  <h2 className="mt-0.5 text-lg font-black text-gray-900">¿Cuál es tu presupuesto?</h2>
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Input
                    label="Precio propuesto (GTQ) *"
                    type="number"
                    min="0"
                    placeholder="Ej: 250"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    leftIcon={<span className="text-lg text-brand-600">Q</span>}
                    error={errors.price}
                  />
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-500">
                      Tipo de precio
                    </label>
                    <div className="flex rounded-2xl bg-gray-100/80 p-1 border border-gray-200/60">
                      <button
                        type="button"
                        onClick={() => setPriceType('fixed')}
                        className={cn(
                          'flex-1 rounded-xl py-2 text-xs font-bold transition-all cursor-pointer',
                          priceType === 'fixed'
                            ? 'bg-white text-gray-900 shadow-xs ring-1 ring-gray-200'
                            : 'text-gray-500 hover:text-gray-800',
                        )}
                      >
                        Precio fijo
                      </button>
                      <button
                        type="button"
                        onClick={() => setPriceType('negotiable')}
                        className={cn(
                          'flex-1 rounded-xl py-2 text-xs font-bold transition-all cursor-pointer',
                          priceType === 'negotiable'
                            ? 'bg-white text-gray-900 shadow-xs ring-1 ring-gray-200'
                            : 'text-gray-500 hover:text-gray-800',
                        )}
                      >
                        Negociable
                      </button>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl bg-amber-50/70 border border-amber-100 p-4">
                  <p className="text-xs text-amber-800 leading-relaxed">
                    <span className="font-black">Sugerencia:</span> un precio justo atrae ofertas más rápidas.
                    Si no estás seguro, elige <span className="font-bold">Negociable</span> y deja que los
                    profesionales propongan su tarifa.
                  </p>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-600">Paso 4 de 4</p>
                  <h2 className="mt-0.5 text-lg font-black text-gray-900">Revisa y publica</h2>
                </div>
                <div className="space-y-2 rounded-2xl border border-gray-100 bg-gray-50/50 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Trabajo</p>
                      <p className="text-sm font-bold text-gray-900">{title || 'Sin título aún'}</p>
                    </div>
                    <span
                      className="rounded-full px-2.5 py-1 text-[10px] font-bold text-white"
                      style={{ backgroundColor: category?.color || '#0d9488' }}
                    >
                      {category?.name || 'Categoría'}
                    </span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Ubicación</p>
                      <p className="text-xs font-semibold text-gray-700">{address || '—'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Presupuesto</p>
                      <p className="text-xs font-semibold text-gray-700">
                        {price ? `Q${Number(price).toLocaleString('es-GT')}` : '—'}{' '}
                        <span className="text-gray-400">/ {priceType === 'fixed' ? 'precio fijo' : 'negociable'}</span>
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Habilidades</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {selectedSkills.length === 0 ? (
                        <span className="text-xs text-gray-400">Ninguna seleccionada</span>
                      ) : (
                        skillsForCategory
                          .filter((s) => selectedSkills.includes(s.id))
                          .map((s) => (
                            <span key={s.id} className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-700 ring-1 ring-brand-100">
                              {s.name}
                            </span>
                          ))
                      )}
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl bg-emerald-50/70 border border-emerald-100 p-4 flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <p className="text-xs text-emerald-800 leading-relaxed">
                    Tu solicitud quedará visible para profesionales de tu zona y recibirás propuestas
                    con precio y tiempo estimado.
                  </p>
                </div>
              </div>
            )}

            {/* Controles de navegación */}
            <div className="mt-8 flex flex-col-reverse justify-between gap-3 border-t border-gray-100 pt-6 sm:flex-row sm:items-center">
              <Button
                variant="outline"
                onClick={() => navigate(-1)}
                className="w-full rounded-xl sm:w-auto"
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Cancelar
              </Button>
              <div className="flex flex-col-reverse gap-3 sm:flex-row">
                {step > 1 && (
                  <Button
                    variant="ghost"
                    onClick={() => goToStep(step - 1)}
                    className="w-full rounded-xl sm:w-auto"
                  >
                    <ChevronLeft className="mr-1 h-4 w-4" />
                    Volver
                  </Button>
                )}
                {step === 4 ? (
                  <>
                    <Button
                      variant="outline"
                      onClick={saveDraft}
                      className="w-full rounded-xl sm:w-auto"
                    >
                      <Save className="mr-1 h-4 w-4" />
                      Guardar borrador
                    </Button>
                    <Button
                      onClick={publish}
                      loading={submitting}
                      className="w-full rounded-xl bg-brand-600 text-white shadow-md shadow-brand-600/20 hover:bg-brand-700 sm:w-auto"
                    >
                      Publicar trabajo
                      <Rocket className="ml-1 h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={goNext}
                    className="w-full rounded-xl bg-brand-600 text-white shadow-md shadow-brand-600/20 hover:bg-brand-700 sm:w-auto"
                  >
                    Continuar
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Panel lateral */}
        <div className="space-y-6">
          <div className="rounded-3xl border border-brand-100/70 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white shadow-md shadow-brand-600/25">
                <FileText className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-black text-gray-900">Resumen de tu trabajo</h3>
            </div>
            <div className="mt-4 space-y-3 text-xs">
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-400">Título</span>
                <span className="max-w-[140px] truncate text-right font-bold text-gray-800">
                  {title || 'Por definir'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-400">Categoría</span>
                <span className="font-bold text-gray-800">{category?.name || '—'}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-400">Zona / Municipio</span>
                <span className="max-w-[140px] truncate text-right font-bold text-gray-800">
                  {address ? address.split(',')[0] : 'Guatemala'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-400">Presupuesto</span>
                <span className="font-bold text-gray-800">
                  {price ? `Q${Number(price).toLocaleString('es-GT')}` : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-400">Tipo</span>
                <span className="font-bold text-gray-800">
                  {priceType === 'fixed' ? 'Precio fijo' : 'Negociable'}
                </span>
              </div>
              <div>
                <span className="text-gray-400">Habilidades</span>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {selectedSkills.length === 0 ? (
                    <span className="text-xs text-gray-300">Ninguna</span>
                  ) : (
                    skillsForCategory
                      .filter((s) => selectedSkills.includes(s.id))
                      .slice(0, 4)
                      .map((s) => (
                        <span key={s.id} className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-700 ring-1 ring-brand-100">
                          {s.name}
                        </span>
                      ))
                  )}
                  {selectedSkills.length > 4 && (
                    <span className="text-[10px] font-bold text-gray-400">+{selectedSkills.length - 4}</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-brand-100/70 bg-gradient-to-br from-brand-50/60 to-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white shadow-md shadow-brand-600/25">
                <Sparkles className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-black text-gray-900">Consejos para mejores propuestas</h3>
            </div>
            <ol className="mt-4 space-y-3">
              {tips.map((tip, index) => (
                <li key={index} className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[10px] font-black text-brand-700">
                    {index + 1}
                  </span>
                  <p className="text-xs leading-relaxed text-gray-600">{tip}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}