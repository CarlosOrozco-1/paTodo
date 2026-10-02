import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { FlaskConical, LockKeyhole, Mail, ArrowRight, ArrowLeft, CheckCircle2, Sparkles } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/uiStore';
import { getErrorMessage } from '@/api/axiosClient';
import { isDemoMode } from '@/api/demo';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
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
  const [recoveryStep, setRecoveryStep] = useState<1 | 2 | 3>(1);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const authStore = useAuthStore();
  const { login, loginWithGoogle, isLoading } = authStore;
  const navigate = useNavigate();
  const location = useLocation();
  const demoEnabled = isDemoMode();

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';

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

      // Cuenta nueva: el documento se crea al confirmar el formulario, porque
      // Google no entrega teléfono y /createUser lo exige.
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

  const handleNextStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryEmail.trim()) {
      toast('error', 'Ingresa tu correo electrónico');
      return;
    }
    toast('success', 'Código de verificación enviado.');
    setRecoveryStep(2);
  };

  const handleNextStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetCode.trim()) {
      toast('error', 'Ingresa el código de verificación');
      return;
    }
    setRecoveryStep(3);
  };

  const handleFinishReset = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast('error', 'La contraseña debe tener al menos 8 caracteres');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      toast('error', 'Las contraseñas no coinciden');
      return;
    }
    toast('success', '¡Contraseña actualizada con éxito!');
    setShowForgotPassword(false);
    setRecoveryStep(1);
    setRecoveryEmail('');
    setResetCode('');
    setNewPassword('');
    setConfirmNewPassword('');
  };

  return (
    <div className="w-full">
      {/* Encabezado del Formulario */}
      <div className="mb-6 text-center sm:text-left">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-500 via-brand-600 to-teal-400 text-white shadow-lg shadow-emerald-600/30 border border-emerald-400/40 lg:hidden mb-4 mx-auto sm:mx-0">
          <Sparkles className="h-6 w-6 text-white" />
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

      {/* Botón de Google OAuth */}
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

      {/* Modal Olvidé Contraseña */}
      {showForgotPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="mb-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-bold text-gray-900">Recuperar contraseña</h3>
                <span className="text-xs font-semibold text-brand-600 bg-brand-50 px-2.5 py-1 rounded-full border border-brand-100">
                  Paso {recoveryStep} de 3
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <div className={`h-1.5 rounded-full transition-colors ${recoveryStep >= 1 ? 'bg-brand-600' : 'bg-gray-200'}`} />
                <div className={`h-1.5 rounded-full transition-colors ${recoveryStep >= 2 ? 'bg-brand-600' : 'bg-gray-200'}`} />
                <div className={`h-1.5 rounded-full transition-colors ${recoveryStep >= 3 ? 'bg-brand-600' : 'bg-gray-200'}`} />
              </div>
            </div>

            {recoveryStep === 1 && (
              <form onSubmit={handleNextStep1} className="space-y-4">
                <p className="text-xs text-gray-500">
                  Ingresa tu correo electrónico registrado y te enviaremos un código de seguridad.
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
                    Siguiente <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Button>
                </div>
              </form>
            )}

            {recoveryStep === 2 && (
              <form onSubmit={handleNextStep2} className="space-y-4">
                <p className="text-xs text-gray-500">
                  Hemos enviado un código de 6 dígitos a <span className="font-bold text-gray-700">{recoveryEmail}</span>.
                </p>
                <Input
                  label="Código de verificación"
                  type="text"
                  placeholder="Ej: 123456"
                  value={resetCode}
                  onChange={(e) => setResetCode(e.target.value)}
                />
                <div className="flex gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setRecoveryStep(1)}>
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <Button type="submit" fullWidth className="bg-brand-600 hover:bg-brand-700 font-bold">
                    Verificar código <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Button>
                </div>
              </form>
            )}

            {recoveryStep === 3 && (
              <form onSubmit={handleFinishReset} className="space-y-3">
                <p className="text-xs text-gray-600 flex items-center gap-1.5 text-emerald-700 bg-emerald-50 p-2.5 rounded-xl border border-emerald-100 font-medium">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> Código verificado. Define tu nueva contraseña.
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
                  <Button type="button" variant="outline" onClick={() => setRecoveryStep(2)}>
                    <ArrowLeft className="h-4 w-4" />
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