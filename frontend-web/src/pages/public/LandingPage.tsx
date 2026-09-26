import { Link } from 'react-router';
import {
  ArrowRight,
  Wrench,
  Car,
  Zap,
  Hammer,
  FileText,
  Stethoscope,
  Paintbrush,
  Search,
  HandCoins,
  CheckCircle2,
  ShieldCheck,
  Star,
  Users,
  CheckCircle,
  Camera,
  BadgeCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/utils/cn';
import {
  PlumbingIllustration,
  ElectricityIllustration,
  MechanicalIllustration,
} from '@/components/illustrations/ServiceIllustrations';

const categories = [
  { icon: Car, name: 'Mecánica', color: 'bg-brand-100 text-brand-800 border-brand-200' },
  { icon: Wrench, name: 'Plomería', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { icon: Zap, name: 'Electricidad', color: 'bg-teal-100 text-teal-800 border-teal-200' },
  { icon: Hammer, name: 'Carpintería', color: 'bg-lime-100 text-lime-800 border-lime-200' },
  { icon: FileText, name: 'Abogados', color: 'bg-brand-50 text-brand-700 border-brand-100' },
  { icon: Stethoscope, name: 'Salud', color: 'bg-green-100 text-green-800 border-green-200' },
  { icon: Paintbrush, name: 'Pintura', color: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
];

const steps = [
  {
    icon: Search,
    title: 'Publica tu necesidad',
    description: 'Describe el servicio que necesitas y tu presupuesto. Sin compromiso.',
  },
  {
    icon: HandCoins,
    title: 'Recibe ofertas',
    description: 'Los profesionales cercanos te envían su mejor precio. Tú decides.',
  },
  {
    icon: CheckCircle2,
    title: 'Contrata al mejor',
    description: 'Elige la oferta que más te convenga y contacta al profesional al instante.',
  },
];

const testimonials = [
  {
    name: 'María López',
    role: 'Cliente en Ciudad de Guatemala',
    text: 'Publiqué un arreglo de fontanería y en 15 minutos tenía 4 ofertas. Elegí la mejor y quedó perfecto.',
    rating: 5,
  },
  {
    name: 'Carlos Ramírez',
    role: 'Mecánico Profesional',
    text: 'PaTodo me llena la agenda. Los clientes publican lo que necesitan y yo solo oferto lo que me conviene.',
    rating: 5,
  },
  {
    name: 'Ana Martínez',
    role: 'Cliente en Mixco',
    text: 'Increíble, comparé 3 presupuestos para pintar mi casa y ahorré 35%. Ya nunca más busco por otro medio.',
    rating: 5,
  },
];

export function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans antialiased selection:bg-brand-100 selection:text-brand-800 animate-page-in">
    {/* Header con Logo interactivo */}
{/* Header Principal con Logo Ampliado y Branding */}
<header className="sticky top-0 z-50 border-b border-brand-100/60 bg-white/85 backdrop-blur-md shadow-2xs">
  <div className="mx-auto flex h-24 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 py-3">
    <Link to="/" className="flex items-center gap-3.5 transition-transform duration-300 hover:scale-[1.03] select-none">
      <img
        src="/logos1.png"
        alt="PaTodo"
        className="h-20 w-auto max-w-[160px] object-contain mix-blend-multiply"
      />
      <div className="flex flex-col border-l border-brand-200/60 pl-3 justify-center">
        <span className="text-xs font-bold text-brand-700 tracking-wider uppercase leading-none">
          Servicios
        </span>
        <span className="text-[10px] font-medium text-gray-400 tracking-tight leading-none mt-1">
          a domicilio
        </span>
      </div>
    </Link>

          <div className="flex items-center gap-2.5">
            <Link to="/login">
              <Button variant="ghost" size="sm" className="font-bold text-gray-700 hover:text-brand-700 hover:bg-brand-50/60 rounded-xl">
                Iniciar sesión
              </Button>
            </Link>
            <Link to="/registro">
              <Button size="sm" className="rounded-xl bg-brand-600 font-bold hover:bg-brand-700 shadow-md shadow-brand-600/20">
                Crear cuenta
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-brand-950 pt-12 pb-20 lg:pt-20 lg:pb-28">
        {/* Fondo fotográfico con filtro de opacidad verde esmeralda oscuro */}
        <div className="pointer-events-none absolute inset-0">
          <img
            src="/images/hero-home-service.jpg"
            alt="Profesionales a domicilio trabajando"
            loading="eager"
            className="h-full w-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-brand-950/90 via-brand-950/75 to-emerald-950/85" />
          <div className="absolute inset-0 bg-gradient-to-r from-brand-950/60 via-brand-900/30 to-emerald-900/40" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(16,185,129,0.2),transparent_55%)]" />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-brand-950/80 to-transparent" />
        </div>

        <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-xs font-bold text-emerald-100 shadow-2xs backdrop-blur">
                <ShieldCheck className="h-4 w-4 text-emerald-300" />
                <span>Plataforma #1 de Servicios Verificados</span>
              </div>

              <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl leading-[1.15]">
                Para todo lo que <span className="text-emerald-300">necesitas</span>, tu precio, tu profesional
              </h1>

              <p className="mt-5 max-w-xl text-base text-emerald-100/90 sm:text-lg leading-relaxed">
                Publica tu solicitud, recibe ofertas competitivas de especialistas calificados cerca de ti y elige la opción ideal. Sin sorpresas, sin intermediarios.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/registro">
                  <Button size="lg" className="rounded-2xl bg-brand-600 px-6 font-bold shadow-lg shadow-brand-600/25 hover:bg-brand-700 transition-all hover:-translate-y-0.5">
                    Comenzar gratis
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link to="/cliente/crear-trabajo">
                  <Button size="lg" variant="outline" className="rounded-2xl border-gray-200 bg-white font-bold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all hover:-translate-y-0.5 shadow-2xs">
                    Publicar un trabajo
                  </Button>
                </Link>
              </div>

              {/* Stats */}
              <div className="mt-10 grid grid-cols-3 gap-4 border-t border-white/15 pt-8">
                <div>
                  <p className="text-2xl sm:text-3xl font-black text-white">5,000+</p>
                  <p className="text-xs font-semibold text-emerald-200/80 mt-0.5">Profesionales</p>
                </div>
                <div>
                  <p className="text-2xl sm:text-3xl font-black text-white">20k+</p>
                  <p className="text-xs font-semibold text-emerald-200/80 mt-0.5">Trabajos hechos</p>
                </div>
                <div>
                  <div className="flex items-center gap-1">
                    <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
                    <span className="text-2xl sm:text-3xl font-black text-white">4.9</span>
                  </div>
                  <p className="text-xs font-semibold text-emerald-200/80 mt-0.5">Satisfacción</p>
                </div>
              </div>
            </div>

            {/* Visual Hero: Mockup + Chips Flotantes */}
            <div className="relative hidden lg:block">
              {/* Fondo decorativo */}
              <div className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-100/70 blur-2xl" />
              <div className="absolute right-2 top-8 h-44 w-44 rounded-3xl bg-gradient-to-br from-brand-400 to-brand-600 opacity-20 blur-xl" />

              {/* Chip flotante superior */}
              <div className="absolute -left-6 top-8 z-10 flex items-center gap-2.5 rounded-2xl border border-brand-200/70 bg-white/95 px-3.5 py-2.5 shadow-xl shadow-brand-900/10 backdrop-blur animate-float">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
                  <Wrench className="h-4.5 w-4.5" />
                </span>
                <div>
                  <p className="text-[10px] font-bold text-gray-900 leading-tight">Plomería verificada</p>
                  <p className="text-[9px] font-medium text-gray-400">Respuesta en 15 min</p>
                </div>
              </div>

              {/* Chip flotante inferior */}
              <div className="absolute -right-4 bottom-12 z-10 flex items-center gap-2.5 rounded-2xl border border-emerald-200/70 bg-white/95 px-3.5 py-2.5 shadow-xl shadow-brand-900/10 backdrop-blur animate-float-slow">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
                </span>
                <div>
                  <p className="text-[10px] font-bold text-gray-900 leading-tight">Mecánico disponible</p>
                  <p className="text-[9px] font-medium text-gray-400">Aceptando trabajos ahora</p>
                </div>
              </div>

              <div className="relative mx-auto max-w-md rounded-3xl border border-gray-100 bg-white/90 p-6 shadow-2xl backdrop-blur-xl ring-1 ring-black/5">
                <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 font-bold">
                      <Wrench className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">Fontanero urgente</p>
                      <p className="text-[11px] text-gray-400 font-medium">Zona 10 · Hace 5 min</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-emerald-50 border border-emerald-200/60 px-3 py-1 text-[10px] font-extrabold uppercase text-emerald-700">
                    Pendiente
                  </span>
                </div>

                <p className="mt-4 text-xs text-gray-600 leading-relaxed bg-gray-50/80 p-3.5 rounded-2xl border border-gray-100">
                  Tubería rota en cocina, busco un especialista que pueda apoyarme hoy mismo.
                </p>

                <div className="mt-4 flex items-center justify-between rounded-2xl bg-brand-50/50 p-3.5 border border-brand-100/60">
                  <p className="text-xs font-bold text-brand-800">Presupuesto sugerido:</p>
                  <p className="text-lg font-black text-brand-700">Q350.00</p>
                </div>

                <div className="mt-4 space-y-2.5">
                  <div className="flex items-center justify-between rounded-2xl border border-emerald-200/80 bg-emerald-50/60 p-3 shadow-2xs">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-xs font-extrabold text-white shadow-xs">
                        JR
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-900">Juan Rodríguez</p>
                        <div className="flex items-center gap-1">
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                          <span className="text-[10px] font-bold text-gray-500">4.9 (42 reseñas)</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-extrabold text-emerald-700">Q280.00</p>
                      <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-600">Mejor oferta</span>
                    </div>
                  </div>

                  <button type="button" className="w-full rounded-2xl bg-brand-600 py-3 text-xs font-bold text-white shadow-md shadow-brand-600/20 hover:bg-brand-700 transition-colors cursor-pointer">
                    Aceptar oferta de Juan
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Categorías */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
            ¿Qué servicio necesitas hoy?
          </h2>
          <p className="mt-2 text-sm text-gray-500">
            Explora las diferentes categorías con profesionales preparados para ayudarte.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-3.5 sm:grid-cols-4 lg:grid-cols-7">
          {categories.map(({ icon: Icon, name, color }) => (
            <Link
              key={name}
              to="/registro"
              className="group relative flex flex-col items-center gap-3 overflow-hidden rounded-2xl border border-gray-100 bg-white p-4 text-center transition-all duration-300 hover:-translate-y-2 hover:border-brand-300 hover:shadow-xl hover:shadow-brand-200/60 hover:ring-2 hover:ring-brand-200/80 active:scale-95 shadow-2xs"
            >
              <div className={cn('flex h-12 w-12 items-center justify-center rounded-2xl border transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6 group-hover:shadow-md', color)}>
                <Icon className="h-6 w-6" />
              </div>
              <p className="text-xs font-bold text-gray-800 transition-colors group-hover:text-brand-700">{name}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Servicios Destacados: Espacios Fotográficos */}
      <section className="relative overflow-hidden bg-gradient-to-b from-white via-emerald-50/50 to-white py-16 border-y border-brand-100/40">
        <div className="pointer-events-none absolute -right-24 top-10 h-72 w-72 rounded-full bg-brand-200/20 blur-3xl" />
        <div className="pointer-events-none absolute -left-20 bottom-0 h-72 w-72 rounded-full bg-emerald-200/20 blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto">
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-200/80 bg-brand-50/80 px-3.5 py-1.5 text-xs font-bold text-brand-700 shadow-sm">
              <BadgeCheck className="h-4 w-4 text-brand-600" />
              Profesionales verificados
            </span>
            <h2 className="mt-4 text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
              Especialistas a domicilio para lo que necesites
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              Plomería, electricidad y mecánica con profesionales verificados, listos para cotizar tu trabajo.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              {
                illustration: <PlumbingIllustration className="h-40 w-full sm:h-48" />,
                photo: '/images/plomeria.jpg',
                title: 'Plomería',
                items: ['Tuberías y fugas', 'Desagües', 'Instalaciones'],
              },
              {
                illustration: <ElectricityIllustration className="h-40 w-full sm:h-48" />,
                photo: '/images/electricidad.jpg',
                title: 'Electricidad',
                items: ['Cortos y fallas', 'Instalaciones', 'Iluminación'],
              },
              {
                illustration: <MechanicalIllustration className="h-40 w-full sm:h-48" />,
                photo: '/images/mecanica.jpg',
                title: 'Mecánica',
                items: ['Mantenimiento', 'Reparaciones', 'Diagnóstico'],
              },
            ].map(({ illustration, photo, title, items }) => (
              <div
                key={title}
                className="group relative overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-brand-200 hover:shadow-xl hover:shadow-brand-200/60 hover:ring-2 hover:ring-brand-100/70"
              >
                <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-brand-50 opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100" />

                {/* Espacio fotográfico */}
                <div className="relative overflow-hidden rounded-t-3xl bg-gradient-to-b from-brand-50/80 to-emerald-50/50 p-4 transition-transform duration-300 group-hover:scale-[1.02]">
                  <span className="absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-full border border-brand-200/60 bg-white/95 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-brand-700 shadow-sm backdrop-blur">
                    <Camera className="h-3 w-3" />
                    Foto de referencia
                  </span>
                  <span className="absolute left-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-emerald-600/95 px-2.5 py-1 text-[9px] font-bold text-white shadow-sm">
                    <BadgeCheck className="h-3 w-3" />
                    Verificado
                  </span>
                  {illustration}
                  <img
                    src={photo}
                    alt={title}
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                    className="absolute inset-0 z-[1] h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </div>

                <div className="relative space-y-3 p-5 pt-4">
                  <h3 className="text-lg font-bold text-gray-900 transition-colors group-hover:text-brand-700">
                    {title}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {items.map((item) => (
                      <span
                        key={item}
                        className="rounded-lg bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-700 border border-brand-100/70"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Cómo Funciona */}
      <section className="bg-gray-50/60 py-16 border-y border-gray-100">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">Paso a paso con PaTodo</h2>
            <p className="mt-2 text-sm text-gray-500">
              Un proceso ágil diseñado para darte el control total de tus contrataciones.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {steps.map(({ icon: Icon, title, description }, index) => (
              <div key={title} className="relative rounded-2xl border border-gray-100 bg-white p-6 shadow-2xs">
                <span className="absolute right-5 top-4 text-4xl font-black text-gray-100 select-none">
                  0{index + 1}
                </span>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 border border-brand-100/60">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-base font-bold text-gray-900">{title}</h3>
                <p className="mt-2 text-xs text-gray-500 leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonios */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center max-w-xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight"> Experiencias reales</h2>
          <p className="mt-2 text-sm text-gray-500">Esto es lo que opinan los miembros de nuestra comunidad.</p>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {testimonials.map(({ name, role, text, rating }) => (
            <div key={name} className="flex flex-col justify-between rounded-2xl border border-gray-100 bg-white p-6 shadow-2xs">
              <div>
                <div className="flex gap-1">
                  {Array.from({ length: rating }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="mt-4 text-xs text-gray-600 leading-relaxed italic">"{text}"</p>
              </div>

              <div className="mt-6 flex items-center gap-3 pt-4 border-t border-gray-100">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                  {name.split(' ').map((n) => n[0]).join('')}
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-900">{name}</p>
                  <p className="text-[10px] font-medium text-gray-400">{role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Final */}
      <section className="bg-gradient-to-r from-brand-600 to-brand-700 py-16 text-white">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            ¿Listo para simplificar tus solicitudes?
          </h2>
          <p className="mt-2 text-sm text-brand-100 max-w-md mx-auto">
            Forma parte de la red de servicios más transparente e interactiva.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/registro">
              <Button size="lg" className="rounded-2xl bg-white text-brand-700 font-bold hover:bg-brand-50 shadow-lg">
                <Users className="mr-2 h-4 w-4" />
                Quiero contratar
              </Button>
            </Link>
            <Link to="/registro">
              <Button size="lg" variant="outline" className="rounded-2xl border-white/40 bg-transparent text-white font-bold hover:bg-white/10">
                <CheckCircle className="mr-2 h-4 w-4" />
                Ofrecer mis servicios
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 bg-white py-8">
  <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-4 sm:flex-row sm:px-6 lg:px-8">
    
    {/* Branding Identico con Logo Ampliado */}
    <div className="flex items-center gap-3.5 transition-transform duration-300 hover:scale-[1.03] cursor-default select-none">
      <img
        src="/logos1.png"
        alt="PaTodo"
        className="h-16 w-auto max-w-[140px] object-contain mix-blend-multiply"
      />
    
    </div>

          <p className="text-xs text-gray-400">
            © {new Date().getFullYear()} PaTodo. Todos los derechos reservados.
          </p>

          <div className="flex items-center gap-4 text-xs font-medium text-gray-500">
            <a href="#" className="hover:text-brand-600 transition-colors">Términos</a>
            <a href="#" className="hover:text-brand-600 transition-colors">Privacidad</a>
            <a href="#" className="hover:text-brand-600 transition-colors">Soporte</a>
          </div>
        </div>
      </footer>
    </div>
  );
}