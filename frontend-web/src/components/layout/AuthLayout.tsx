import type { ReactNode } from 'react';
import { Link, Outlet, useLocation } from 'react-router';
import { ShieldCheck, Star, Users, CheckCircle2 } from 'lucide-react';
import { cn } from '@/utils/cn';

interface AuthLayoutProps {
  children?: ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  const location = useLocation();
  const isRegister = location.pathname.includes('/registro');

  return (
    <div className="relative flex min-h-screen w-full overflow-hidden bg-slate-100/70 font-sans antialiased">
      {/*BRANDING*/}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-600 via-brand-700 to-emerald-950 p-10 text-white lg:flex border-r border-brand-500/20">
        
        {/* Fotografía de fondo de servicios a domicilio */}
        <img
          src="/images/auth-bg.jpg"
          alt="Servicios profesionales a domicilio"
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
        {/* Capa semitransparente verde esmeralda oscuro para resaltar texto y logo */}
        <div className="absolute inset-0 bg-gradient-to-br from-brand-950/75 via-brand-900/70 to-emerald-950/80" />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-950/70 via-transparent to-brand-950/40" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(16,185,129,0.18),transparent_55%)]" />

        {/* Efectos dinámicos de luz en el fondo */}
        <div className="absolute top-1/4 -left-12 h-72 w-72 rounded-full bg-emerald-400/20 blur-3xl pointer-events-none animate-pulse" />
        <div className="absolute bottom-1/4 right-0 h-72 w-72 rounded-full bg-brand-400/20 blur-3xl pointer-events-none animate-pulse" />

        {/* CONTENEDOR SUPERIOR: LOGO Y BADGE A LA PAR */}
        <div className="relative z-10 flex items-center justify-between gap-4">
          <Link to="/" className="group inline-block shrink-0">
            <img
              src="/log.png"
              alt="PaTodo"
              className="h-28 sm:h-32 md:h-36 w-auto max-w-none object-contain mix-blend-multiply transition-transform duration-300 group-hover:scale-105"
            />
          </Link>

          {/* Badge Informativo al lado del logo */}
          <div className="inline-flex items-center gap-2 rounded-2xl border border-emerald-300/30 bg-white/10 px-4 py-2 text-xs font-bold backdrop-blur-md text-emerald-100 shadow-md">
            <ShieldCheck className="h-4 w-4 text-emerald-300 shrink-0" />
            <span>{isRegister ? 'Comunidad Verificada' : 'Plataforma #1 de Servicios'}</span>
          </div>
        </div>

        {/* MENSAJE PRINCIPAL Y BENEFICIOS (Subido más arriba) */}
        <div className="relative z-10 my-auto space-y-5 max-w-lg transition-all duration-500">
          <h2 className="text-3xl sm:text-4xl font-extrabold leading-tight tracking-tight text-white">
            {isRegister
              ? 'Únete a miles de usuarios y resuelve todo en un solo lugar.'
              : 'Para todo lo que necesitas, al precio que tú eliges.'}
          </h2>

          <p className="text-sm text-brand-100/90 leading-relaxed">
            {isRegister
              ? 'Crea tu cuenta de forma transparente como cliente o profesional para comenzar a publicar o recibir ofertas.'
              : 'Publica tus requerimientos, recibe cotizaciones de especialistas calificados cerca de ti y contrata con seguridad.'}
          </p>

          {/* Puntos destacados clave a la par / en grid */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="flex items-center gap-2 text-xs font-medium text-emerald-100 bg-white/5 p-2.5 rounded-xl border border-white/10">
              <CheckCircle2 className="h-4 w-4 text-emerald-300 shrink-0" />
              <span>Cotizaciones rápidas</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-medium text-emerald-100 bg-white/5 p-2.5 rounded-xl border border-white/10">
              <Users className="h-4 w-4 text-emerald-300 shrink-0" />
              <span>Expertos verificados</span>
            </div>
          </div>

          {/* Tarjeta de Reseña Flotante */}
          <div className="rounded-3xl border border-white/20 bg-white/10 p-4.5 backdrop-blur-md shadow-2xl transition-all duration-300 hover:bg-white/15">
            <div className="flex items-center gap-1 text-amber-300 mb-1.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="h-3.5 w-3.5 fill-amber-300" />
              ))}
            </div>
            <p className="text-xs italic text-white/95 leading-relaxed">
              "{isRegister 
                ? 'Registrarme tomó menos de 2 minutos. La verificación fue muy rápida y segura.'
                : 'Encontré a un fontanero en menos de 15 minutos. El proceso de cotización fue impecable.'}"
            </p>
            <p className="mt-2 text-[11px] font-bold text-emerald-200">
              — {isRegister ? 'Sofía M., Profesional Verificada' : 'Carlos R., Cliente Verificado'}
            </p>
          </div>
        </div>

        {/* Footer del Panel */}
        <div className="relative z-10 flex items-center justify-between text-xs text-brand-200/80">
          <p>© {new Date().getFullYear()} PaTodo. Todos los derechos reservados.</p>
          <div className="flex gap-4">
            <Link to="/" className="hover:text-white transition-colors">Inicio</Link>
            <a href="#" className="hover:text-white transition-colors">Términos</a>
          </div>
        </div>
      </div>

     
      <div className="flex w-full flex-col justify-between overflow-y-auto bg-stone-50/70 p-6 sm:p-12 lg:w-1/2 [perspective:1000px]">
        
        {/* Contenedor con efecto de rotación 3D en el eje Y */}
        <div
          className={cn(
            'mx-auto my-auto w-full max-w-md transition-all duration-700 [transform-style:preserve-3d]',
            isRegister ? '[transform:rotateY(360deg)]' : '[transform:rotateY(0deg)]'
          )}
        >
          {/* Tarjeta con tono blanco marfil y sombras 3D */}
          <div className="rounded-3xl border border-stone-200/80 bg-stone-50/90 p-8 sm:p-10 shadow-xl shadow-stone-300/40 backdrop-blur-xl animate-page-in">
            {children || <Outlet />}
          </div>
        </div>
        
      </div>
    </div>
  );
}