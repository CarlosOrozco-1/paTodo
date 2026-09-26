import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Camera,
  Mail,
  Phone,
  User as UserIcon,
  MapPin,
  MapPinned,
  ShieldCheck,
  KeyRound,
  MonitorSmartphone,
  Sparkles,
  HelpCircle,
  BellRing,
  RotateCcw,
  Save,
  ChevronRight,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/uiStore';
import { getErrorMessage } from '@/api/axiosClient';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Avatar } from '@/components/ui/Avatar';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { JobLocationMap } from '@/components/ui/JobLocationMap';
import { PageHeader } from '@/components/ui/PageHeader';
import { fullName } from '@/utils/formatters';
import { cn } from '@/utils/cn';

const defaultPreferences = ['Avisos por correo', 'Notificaciones de ofertas nuevas'];

export function ClientProfile() {
  const navigate = useNavigate();
  const { user, setUser } = useAuthStore();
  const [saving, setSaving] = useState(false);

  const [firstName, setFirstName] = useState(user?.profile.firstName || '');
  const [lastName, setLastName] = useState(user?.profile.lastName || '');
  const [email, setEmail] = useState(user?.account.email || '');
  const [phone, setPhone] = useState(user?.contact.phone || '');
  const [address, setAddress] = useState(user?.contact.address?.street || '');
  const [departamento] = useState('Guatemala');
  const [municipio, setMunicipio] = useState(user?.contact.address?.city || 'Ciudad de Guatemala');
  const [zona] = useState('Zona 10');
  const [showOnlyZone, setShowOnlyZone] = useState(false);
  const [preferences, setPreferences] = useState<string[]>(defaultPreferences);

  const allPreferences = [
    'Avisos por correo',
    'Notificaciones de ofertas nuevas',
    'Recordatorios de solicitudes pendientes',
    'Boletín de consejos y ofertas destacadas',
  ];

  const clientLat = 14.6349;
  const clientLng = -90.5069;

  const hasChanges = useMemo(
    () =>
      firstName !== user?.profile.firstName ||
      lastName !== user?.profile.lastName ||
      email !== user?.account.email ||
      phone !== user?.contact.phone ||
      address !== user?.contact.address?.street,
    [firstName, lastName, email, phone, address, user],
  );

  const togglePreference = (pref: string) => {
    setPreferences((prev) =>
      prev.includes(pref) ? prev.filter((p) => p !== pref) : [...prev, pref],
    );
  };

  const discard = () => {
    setFirstName(user?.profile.firstName || '');
    setLastName(user?.profile.lastName || '');
    setEmail(user?.account.email || '');
    setPhone(user?.contact.phone || '');
    setAddress(user?.contact.address?.street || '');
    setMunicipio(user?.contact.address?.city || 'Ciudad de Guatemala');
    setPreferences(defaultPreferences);
    toast('info', 'Cambios descartados');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = {
        ...user!,
        profile: { ...user!.profile, firstName, lastName },
        contact: {
          ...user!.contact,
          phone,
          address: { ...user!.contact.address, street: address, city: municipio },
        },
        account: { ...user!.account, email },
      };
      setUser(updated);
      toast('success', 'Perfil actualizado correctamente');
    } catch (error) {
      toast('error', getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mi Perfil"
        subtitle="Administra tu información personal, ubicación y preferencias"
        breadcrumbs={[{ label: 'Mi Perfil' }]}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Tarjeta de cabecera */}
          <Card className="overflow-hidden border border-gray-100 shadow-sm">
            <div className="relative h-28 overflow-hidden bg-gradient-to-br from-brand-600 via-emerald-500 to-teal-400">
              <div className="absolute -right-8 -top-12 h-36 w-36 rounded-full bg-white/10 blur-2xl" />
              <div className="absolute -bottom-14 left-1/4 h-32 w-32 rounded-full bg-emerald-300/25 blur-2xl" />
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
                  aria-label="Cambiar foto"
                >
                  <Camera className="h-4 w-4" />
                </button>
              </div>

              <div className="min-w-0 flex-1 text-center sm:pb-1 sm:text-left">
                <h2 className="truncate text-2xl font-black leading-tight text-gray-900">
                  {fullName(user?.profile)}
                </h2>
                <div className="mt-0.5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-gray-500 sm:justify-start">
                  <span className="inline-flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-gray-400" />
                    {user?.account.email}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-gray-400" />
                    {user?.contact.phone || 'Sin teléfono'}
                  </span>
                </div>
                <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-teal-600 to-emerald-600 px-2.5 py-1 text-xs font-bold text-white shadow-sm shadow-emerald-600/20">
                  <UserIcon className="h-3.5 w-3.5" />
                  Cliente PaTodo
                </span>
              </div>
              <div className="hidden shrink-0 rounded-2xl border border-gray-100 bg-gray-50/70 px-4 py-3 text-center sm:block">
                <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Ubicación</p>
                <p className="mt-0.5 flex items-center gap-1 text-sm font-bold text-gray-800">
                  <MapPin className="h-3.5 w-3.5 text-brand-600" />
                  {municipio}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Información personal */}
          <Card className="border border-gray-100 shadow-sm">
            <CardHeader
              title={
                <div className="flex items-center gap-2">
                  <UserIcon className="h-4 w-4 text-brand-600" />
                  <span>Información personal</span>
                </div>
              }
              subtitle="Datos principales de tu cuenta de usuario"
            />
            <CardContent className="space-y-4 pt-2">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Nombre"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  leftIcon={<UserIcon className="h-4 w-4 text-gray-400" />}
                />
                <Input
                  label="Apellido"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  leftIcon={<UserIcon className="h-4 w-4 text-gray-400" />}
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
            </CardContent>
          </Card>

          {/* Ubicación Guatemala */}
          <Card className="border border-gray-100 shadow-sm">
            <CardHeader
              title={
                <div className="flex items-center gap-2">
                  <MapPinned className="h-4 w-4 text-brand-600" />
                  <span>Ubicación Guatemala</span>
                </div>
              }
              subtitle="Tu dirección por defecto para solicitar servicios locales"
            />
            <CardContent className="space-y-4 pt-2">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Departamento"
                  value={departamento}
                  leftIcon={<MapPin className="h-4 w-4 text-brand-600" />}
                />
                <Input
                  label="Municipio"
                  value={municipio}
                  onChange={(e) => setMunicipio(e.target.value)}
                  leftIcon={<MapPin className="h-4 w-4 text-brand-600" />}
                  placeholder="Ciudad de Guatemala, Mixco, Villa Nueva..."
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Zona"
                  value={zona}
                  leftIcon={<MapPin className="h-4 w-4 text-brand-600" />}
                />
                <Input
                  label="Calle / Referencia"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  leftIcon={<MapPin className="h-4 w-4 text-brand-600" />}
                  placeholder="Calle, número, residencial..."
                />
              </div>

              {/* Switch de zona aproximada */}
              <button
                type="button"
                onClick={() => setShowOnlyZone((v) => !v)}
                className="flex w-full items-center justify-between gap-3 rounded-2xl bg-gray-50/80 p-4 border border-gray-100 text-left cursor-pointer"
              >
                <div>
                  <p className="text-xs font-bold text-gray-800">Mostrar solo zona aproximada</p>
                  <p className="mt-0.5 text-[11px] text-gray-500">
                    Oculta tu dirección exacta; los profesionales verán únicamente tu zona
                  </p>
                </div>
                <span
                  className={cn(
                    'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-300',
                    showOnlyZone ? 'bg-brand-600' : 'bg-gray-300',
                  )}
                >
                  <span
                    className={cn(
                      'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-300',
                      showOnlyZone ? 'translate-x-6' : 'translate-x-1',
                    )}
                  />
                </span>
              </button>

              <div className="space-y-2 pt-1">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600">
                  Ubicación aproximada
                </label>
                <JobLocationMap
                  origin={{
                    addressText: showOnlyZone ? `${zona}, ${municipio}` : `${address || 'Dirección de Servicio'}, ${municipio}`,
                    lat: clientLat,
                    lng: clientLng,
                    label: `${showOnlyZone ? zona : address || 'Ubicación aproximada'}, ${municipio}, Guatemala`,
                  }}
                  className="h-52 w-full rounded-2xl"
                />
              </div>
            </CardContent>
          </Card>

          {/* Preferencias */}
          <Card className="border border-gray-100 shadow-sm">
            <CardHeader
              title={
                <div className="flex items-center gap-2">
                  <BellRing className="h-4 w-4 text-brand-600" />
                  <span>Preferencias y notificaciones</span>
                </div>
              }
              subtitle="Elige cómo quieres enterarte de las novedades"
            />
            <CardContent className="space-y-2.5 pt-2">
              {allPreferences.map((pref) => {
                const active = preferences.includes(pref);
                return (
                  <label
                    key={pref}
                    className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-gray-50/50 px-4 py-3 transition-colors hover:border-brand-200 hover:bg-brand-50/30"
                  >
                    <span className="text-xs font-semibold text-gray-700">{pref}</span>
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={() => togglePreference(pref)}
                      className="peer sr-only"
                    />
                    <span
                      className={cn(
                        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-300',
                        active ? 'bg-brand-600' : 'bg-gray-300',
                      )}
                    >
                      <span
                        className={cn(
                          'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-300',
                          active ? 'translate-x-6' : 'translate-x-1',
                        )}
                      />
                    </span>
                  </label>
                );
              })}
            </CardContent>
          </Card>

          {/* Seguridad */}
          <Card className="border border-gray-100 shadow-sm">
            <CardHeader
              title={
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-brand-600" />
                  <span>Seguridad</span>
                </div>
              }
              subtitle="Protege tu cuenta y administra tus sesiones"
            />
            <CardContent className="space-y-2.5 pt-2">
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-2xl border border-gray-100 bg-gray-50/50 p-4 text-left transition-colors hover:border-brand-200 hover:bg-brand-50/30 cursor-pointer"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                  <KeyRound className="h-4 w-4" />
                </span>
                <div className="flex-1">
                  <p className="text-xs font-bold text-gray-800">Cambiar contraseña</p>
                  <p className="mt-0.5 text-[11px] text-gray-500">
                    Recibirás un enlace seguro en tu correo
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-300" />
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-2xl border border-gray-100 bg-gray-50/50 p-4 text-left transition-colors hover:border-brand-200 hover:bg-brand-50/30 cursor-pointer"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                  <MonitorSmartphone className="h-4 w-4" />
                </span>
                <div className="flex-1">
                  <p className="text-xs font-bold text-gray-800">Sesiones activas</p>
                  <p className="mt-0.5 text-[11px] text-gray-500">
                    Revisa los dispositivos donde iniciaste sesión
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-300" />
              </button>
            </CardContent>
          </Card>

          {/* Botones de acción */}
          <div className="flex flex-col-reverse justify-end gap-3 pt-2 sm:flex-row sm:items-center">
            <Button variant="ghost" onClick={() => navigate(-1)} className="rounded-xl">
              Cancelar
            </Button>
            <Button variant="outline" onClick={discard} disabled={!hasChanges} className="rounded-xl">
              <RotateCcw className="mr-1.5 h-4 w-4" />
              Descartar cambios
            </Button>
            <Button
              onClick={handleSave}
              loading={saving}
              disabled={!hasChanges}
              className="rounded-xl bg-brand-600 text-white shadow-md shadow-brand-600/20 hover:bg-brand-700"
            >
              <Save className="mr-1.5 h-4 w-4" />
              Guardar cambios
            </Button>
          </div>
        </div>

        {/* Panel lateral */}
        <div className="space-y-6">
          <div className="rounded-3xl border border-brand-100/70 bg-gradient-to-br from-brand-50/60 to-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white shadow-md shadow-brand-600/25">
                <Sparkles className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-black text-gray-900">Consejos para tu cuenta</h3>
            </div>
            <ol className="mt-4 space-y-3">
              {[
                'Completa tu teléfono: los profesionales te contactarán más rápido.',
                'Activa las notificaciones para no perderte ninguna propuesta.',
                'Muestra solo tu zona si prefieres proteger tu dirección exacta.',
              ].map((tip, index) => (
                <li key={index} className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[10px] font-black text-brand-700">
                    {index + 1}
                  </span>
                  <p className="text-xs leading-relaxed text-gray-600">{tip}</p>
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-3xl border border-brand-100/70 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <HelpCircle className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-black text-gray-900">Centro de ayuda</h3>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-gray-500">
              ¿Dudas sobre cómo funciona PaTodo? Consulta nuestras guías paso a paso o
              escribe al equipo de soporte.
            </p>
            <button
              type="button"
              className="mt-4 flex w-full items-center justify-between rounded-xl border border-brand-200 bg-brand-50/50 px-4 py-3 text-xs font-bold text-brand-700 transition-colors hover:bg-brand-50 cursor-pointer"
            >
              Ir al centro de ayuda
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}