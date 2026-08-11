import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, Loader2, AlertCircle, Eye, EyeOff, KeyRound, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Logo } from '@/components/Logo';

export function AdminLogin() {
  const { signIn, resetPassword } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [recoverEmail, setRecoverEmail] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: signInError } = await signIn(email, password);
    setLoading(false);
    if (signInError) {
      setError(signInError);
    } else {
      navigate('/admin');
    }
  };

  const handleRecover = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    const { error: resetError } = await resetPassword(recoverEmail);
    setLoading(false);
    if (resetError) {
      setError(resetError);
    } else {
      setInfo('Te enviamos un enlace para restablecer tu contraseña. Revisa tu correo.');
      setRecovering(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-navy-950 via-navy-900 to-navy-950 px-4">
      <div className="w-full max-w-md animate-slide-up">
        <div className="mb-8 flex justify-center">
          <Logo size="lg" />
        </div>
        <div className="card p-8">
          <h1 className="mb-1 text-center font-display text-2xl font-bold text-white">Panel Administrativo</h1>
          <p className="mb-6 text-center text-sm text-white/50">Ingresa tus credenciales para gestionar las tasas</p>

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

          {recovering ? (
            <form onSubmit={handleRecover} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-white/70">Correo electrónico</label>
                <div className="relative">
                  <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
                  <input
                    type="email"
                    required
                    value={recoverEmail}
                    onChange={(e) => setRecoverEmail(e.target.value)}
                    className="input-field pl-11"
                    placeholder="admin@bitjhoins.com"
                  />
                </div>
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? <Loader2 size={18} className="animate-spin" /> : <><KeyRound size={16} /> Enviar enlace</>}
              </button>
              <button
                type="button"
                onClick={() => { setRecovering(false); setError(null); setInfo(null); }}
                className="w-full text-center text-sm text-electric-300 hover:text-electric-200"
              >
                <ArrowLeft size={14} className="mr-1 inline" /> Volver a iniciar sesión
              </button>
            </form>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-4">
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
                      placeholder="admin@bitjhoins.com"
                    />
                  </div>
                </div>
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
                <button type="submit" disabled={loading} className="btn-primary w-full">
                  {loading ? <Loader2 size={18} className="animate-spin" /> : 'Ingresar'}
                </button>
              </form>
              <div className="mt-4 text-center">
                <button
                  onClick={() => { setRecovering(true); setError(null); setInfo(null); setRecoverEmail(email); }}
                  className="text-sm text-electric-300 hover:text-electric-200"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
            </>
          )}
        </div>
        <p className="mt-6 text-center text-xs text-white/30">BitJhoins · Cambio seguro, confiable, rápido</p>
      </div>
    </div>
  );
}
