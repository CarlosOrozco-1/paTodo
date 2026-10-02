import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router';
import {
  ArrowRight,
  CheckCircle2,
  Mail,
  Phone,
  Sparkles,
  UserRound,
  Users,
  Wrench,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/uiStore';
import { getErrorMessage } from '@/api/axiosClient';
import { isValidPhone } from '@/utils/contact';
import { homeRouteFor } from '@/utils/roles';
import { cn } from '@/utils/cn';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { AuthLayout } from '@/components/layout/AuthLayout';
import type { GoogleProfileDraft } from '@/api/auth.service';
import type { RegisterRole } from '@/types/user.types';

type Role = RegisterRole;

const DRAFT_KEY = 'paTodo_google_draft';

const ROLE_OPTIONS: {
  value: Role;
  label: string;
  hint: string;
  icon: typeof UserRound;
  iconClass: string;
}[] = [
  {
    value: 'client',
    label: 'Cliente',
    hint: 'Publico trabajos y contrato profesionales',
    icon: UserRound,
    iconClass: 'bg-blue-50 text-blue-600',
  },
  {
    value: 'worker',
    label: 'Profesional',
    hint: 'Recibo trabajos y hago ofertas',
    icon: Wrench,
    iconClass: 'bg-purple-50 text-purple-600',
  },
  {
    value: 'both',
    label: 'Ambos',
    hint: 'Hago las dos cosas, con un solo panel',
    icon: Users,
    iconClass: 'bg-brand-50 text-brand-700',
  },
];

function readStoredDraft(): GoogleProfileDraft | null {
  const raw = sessionStorage.getItem(DRAFT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as GoogleProfileDraft;
  } catch {
    return null;
  }
}

export function CompleteGoogleProfile() {
  const { isAuthenticated, completeGoogleProfile, isLoading } = useAuthStore();
  const navigate = useNavigate();

  const [stored] = useState<GoogleProfileDraft | null>(readStoredDraft);
  const [role, setRole] = useState<Role>('client');
  const [form, setForm] = useState({
    firstName: stored?.firstName ?? '',
    lastName: stored?.lastName ?? '',
    email: stored?.email ?? '',
    phone: stored?.phone ?? '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Si no hay sesión ni borrador, este montaje no tiene nada que completar:
  // el guard de abajo manda a /login.
  useEffect(() => {
    if (!isAuthenticated && !stored) {
      navigate('/login', { replace: true });
    }
  }, [isAuthenticated, stored, navigate]);

  // El email viene de Google y es la identidad de la cuenta: se muestra, no
  // se edita. Cambiarlo haría que /createUser lo rechace.
  const emailLocked = Boolean(stored?.email);

  if (!isAuthenticated && !stored) {
    return <Navigate to="/login" replace />;
  }

  const set = (field: 'firstName' | 'lastName' | 'phone', value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const validate = (): boolean => {
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

    if (!form.phone.trim()) {
      next.phone = 'El teléfono es obligatorio';
    } else if (!isValidPhone(form.phone)) {
      next.phone = 'Revisa el número: 8 dígitos, o con prefijo +502';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate() || !stored) return;

    try {
      const response = await completeGoogleProfile({
        ...stored,
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone,
        role,
      });
      sessionStorage.removeItem(DRAFT_KEY);
      toast('success', '¡Cuenta lista! Ya puedes usar PaTodo');
      navigate(homeRouteFor(response.user.role), { replace: true });
    } catch (error) {
      toast('error', getErrorMessage(error));
    }
  };

  const activeRole = ROLE_OPTIONS.find((o) => o.value === role) ?? ROLE_OPTIONS[0];

  return (
    <AuthLayout>
      <div className="w-full">
        <div className="mb-6 text-center sm:text-left">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-500 via-brand-600 to-teal-400 text-white shadow-lg shadow-emerald-600/30 lg:hidden">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
            Completa tu cuenta
          </h1>
          <p className="mt-1.5 text-xs font-medium text-gray-500">
            Ya iniciamos sesión con Google. Revisa tus datos y elige cómo vas a usar PaTodo.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Nombre"
              value={form.firstName}
              onChange={(e) => set('firstName', e.target.value)}
              error={errors.firstName}
              autoComplete="given-name"
            />
            <Input
              label="Apellido"
              value={form.lastName}
              onChange={(e) => set('lastName', e.target.value)}
              error={errors.lastName}
              autoComplete="family-name"
            />
          </div>

          <Input
            label="Email"
            type="email"
            value={form.email}
            leftIcon={<Mail className="h-4 w-4 text-gray-400" />}
            readOnly={emailLocked}
            hint={emailLocked ? 'Viene de tu cuenta de Google y no se puede cambiar' : undefined}
            className={emailLocked ? 'cursor-not-allowed bg-gray-50' : undefined}
            autoComplete="email"
          />

          <Input
            label="Teléfono"
            type="tel"
            inputMode="tel"
            placeholder="5555 1234  o  +502 5555 1234"
            value={form.phone}
            onChange={(e) => set('phone', e.target.value)}
            error={errors.phone}
            leftIcon={<Phone className="h-4 w-4 text-gray-400" />}
            autoComplete="tel"
          />

          <div>
            <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-gray-400">
              ¿Cómo vas a usar PaTodo?
            </label>
            <div className="grid gap-2 p-1.5 rounded-2xl border border-gray-200 bg-gray-50 sm:grid-cols-3">
              {ROLE_OPTIONS.map((option) => {
                const Icon = option.icon;
                const isActive = role === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setRole(option.value)}
                    className={cn(
                      'flex flex-col items-center gap-1.5 rounded-xl px-2 py-3 text-center transition-all cursor-pointer',
                      isActive
                        ? 'bg-white shadow-sm ring-1 ring-brand-200'
                        : 'hover:bg-white/60',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-lg',
                        option.iconClass,
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span
                      className={cn(
                        'text-xs font-bold',
                        isActive ? 'text-brand-700' : 'text-gray-600',
                      )}
                    >
                      {option.label}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-gray-500">
              {activeRole.hint}
              {role === 'both' &&
                ' Podrás cambiar de panel cuando quieras desde el menú lateral.'}
            </p>
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              fullWidth
              size="lg"
              loading={isLoading}
              className="rounded-xl font-bold bg-brand-600 hover:bg-brand-700 shadow-md shadow-brand-600/20"
            >
              Completar cuenta
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </div>
        </form>

        <div className="mt-5 flex items-start gap-2.5 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-3">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          <p className="text-xs leading-relaxed text-emerald-900">
            Tu teléfono solo se comparte con el profesional cuando acepte un trabajo tuyo.
          </p>
        </div>
      </div>
    </AuthLayout>
  );
}
