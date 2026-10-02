import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import {
  ArrowLeft,
  Briefcase,
  MapPin,
  MessageSquare,
  Sparkles,
  UserX,
  Wrench,
} from 'lucide-react';
import { usersService } from '@/api/users.service';
import { skillsService } from '@/api/categories.service';
import { getErrorMessage } from '@/api/axiosClient';
import { useAuthStore } from '@/stores/authStore';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { StarRating } from '@/components/ui/StarRating';
import { ReviewsList } from '@/components/reviews/ReviewsList';
import { fullName } from '@/utils/formatters';
import { ROLE_LABELS } from '@/utils/roles';
import type { Skill } from '@/types/category.types';
import type { User } from '@/types/user.types';

/**
 * Perfil público de cualquier usuario. Complementa `ProProfile` y
 * `ClientProfile`, que son formularios de edición: aquí solo se lee.
 *
 * Es la vista a la que apuntan los nombres clicables en el chat y en el
 * detalle de los trabajos, para poder valorar a la contraparte antes de
 * volver a trabajar con ella.
 */
export function PublicProfile() {
  const { id } = useParams<{ id: string }>();
  const currentUser = useAuthStore((state) => state.user);
  // El resultado se etiqueta con el id solicitado: si cambia el parámetro de
  // la ruta, se muestra el spinner en vez del perfil anterior, sin necesidad de
  // reiniciar el estado dentro del efecto.
  const [result, setResult] = useState<{ id: string; user: User | null } | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    // Suscripción en lugar de una lectura única: el estado de disponibilidad y
    // las reseñas del perfil cambian sin que quien mira haga nada, y con un
    // `getDoc` la pantalla se quedaría mostrando datos viejos.
    let unsubscribe = () => {};
    try {
      unsubscribe = usersService.subscribe(
        id,
        (user) => {
          if (cancelled) return;
          setResult({ id, user });
        },
        (error) => {
          if (cancelled) return;
          setResult({ id, user: null });
          console.warn('No se pudo cargar el perfil:', getErrorMessage(error));
        },
      );
    } catch (error) {
      // Se difiere a la siguiente tarea: el fallo sincrónico solo ocurre si no
      // hay sesión, y marcarlo en el mismo tick cortaría el splash antes de
      // que el guard de autenticación decida a dónde llevar al usuario.
      queueMicrotask(() => {
        if (cancelled) return;
        setResult({ id, user: null });
        console.warn('No se pudo abrir la suscripción del perfil:', getErrorMessage(error));
      });
    }
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const all = await skillsService.getAll();
        if (!cancelled) setSkills(all);
      } catch {
        if (!cancelled) setSkills([]);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const profile = result && result.id === id ? result.user : null;
  const loading = !id || result?.id !== id;

  const profileSkills = useMemo(() => {
    if (!profile?.skillIds?.length) return [];
    const wanted = new Set(profile.skillIds);
    return skills.filter((skill) => wanted.has(skill.id));
  }, [profile, skills]);

  if (loading) return <Spinner label="Cargando perfil..." />;

  if (!profile) {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-gray-400">
          <UserX className="h-8 w-8" />
        </div>
        <p className="text-lg font-semibold text-gray-700">Perfil no encontrado</p>
        <p className="mt-1 text-sm text-gray-500">
          Es posible que el usuario ya no exista o haya desactivado su cuenta.
        </p>
        <Link to="/mensajes" className="mt-6 inline-block">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" /> Volver a mensajes
          </Button>
        </Link>
      </div>
    );
  }

  const isSelf = currentUser?.id === profile.id;
  const name = fullName(profile.profile);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/mensajes"
          className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 transition-colors hover:text-brand-600"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Link>

        <div className="flex flex-wrap gap-2">
          {isSelf ? (
            <Link
              to={profile.role === 'client' ? '/cliente/perfil' : '/profesional/perfil'}
            >
              <Button variant="outline" size="sm">
                Editar mi perfil
              </Button>
            </Link>
          ) : (
            <Link to={`/mensajes?userId=${profile.id}`}>
              <Button size="sm">
                <MessageSquare className="mr-2 h-4 w-4" />
                Enviar mensaje
              </Button>
            </Link>
          )}
        </div>
      </div>

      <Card className="overflow-hidden border border-gray-100 shadow-xl shadow-gray-200/50">
        <div className="relative h-28 overflow-hidden bg-gradient-to-r from-brand-700 via-brand-600 to-emerald-500">
          <div className="absolute -right-8 -top-12 h-36 w-36 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute bottom-[-3.5rem] left-1/4 h-32 w-32 rounded-full bg-emerald-300/25 blur-2xl" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.18),transparent_55%)]" />
        </div>

        <CardContent className="relative flex flex-col items-center gap-5 p-6 pt-0 sm:flex-row sm:items-end">
          <div className="-mt-14 shrink-0">
            <div className="rounded-full bg-gradient-to-tr from-brand-600 via-emerald-400 to-emerald-300 p-[3px] shadow-xl">
              <Avatar name={name} src={profile.profile.avatarUrl} size="xl" />
            </div>
          </div>

          <div className="flex-1 text-center sm:pb-1 sm:text-left">
            <h1 className="text-2xl font-bold leading-tight text-gray-900">{name}</h1>

            <div className="mt-2 flex flex-wrap items-center justify-center gap-2.5 sm:justify-start">
              <div className="flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 ring-1 ring-amber-200/60">
                <StarRating
                  rating={profile.stats.rating || 0}
                  count={profile.stats.ratingCount}
                  showValue
                  size="sm"
                />
              </div>

              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200/60">
                <Briefcase className="h-3.5 w-3.5" />
                {profile.stats.completedJobs || 0} trabajos completados
              </span>

              <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600 ring-1 ring-gray-200">
                {ROLE_LABELS[profile.role]}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {profile.profile.bio && (
        <Card className="border border-gray-100 shadow-sm">
          <CardHeader title="Sobre mí" />
          <CardContent>
            <p className="whitespace-pre-line text-sm leading-relaxed text-gray-700">
              {profile.profile.bio}
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {profile.contact.address?.city && (
          <Card className="border border-gray-100 shadow-sm">
            <CardContent className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-600 to-emerald-500 text-white shadow-md shadow-brand-600/30">
                <MapPin className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Ubicación
                </p>
                <p className="truncate text-sm font-bold text-gray-900">
                  {profile.contact.address.city}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border border-gray-100 shadow-sm">
          <CardContent className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-md shadow-emerald-600/30">
              <Briefcase className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Área de servicio
              </p>
              <p className="text-sm font-bold text-gray-900">
                {profile.availability.serviceArea?.radiusKm ?? 0} km de cobertura
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {profileSkills.length > 0 && (
        <Card className="border border-gray-100 shadow-sm">
          <CardHeader
            title="Habilidades"
            subtitle={`${profileSkills.length} ${profileSkills.length === 1 ? 'habilidad declarada' : 'habilidades declaradas'}`}
          />
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {profileSkills.map((skill) => (
                <span
                  key={skill.id}
                  className="inline-flex items-center gap-1.5 rounded-full bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-700 ring-1 ring-gray-200"
                >
                  <Wrench className="h-3.5 w-3.5 text-brand-600" />
                  {skill.name}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border border-gray-100 shadow-sm">
        <CardHeader
          title={
            <span className="inline-flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500" />
              Reseñas
            </span>
          }
          subtitle="Valoraciones de trabajos completados"
        />
        <CardContent>
          {id && <ReviewsList userId={id} />}
        </CardContent>
      </Card>
    </div>
  );
}
