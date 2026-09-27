import { useEffect, useState } from 'react';
import { BadgeCheck, Briefcase, Camera, CheckCircle2, Mail, MapPin, Phone, Power, ShieldCheck, UserCheck } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { skillsService } from '@/api/categories.service';
import { usersService } from '@/api/users.service';
import { toast } from '@/stores/uiStore';
import { getErrorMessage } from '@/api/axiosClient';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Avatar } from '@/components/ui/Avatar';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { StarRating } from '@/components/ui/StarRating';
import { JobLocationMap } from '@/components/ui/JobLocationMap'; // IMPORTANTE
import { fullName } from '@/utils/formatters';
import { cn } from '@/utils/cn';
import type { Skill } from '@/types/category.types';

export function ProProfile() {
  const { user, setUser } = useAuthStore();
  const [saving, setSaving] = useState(false);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loadingSkills, setLoadingSkills] = useState(true);

  const [firstName, setFirstName] = useState(user?.profile.firstName || '');
  const [lastName, setLastName] = useState(user?.profile.lastName || '');
  const [email, setEmail] = useState(user?.account.email || '');
  const [phone, setPhone] = useState(user?.contact.phone || '');
  const [bio, setBio] = useState(user?.profile.bio || '');
  const [city, setCity] = useState(user?.contact.address?.city || '');
  const [radius, setRadius] = useState(
    String(user?.availability.serviceArea?.radiusKm ?? 10),
  );
  const [selectedSkills, setSelectedSkills] = useState<string[]>(
    user?.skillIds || [],
  );

  // Completitud del perfil para que los clientes lo vean completo
  const completionSteps = [
    Boolean(firstName && lastName),
    Boolean(bio.trim()),
    Boolean(phone),
    Boolean(city),
    selectedSkills.length > 0,
  ];
  const completion = Math.round(
    (completionSteps.filter(Boolean).length / completionSteps.length) * 100,
  );


  useEffect(() => {
    const load = async () => {
      try {
        const data = await skillsService.getAll();
        setSkills(data);
      } catch {
        setSkills([]);
      } finally {
        setLoadingSkills(false);
      }
    };
    load();
  }, []);

  const toggleSkill = (skillId: string) => {
    setSelectedSkills((prev) =>
      prev.includes(skillId)
        ? prev.filter((id) => id !== skillId)
        : [...prev, skillId],
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await usersService.updateMe({
        profile: { firstName, lastName, bio },
        contact: {
          phone,
          alternatePhone: user!.contact.alternatePhone,
          address: {
            ...user!.contact.address,
            city,
          },
        },
        skillIds: selectedSkills,
        availability: {
          ...user!.availability,
          serviceArea: {
            ...user!.availability.serviceArea,
            radiusKm: Number(radius),
          },
        },
      });
      setUser(updated);
      toast('success', 'Perfil actualizado correctamente');
    } catch (error) {
      toast('error', getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const isOnline = user?.availability.isOnline;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Título */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Mi Perfil Profesional</h1>
        <p className="mt-1 text-sm text-gray-500">
          Muestra tus habilidades, biografía y zona de cobertura a potenciales clientes
        </p>
      </div>

      {/* Tarjeta Principal con Banner */}
      <Card className="overflow-hidden border border-gray-100 shadow-xl shadow-gray-200/50">
        <div className="relative h-28 overflow-hidden bg-gradient-to-r from-brand-700 via-brand-600 to-emerald-500">
          <div className="absolute -right-8 -top-12 h-36 w-36 rounded-full bg-white/10 blur-2xl animate-blob" />
          <div className="absolute left-1/4 -bottom-14 h-32 w-32 rounded-full bg-emerald-300/25 blur-2xl animate-blob" style={{ animationDelay: '-2.5s' }} />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.18),transparent_55%)]" />
        </div>
        <CardContent className="relative flex flex-col items-center gap-5 p-6 pt-0 sm:flex-row sm:items-end">
          <div className="relative -mt-14 group shrink-0">
            <div className="rounded-full bg-gradient-to-tr from-brand-600 via-emerald-400 to-emerald-300 p-[3px] shadow-xl transition-transform duration-300 group-hover:scale-105">
              <Avatar name={fullName(user?.profile)} src={user?.profile.avatarUrl} size="xl" />
            </div>
            <button 
              type="button" 
              className="absolute bottom-0 right-0 rounded-full bg-brand-600 p-2 text-white shadow-md ring-2 ring-white transition-all hover:scale-110 hover:bg-brand-700 cursor-pointer"
            >
              <Camera className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 text-center sm:text-left sm:pb-1">
            <h2 className="text-2xl font-bold text-gray-900 leading-tight">
              {fullName(user?.profile)}
            </h2>

            <div className="mt-2 flex flex-wrap items-center justify-center gap-2.5 sm:justify-start">
              <div className="flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 ring-1 ring-amber-200/60">
                <StarRating
                  rating={user?.stats.rating || 0}
                  count={user?.stats.ratingCount}
                  showValue
                  size="sm"
                />
              </div>

              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200/60">
                <Briefcase className="h-3.5 w-3.5" />
                {user?.stats.completedJobs || 0} trabajos completados
              </span>

              <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-brand-600 to-emerald-600 px-3 py-1 text-xs font-bold text-white shadow-sm shadow-brand-600/25">
                <BadgeCheck className="h-3.5 w-3.5" />
                Profesional verificado
              </span>

              <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700 ring-1 ring-teal-200/60">
                <ShieldCheck className="h-3.5 w-3.5" />
                Identidad y experiencia verificadas
              </span>

              <span className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 transition-all",
                isOnline 
                  ? "bg-emerald-50 text-emerald-700 ring-emerald-200" 
                  : "bg-gray-100 text-gray-600 ring-gray-200"
              )}>
                {isOnline && (
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                  </span>
                )}
                {isOnline ? 'En línea' : 'Desconectado'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Completitud del perfil */}
      <Card className="border border-gray-100 shadow-sm">
        <CardContent className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-600 to-emerald-500 text-white shadow-md shadow-brand-600/30">
                <UserCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">Completitud de tu perfil</p>
                <p className="text-xs text-gray-500">Tu perfil es tu carta de presentación ante los clientes.</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-black text-brand-700">{completion}%</p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                {completion === 100 ? '¡Listo para destacar!' : 'Complétalo para recibir más trabajos'}
              </p>
            </div>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-500 to-emerald-500 transition-all duration-700 ease-out"
              style={{ width: `${completion}%` }}
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {['Nombre completo', 'Presentación', 'Teléfono', 'Ciudad', 'Especialidades'].map((label, i) => (
              <span
                key={label}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide',
                  completionSteps[i] ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-400'
                )}
              >
                <CheckCircle2 className="h-2.5 w-2.5" />
                {label}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Información Personal */}
      <Card className="border border-gray-100 shadow-sm">
        <CardHeader title="Información personal" subtitle="Tus datos personales y biografía profesional" />
        <CardContent className="space-y-4 pt-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Nombre"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
            <Input
              label="Apellido"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              leftIcon={<Mail className="h-4 w-4 text-gray-400" />}
            />
            <Input
              label="Teléfono"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              leftIcon={<Phone className="h-4 w-4 text-gray-400" />}
            />
          </div>
          <Textarea
            label="Sobre ti / Presentación"
            placeholder="Describe tu experiencia, especialidad, años de trabajo, herramientas propias..."
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />
        </CardContent>
      </Card>

      {/* Habilidades Requeridas */}
      <Card className="border border-gray-100 shadow-sm">
        <CardHeader
          title="Mis Especialidades"
          subtitle={
            loadingSkills
              ? 'Cargando habilidades del sistema...'
              : `Selecciona los servicios que puedes realizar · ${selectedSkills.length} seleccionadas`
          }
        />
        <CardContent className="pt-2">
          {loadingSkills ? (
            <p className="text-xs text-gray-400 italic">Cargando habilidades del sistema...</p>
          ) : skills.length === 0 ? (
            <p className="text-xs text-gray-500">No hay habilidades registradas.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {skills.map((skill) => {
                const isSelected = selectedSkills.includes(skill.id);
                return (
                  <button
                    key={skill.id}
                    type="button"
                    onClick={() => toggleSkill(skill.id)}
                    className={cn(
                      'flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer shadow-xs',
                      isSelected
                        ? 'bg-brand-600 text-white ring-2 ring-brand-600/30 shadow-brand-600/20'
                        : 'border border-gray-200 bg-white text-gray-700 hover:border-brand-300 hover:bg-brand-50/50'
                    )}
                  >
                    {isSelected && <CheckCircle2 className="h-3.5 w-3.5" />}
                    {skill.name}
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Área de Cobertura y Estado con Mapa Integrado */}
      <Card className="border border-gray-100 shadow-sm">
        <CardHeader title="Ubicación y Disponibilidad" subtitle="Configura tu zona de cobertura de servicio" />
        <CardContent className="space-y-4 pt-2">
          <div className="grid gap-4 sm:grid-cols-3">
            <Input
              label="Ciudad / Zona Base"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Ej: Ciudad de Guatemala"
              leftIcon={<MapPin className="h-4 w-4 text-brand-600" />}
            />
            <Input
              label="Radio de cobertura (km)"
              type="number"
              min="1"
              max="100"
              value={radius}
              onChange={(e) => setRadius(e.target.value)}
            />
            <div className="flex flex-col justify-end">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5 sm:hidden">
                Estado Actual
              </label>
              <button
                type="button"
                onClick={() =>
                  setUser({
                    ...user!,
                    availability: {
                      ...user!.availability,
                      isOnline: !user!.availability.isOnline,
                    },
                  })
                }
                className={cn(
                  'flex items-center justify-center gap-2 w-full rounded-2xl border py-2.5 text-xs font-bold transition-all cursor-pointer shadow-xs',
                  isOnline
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'
                )}
              >
                <Power className="h-4 w-4" />
                {isOnline ? 'En línea' : 'Desconectado'}
              </button>
            </div>
          </div>

          {/* VISUALIZACIÓN DEL MAPA DE COBERTURA */}
          <div className="space-y-2 pt-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-600">
              Ubicación de Cobertura
            </label>

  <JobLocationMap
    origin={{
      addressText: city ? `${city}, Guatemala` : 'Ciudad de Guatemala',
      label: `Base de Operaciones: ${city || 'Ubicación Profesional'}`,
    }}
    className="h-56 w-full"
  />
</div>
          

          <p className="flex items-center gap-1.5 text-xs text-gray-400">
            <Briefcase className="h-3.5 w-3.5" />
            Tu visibilidad determina si aparecerás en el mapa y en los filtros de búsqueda rápida de clientes.
          </p>
        </CardContent>
      </Card>

      {/* Botón de Guardado */}
      <div className="flex justify-end pt-2">
        <Button onClick={handleSave} loading={saving} size="lg" className="rounded-xl shadow-md shadow-brand-600/20">
          Guardar cambios
        </Button>
      </div>
    </div>
  );
}