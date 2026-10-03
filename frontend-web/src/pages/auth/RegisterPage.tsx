import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  Briefcase,
  LockKeyhole,
  Mail,
  Phone,
  User,
  UserRound,
  Wrench,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Sparkles,
} from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/uiStore';
import { getErrorMessage } from '@/api/axiosClient';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/utils/cn';
import { homeRouteFor } from '@/utils/roles';

type Role = 'client' | 'worker' | 'both';

interface FormState {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
}

const initialForm: FormState = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
};

export function RegisterPage() {
  const [step, setStep] = useState<1 | 2>(1);
  const [role, setRole] = useState<Role>('client');
  const [form, setForm] = useState<FormState>(initialForm);
  const [showPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const { register, loginWithGoogle, isLoading } = useAuthStore();
  const navigate = useNavigate();

  const set = (field: keyof FormState, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const validateStep1 = (): boolean => {
    const next: Record<string, string> = {};
    const nameRegex = /^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]+$/;

    if (!form.firstName.trim()) {
      next.firstName = 'Requerido';
    } else if (!nameRegex.test(form.firstName)) {
      next.firstName = 'Solo se permiten letras';
    }

    if (!form.lastName.trim()) {
      next.lastName = 'Requerido';
    } else if (!nameRegex.test(form.lastName)) {
      next.lastName = 'Solo se permiten letras';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const validateStep2 = (): boolean => {
    const next: Record<string, string> = {};
    const phoneRegex = /^\d{8}$/;

    if (!form.email.trim()) {
      next.email = 'El email es obligatorio';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      next.email = 'Email inválido';
    }

    if (!form.phone.trim()) {
      next.phone = 'El teléfono es obligatorio';
    } else if (!phoneRegex.test(form.phone)) {
      next.phone = 'Debe ser de 8 números';
    }

    if (form.password.length < 8) {
      next.password = 'Mínimo 8 caracteres';
    }

    if (form.password !== form.confirmPassword) {
      next.confirmPassword = 'Las contraseñas no coinciden';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleNextStep = (e: React.MouseEvent) => {
    e.preventDefault();
    if (validateStep1()) {
      setStep(2);
      setErrors({});
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validateStep2()) return;
    try {
      await register({
        email: form.email,
        password: form.password,
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone,
        role,
      });
      toast('success', '¡Cuenta creada correctamente!');
      navigate(homeRouteFor(role), { replace: true });
    } catch (error) {
      toast('error', getErrorMessage(error));
    }
  };

  const handleGoogleSuccess = async (credentialResponse: any) => {
    try {
      if (!credentialResponse?.credential) {
        toast('error', 'No se recibieron las credenciales de Google');
        return;
      }
      const result = await loginWithGoogle(credentialResponse.credential);
      if (result.needsProfile) {
        // La cuenta es nueva: se guarda lo que trae Google y se pide confirmar
        // el resto. El rol se elige ahí, no antes de saber qué hará el usuario.
        sessionStorage.setItem('paTodo_google_draft', JSON.stringify(result.draft));
        navigate('/completar-perfil', { replace: true });
        return;
      }
      toast('success', '¡Sesión iniciada con Google!');
      navigate(homeRouteFor(result.user.role), { replace: true });
    } catch (error) {
      toast('error', getErrorMessage(error));
    }
  };

  const hasMinLength = form.password.length >= 8;
  const hasMatch = form.password.length > 0 && form.password === form.confirmPassword;

  return (
    <div className="w-full">
      {/* Cabecera */}
      <div className="mb-6 text-center sm:text-left">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-500 via-brand-600 to-teal-400 text-white shadow-lg shadow-emerald-600/30 border border-emerald-400/40 lg:hidden mb-4 mx-auto sm:mx-0">
          <Sparkles className="h-6 w-6 text-white" />
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">Crear cuenta</h1>
        <p className="mt-1.5 text-xs font-medium text-gray-500">
          Únete a PaTodo y resuelve tus necesidades
        </p>

        {/* Indicador de pasos visual */}
        <div className="flex items-center gap-2 mt-4">
          <div className={cn('h-1.5 flex-1 rounded-full transition-colors', step >= 1 ? 'bg-brand-600' : 'bg-gray-200')} />
          <div className={cn('h-1.5 flex-1 rounded-full transition-colors', step === 2 ? 'bg-brand-600' : 'bg-gray-200')} />
          <span className="text-[11px] font-bold text-gray-400 shrink-0">Paso {step} de 2</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* ================= PASO 1 ================= */}
        {step === 1 && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">
                ¿Cómo deseas registrarte?
              </label>
              <div className="grid grid-cols-3 gap-2 p-1.5 bg-gray-50 rounded-2xl border border-gray-200">
                <button
                  type="button"
                  onClick={() => setRole('client')}
                  className={cn(
                    'flex items-center justify-center gap-2 py-2.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer',
                    role === 'client'
                      ? 'bg-white text-brand-700 shadow-sm border border-gray-100'
                      : 'text-gray-500 hover:text-gray-900'
                  )}
                >
                  <UserRound className="h-4 w-4 shrink-0" />
                  Cliente
                </button>
                <button
                  type="button"
                  onClick={() => setRole('worker')}
                  className={cn(
                    'flex items-center justify-center gap-2 py-2.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer',
                    role === 'worker'
                      ? 'bg-white text-brand-700 shadow-sm border border-gray-100'
                      : 'text-gray-500 hover:text-gray-900'
                  )}
                >
                  <Wrench className="h-4 w-4 shrink-0" />
                  Profesional
                </button>
                <button
                  type="button"
                  onClick={() => setRole('both')}
                  className={cn(
                    'flex items-center justify-center gap-2 py-2.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer',
                    role === 'both'
                      ? 'bg-white text-brand-700 shadow-sm border border-gray-100'
                      : 'text-gray-500 hover:text-gray-900'
                  )}
                >
                  <Sparkles className="h-4 w-4 shrink-0" />
                  Ambos
                </button>
              </div>
              {role === 'both' && (
                <p className="mt-2 text-[11px] text-gray-500 leading-relaxed">
                  Podrás publicar trabajos y hacer ofertas. Cambia de panel cuando quieras desde el menú lateral.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Nombre"
                placeholder="Ana"
                value={form.firstName}
                onChange={(e) => set('firstName', e.target.value)}
                error={errors.firstName}
                leftIcon={<User className="h-4 w-4 text-gray-400" />}
              />
              <Input
                label="Apellido"
                placeholder="García"
                value={form.lastName}
                onChange={(e) => set('lastName', e.target.value)}
                error={errors.lastName}
                leftIcon={<User className="h-4 w-4 text-gray-400" />}
              />
            </div>

            <div className="pt-2">
              <Button type="button" onClick={handleNextStep} fullWidth size="lg" className="rounded-xl font-bold bg-brand-600 hover:bg-brand-700 shadow-md shadow-brand-600/20">
                Continuar <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ================= PASO 2 ================= */}
        {step === 2 && (
          <div className="space-y-3.5 animate-in fade-in duration-300">
            <Input
              label="Email"
              type="email"
              placeholder="tucorreo@ejemplo.com"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              error={errors.email}
              leftIcon={<Mail className="h-4 w-4 text-gray-400" />}
              autoComplete="email"
            />

            <Input
              label="Teléfono (8 dígitos)"
              type="tel"
              maxLength={8}
              placeholder="55551234"
              value={form.phone}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 8);
                set('phone', val);
              }}
              error={errors.phone}
              leftIcon={<Phone className="h-4 w-4 text-gray-400" />}
            />

            <Input
              label="Contraseña"
              type={showPassword ? 'text' : 'password'}
              placeholder="Mínimo 8 caracteres"
              value={form.password}
              onChange={(e) => set('password', e.target.value)}
              error={errors.password}
              leftIcon={<LockKeyhole className="h-4 w-4 text-gray-400" />}
              autoComplete="new-password"
            />

            <Input
              label="Confirmar contraseña"
              type={showPassword ? 'text' : 'password'}
              placeholder="Repite la contraseña"
              value={form.confirmPassword}
              onChange={(e) => set('confirmPassword', e.target.value)}
              error={errors.confirmPassword}
              leftIcon={<LockKeyhole className="h-4 w-4 text-gray-400" />}
            />

            {/* Checklist Requisitos */}
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 space-y-1.5 text-xs">
              <div className="flex items-center gap-2">
                {hasMinLength ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-gray-300" />}
                <span className={hasMinLength ? 'text-emerald-700 font-medium' : 'text-gray-500'}>Mínimo 8 caracteres</span>
              </div>
              <div className="flex items-center gap-2">
                {hasMatch ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-gray-300" />}
                <span className={hasMatch ? 'text-emerald-700 font-medium' : 'text-gray-500'}>Las contraseñas coinciden</span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setStep(1)} size="lg">
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <Button type="submit" fullWidth size="lg" className="rounded-xl font-bold bg-brand-600 hover:bg-brand-700 shadow-md shadow-brand-600/20" loading={isLoading}>
                Crear cuenta
              </Button>
            </div>

            <div className="flex justify-center pt-1">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => toast('error', 'Error al registrarse con Google')}
                theme="outline"
                size="large"
                text="signup_with"
                width="320"
              />
            </div>

            <p className="text-center text-[11px] text-gray-400 pt-1">
              {role === 'worker' || role === 'both' ? (
                <span className="inline-flex items-center gap-1.5 text-brand-700 bg-brand-50 px-2.5 py-1 rounded-lg">
                  <Briefcase className="h-3.5 w-3.5 shrink-0" />
                  Tu perfil de profesional será revisado por el equipo de PaTodo
                </span>
              ) : (
                'Al registrarte aceptas los términos y condiciones de PaTodo'
              )}
            </p>
          </div>
        )}
      </form>

      <div className="mt-6 border-t border-gray-100 pt-4 text-center">
        <p className="text-xs font-medium text-gray-500">
          ¿Ya tienes una cuenta?{' '}
          <Link
            to="/login"
            className="font-bold text-brand-600 hover:text-brand-700 transition-colors"
          >
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  );
}