import { useState, useEffect, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';
import { FlaskConical, LockKeyhole, Mail, ArrowRight, CheckCircle2 } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/uiStore';
import { getErrorMessage } from '@/api/axiosClient';
import { realAuth } from '@/api/real/real-auth';
import { isDemoMode } from '@/api/demo';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Logo } from '@/components/logo/logo';
import { homeRouteFor } from '@/utils/roles';
import type { UserRole } from '@/types/user.types';

const DEMO_USERS = [
  {
    label: 'Cliente',
    email: 'carlos@example.com',
    description: 'Cliente',
    iconBg: 'bg-blue-50 text-blue-600 border border-blue-100',
  },
  {
    label: 'Profesional',
    email: 'juan@example.com',
    description: 'Plomería',
    iconBg: 'bg-purple-50 text-purple-600 border border-purple-100',
  },
  {
    label: 'Admin',
    email: 'admin@patodo.com',
    description: 'Admin',
    iconBg: 'bg-emerald-50 text-emerald-600 border border-emerald-100',
  },
];

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [recoveryStep, setRecoveryStep] = useState<1 | 3>(1);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const authStore = useAuthStore();
  const { login, loginWithGoogle, isLoading } = authStore;
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';
  const demoEnabled = isDemoMode();

  useEffect(() => {
    const mode = searchParams.get('mode');
    const code = searchParams.get('oobCode');

    if (mode === 'resetPassword' && code) {
      setShowForgotPassword(true);
      setRecoveryStep(3);
      setResetCode(code);
    }
  }, [searchParams]);

  const redirectUser = (role: string) => {
    const target =
      from !== '/' && from !== '/login' && from !== '/registro'
        ? from
        : homeRouteFor(role as UserRole);
    navigate(target, { replace: true });
  };

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!email.trim()) next.email = 'El email es obligatorio';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      next.email = 'Email inválido';
    if (!password) next.password = 'La contraseña es obligatoria';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const doLogin = async (emailValue: string, passwordValue: string) => {
    try {
      await login(emailValue, passwordValue);
      const { user } = useAuthStore.getState();
      if (user) redirectUser(user.role);
    } catch (error) {
      toast('error', getErrorMessage(error));
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    await doLogin(email, password);
  };

  const handleDemoLogin = async (emailValue: string) => {
    await doLogin(emailValue, 'demo');
  };

  const handleGoogleSuccess = async (credentialResponse: any) => {
    try {
      if (!credentialResponse?.credential) {
        toast('error', 'No se recibieron las credenciales de Google');
        return;
      }

      const result = await loginWithGoogle(credentialResponse.credential);

      if (result.needsProfile) {
        sessionStorage.setItem('paTodo_google_draft', JSON.stringify(result.draft));
        navigate('/completar-perfil', { replace: true });
        return;
      }

      toast('success', 'Sesión iniciada con Google');
      redirectUser(result.user.role);
    } catch (error) {
      toast('error', getErrorMessage(error));
    }
  };

  // --- Recuperación de Contraseña Modificada con Verificación en Firestore ---
  const handleSendResetEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = recoveryEmail.trim();
    if (!trimmedEmail) {
      toast('error', 'Ingresa tu correo electrónico');
      return;
    }
    
    try {
      // Si el correo sí existe, procedemos a enviar el enlace con Firebase Auth
      await realAuth.forgotPassword(trimmedEmail);
      toast('success', '¡Listo! Si tienes una cuenta con nosotros, te enviamos un correo para recuperar tu contraseña.');
      setShowForgotPassword(false);
      setRecoveryEmail('');
    } catch (error: any) {
      toast('error', error.message || 'Error al procesar la solicitud');
    }
  };

  const handleFinishReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast('error', 'La contraseña debe tener al menos 8 caracteres');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      toast('error', 'Las contraseñas no coinciden');
      return;
    }

    try {
      await realAuth.resetPassword(resetCode.trim(), newPassword);
      
      toast('success', '¡Contraseña actualizada con éxito! Ya puedes iniciar sesión.');
      setShowForgotPassword(false);
      setRecoveryStep(1);
      setResetCode('');
      setNewPassword('');
      setConfirmNewPassword('');
      navigate('/login', { replace: true });
    } catch (error: any) {
      toast('error', error.message || 'El enlace es inválido o ha expirado.');
    }
  };

  return (
    <div className="w-full">
      <div className="mb-6 text-center sm:text-left">
        <div className="lg:hidden flex justify-center sm:justify-start mb-6">
          <Logo variant="default" imgClassName="h-14" />
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">Bienvenido de nuevo</h1>
        <p className="mt-1.5 text-xs font-medium text-gray-500">
          Ingresa tus credenciales para acceder a tu cuenta
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Email"
          type="email"
          placeholder="tucorreo@ejemplo.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
          leftIcon={<Mail className="h-4 w-4 text-gray-400" />}
          autoComplete="email"
        />

        <div className="relative">
          <Input
            label="Contraseña"
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            leftIcon={<LockKeyhole className="h-4 w-4 text-gray-400" />}
            autoComplete="current-password"
          />
        </div>

        <div className="flex items-center justify-between pt-0.5">
          <label className="flex items-center gap-2 text-xs font-medium text-gray-600 cursor-pointer select-none">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 transition-colors"
            />
            Recordarme
          </label>
          <button
            type="button"
            onClick={() => {
              setRecoveryStep(1);
              setShowForgotPassword(true);
            }}
            className="text-xs font-bold text-brand-600 hover:text-brand-700 transition-colors bg-transparent border-none cursor-pointer p-0"
          >
            ¿Olvidaste tu contraseña?
          </button>
        </div>

        <div className="pt-2">
          <Button type="submit" fullWidth size="lg" className="rounded-xl font-bold bg-brand-600 hover:bg-brand-700 shadow-md shadow-brand-600/20" loading={isLoading}>
            Iniciar sesión
          </Button>
        </div>
      </form>

      <div className="flex justify-center pt-3">
        <GoogleLogin
          onSuccess={handleGoogleSuccess}
          onError={() => toast('error', 'Error al iniciar sesión con Google')}
          theme="outline"
          size="large"
          text="continue_with"
          width="320"
        />
      </div>

      {demoEnabled && (
        <div className="mt-5 rounded-2xl border border-amber-200/70 bg-gradient-to-b from-amber-50/60 to-amber-50/20 p-3 shadow-2xs">
          <div className="flex items-center gap-1.5 mb-2">
            <FlaskConical className="h-3.5 w-3.5 text-amber-600" />
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-amber-900">
              Acceso rápido (Modo Demo)
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {DEMO_USERS.map((demo) => (
              <button
                key={demo.email}
                type="button"
                onClick={() => handleDemoLogin(demo.email)}
                disabled={isLoading}
                className="group flex flex-col items-center text-center rounded-xl border border-amber-200/60 bg-white p-2 transition-all duration-200 hover:border-brand-400 hover:shadow-xs hover:bg-brand-50/30 cursor-pointer disabled:opacity-50"
              >
                <span className={`flex h-6 w-6 items-center justify-center rounded-lg text-xs font-black mb-1 ${demo.iconBg}`}>
                  {demo.label.charAt(0)}
                </span>
                <span className="text-xs font-bold text-gray-800 group-hover:text-brand-700 transition-colors leading-tight">
                  {demo.label}
                </span>
                <span className="text-[10px] text-gray-400 truncate w-full">
                  {demo.description}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 border-t border-gray-100 pt-4 text-center">
        <p className="text-xs font-medium text-gray-500">
          ¿No tienes una cuenta?{' '}
          <Link
            to="/registro"
            className="font-bold text-brand-600 hover:text-brand-700 transition-colors"
          >
            Regístrate gratis
          </Link>
        </p>
      </div>

      {showForgotPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="mb-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-bold text-gray-900">
                  {recoveryStep === 1 ? 'Recuperar contraseña' : 'Nueva contraseña'}
                </h3>
              </div>
            </div>

            {recoveryStep === 1 && (
              <form onSubmit={handleSendResetEmail} className="space-y-4">
                <p className="text-xs text-gray-500">
                  Ingresa tu correo electrónico registrado y te enviaremos un enlace de recuperación.
                </p>
                <Input
                  label="Correo electrónico"
                  type="email"
                  placeholder="tucorreo@ejemplo.com"
                  value={recoveryEmail}
                  onChange={(e) => setRecoveryEmail(e.target.value)}
                  leftIcon={<Mail className="h-4 w-4 text-gray-400" />}
                />
                <div className="flex gap-2 pt-2">
                  <Button type="button" variant="outline" fullWidth onClick={() => setShowForgotPassword(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" fullWidth className="bg-brand-600 hover:bg-brand-700 font-bold">
                    Enviar enlace <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Button>
                </div>
              </form>
            )}

            {recoveryStep === 3 && (
              <form onSubmit={handleFinishReset} className="space-y-3">
                <p className="text-xs text-gray-600 flex items-center gap-1.5 text-emerald-700 bg-emerald-50 p-2.5 rounded-xl border border-emerald-100 font-medium">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> Enlace verificado. Define tu nueva contraseña.
                </p>
                <Input
                  label="Nueva contraseña"
                  type="password"
                  placeholder="Mínimo 8 caracteres"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  leftIcon={<LockKeyhole className="h-4 w-4 text-gray-400" />}
                />
                <Input
                  label="Confirmar nueva contraseña"
                  type="password"
                  placeholder="Repite la contraseña"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  leftIcon={<LockKeyhole className="h-4 w-4 text-gray-400" />}
                />
                <div className="flex gap-2 pt-2">
                  <Button type="button" variant="outline" fullWidth onClick={() => setShowForgotPassword(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" fullWidth className="bg-brand-600 hover:bg-brand-700 font-bold">
                    Actualizar contraseña
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}