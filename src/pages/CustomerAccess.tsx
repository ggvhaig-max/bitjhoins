import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, Loader2, AlertCircle, Eye, EyeOff, User, UserPlus, KeyRound, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Logo } from '@/components/Logo';

type Mode = 'login' | 'signup' | 'recovery';

export function CustomerAccess() {
  const { signIn, signUp, resetPassword } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (mode === 'signup') {
      if (password !== confirmPassword) {
        setError('Las contraseñas no coinciden.');
        return;
      }
      if (password.length < 6) {
        setError('La contraseña debe tener al menos 6 caracteres.');
        return;
      }
      setLoading(true);
      const { error: signUpError } = await signUp(email, password, displayName);
      setLoading(false);
      if (signUpError) {
        setError(signUpError);
      } else {
        navigate('/mis-ordenes');
      }
      return;
    }

    if (mode === 'recovery') {
      setLoading(true);
      const { error: resetError } = await resetPassword(email);
      setLoading(false);
      if (resetError) {
        setError(resetError);
      } else {
        setInfo('Te enviamos un enlace para restablecer tu contraseña. Revisa tu correo.');
      }
      return;
    }

    setLoading(true);
    const { error: signInError } = await signIn(email, password);
    setLoading(false);
    if (signInError) {
      setError(signInError);
    } else {
      navigate('/mis-ordenes');
    }
  };

  const titles: Record<Mode, string> = {
    login: 'Iniciar sesión',
    signup: 'Crear cuenta',
    recovery: 'Recuperar contraseña',
  };
  const subtitles: Record<Mode, string> = {
    login: 'Accede para ver tus operaciones y seguimiento',
    signup: 'Regístrate para gestionar tus cambios de divisas',
    recovery: 'Te enviaremos un enlace a tu correo',
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-navy-950 via-navy-900 to-navy-950 px-4">
      <div className="w-full max-w-md animate-slide-up">
        <div className="mb-8 flex justify-center">
          <Logo size="lg" />
        </div>
        <div className="card p-8">
          <h1 className="mb-1 text-center font-display text-2xl font-bold text-white">{titles[mode]}</h1>
          <p className="mb-6 text-center text-sm text-white/50">{subtitles[mode]}</p>

          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              <AlertCircle size={16} /> {error}
            </div>
          )}
          {info && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300">
              <CheckCircle2 size={16} /> {info}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-white/70">Nombre completo</label>
                <div className="relative">
                  <User size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="input-field pl-11"
                    placeholder="Juan Pérez"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-sm font-medium text-white/70">Correo electrónico</label>
              <div className="relative">
                <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field pl-11"
                  placeholder="tu@email.com"
                />
              </div>
            </div>

            {mode !== 'recovery' && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-white/70">Contraseña</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-field pl-11 pr-11"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            )}

            {mode === 'signup' && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-white/70">Confirmar contraseña</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="input-field pl-11 pr-11"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70"
                    tabIndex={-1}
                  >
                    {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : mode === 'login' ? (
                'Ingresar'
              ) : mode === 'signup' ? (
                <><UserPlus size={16} /> Crear cuenta</>
              ) : (
                <><KeyRound size={16} /> Enviar enlace</>
              )}
            </button>
          </form>

          <div className="mt-5 space-y-2 text-center text-sm">
            {mode === 'login' && (
              <>
                <button onClick={() => { setMode('recovery'); setError(null); setInfo(null); }} className="text-electric-300 hover:text-electric-200">
                  ¿Olvidaste tu contraseña?
                </button>
                <p className="text-white/40">
                  ¿No tienes cuenta?{' '}
                  <button onClick={() => { setMode('signup'); setError(null); setInfo(null); }} className="font-bold text-electric-300 hover:text-electric-200">
                    Regístrate
                  </button>
                </p>
              </>
            )}
            {mode === 'signup' && (
              <p className="text-white/40">
                ¿Ya tienes cuenta?{' '}
                <button onClick={() => { setMode('login'); setError(null); setInfo(null); }} className="font-bold text-electric-300 hover:text-electric-200">
                  Inicia sesión
                </button>
              </p>
            )}
            {mode === 'recovery' && (
              <button onClick={() => { setMode('login'); setError(null); setInfo(null); }} className="inline-flex items-center gap-1 text-electric-300 hover:text-electric-200">
                <ArrowLeft size={14} /> Volver a iniciar sesión
              </button>
            )}
          </div>
        </div>
        <p className="mt-6 text-center text-xs text-white/30">BitJhoins · Cambio seguro, confiable, rápido</p>
      </div>
    </div>
  );
}
