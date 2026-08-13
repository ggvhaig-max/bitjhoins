import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Loader2, Download, MessageCircle, Shield, Zap, Star, LockKeyhole,
  Headphones, Handshake, CalendarDays, ArrowUpRight, LogIn, LayoutDashboard,
} from 'lucide-react';
import { supabase, type ExchangeRate, type SiteSettings } from '@/lib/supabase';
import { formatNumber, formatDate } from '@/lib/format';
import { Logo } from '@/components/Logo';
import { downloadRateGraphic } from '@/components/RateGraphic';
import { CalculatorWidget } from '@/components/CalculatorWidget';
import { SponsorCarousel } from '@/components/SponsorCarousel';
import { useAuth } from '@/context/AuthContext';

const DEFAULT_WHATSAPP_NUMBER = '573024629142';
const WHATSAPP_MSG = encodeURIComponent('Hola BitJhoins, quiero cotizar un cambio de divisas.');

function formatWhatsappNumber(value: string): string {
  const digits = value.replace(/\D/g, '');
  return digits.length === 12 ? `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}` : value;
}

const countryColors: Record<string, string> = {
  Colombia: 'linear-gradient(#f9d616 0 50%, #2455a4 50% 75%, #c92127 75%)',
  'Venezuela a Colombia': 'linear-gradient(#f5d12b 0 33%, #2357a4 33% 66%, #bd2532 66%)',
  Chile: 'linear-gradient(#fff 0 50%, #d52b38 50%)',
  Perú: 'linear-gradient(90deg, #d92835 0 33%, #fff 33% 66%, #d92835 66%)',
  España: 'linear-gradient(#d92835 0 25%, #f5c51b 25% 75%, #d92835 75%)',
  'EEUU / Zelle': 'repeating-linear-gradient(#d92835 0 8%, #fff 8% 16%)',
  Ecuador: 'linear-gradient(#f5d12b 0 50%, #2357a4 50% 75%, #bd2532 75%)',
  Panamá: 'linear-gradient(90deg, #fff 0 50%, #d92835 50%), linear-gradient(#2357a4 0 50%, #fff 50%)',
  México: 'linear-gradient(90deg, #238447 0 33%, #fff 33% 66%, #d92835 66%)',
  'Costa Rica': 'linear-gradient(#2357a4 0 25%, #fff 25% 35%, #d92835 35% 65%, #fff 65% 75%, #2357a4 75%)',
  'Efectivo Venezuela': 'linear-gradient(#f5d12b 0 33%, #2357a4 33% 66%, #bd2532 66%)',
  PayPal: 'linear-gradient(135deg, #00a4df, #003087)',
};

function FlagMark({ country }: { country: string }) {
  return (
    <span
      aria-hidden="true"
      className="h-5 w-7 shrink-0 rounded-[4px] border border-white/20 shadow-sm"
      style={{ background: countryColors[country] ?? 'linear-gradient(135deg, #1aa8ff, #00145c)' }}
    />
  );
}

function WhyCard({ icon, title, text, tone }: { icon: React.ReactNode; title: string; text: string; tone: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-navy-950/70 p-3.5">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tone}`}>
        {icon}
      </div>
      <div>
        <p className="font-display text-sm font-bold text-white">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-white/60">{text}</p>
      </div>
    </div>
  );
}

export function PublicRates() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const captureRef = useRef<HTMLDivElement>(null);
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const [settings, setSettings] = useState<SiteSettings | null>(null);

  useEffect(() => {
    const load = async () => {
      const [{ data: rateData }, { data: settingsData }] = await Promise.all([
        supabase.from('exchange_rates').select('*').eq('active', true).order('display_order', { ascending: true }),
        supabase.from('site_settings').select('*').eq('id', 'main').maybeSingle(),
      ]);
      const activeRates = (rateData as ExchangeRate[]) ?? [];
      setRates(activeRates);
      setPublishedAt(activeRates.find((r) => r.published_at)?.published_at ?? null);
      setSettings((settingsData as SiteSettings | null) ?? null);
      setLoading(false);
    };
    load();
  }, []);

  const whatsappNumber = settings?.whatsapp_number ?? DEFAULT_WHATSAPP_NUMBER;
  const displayDate = settings?.published_date
    ? new Date(`${settings.published_date}T12:00:00`)
    : publishedAt ? new Date(publishedAt) : new Date();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-navy-950">
        <Loader2 size={32} className="animate-spin text-electric-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-hidden bg-[#020b20] text-white">
      <header className="relative border-b border-electric-400/20 bg-[radial-gradient(circle_at_72%_10%,rgba(0,144,240,0.28),transparent_30%),linear-gradient(135deg,#020819,#001b46_58%,#001039)]">
        <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(#1aa8ff_1px,transparent_1px)] [background-size:18px_18px]" />
        <div className="relative mx-auto max-w-6xl px-4 pb-6 pt-5 sm:px-6 sm:pt-8">
          <nav className="flex items-center justify-between gap-3">
            <Logo size="md" />
            <div className="flex items-center gap-2">
              <a
                href={`https://wa.me/${whatsappNumber}?text=${WHATSAPP_MSG}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ghost hidden border-electric-400/30 text-sm sm:inline-flex"
              >
                <MessageCircle size={16} /> WhatsApp
              </a>
              {user ? (
                <button
                  onClick={() => navigate(profile?.role === 'user' ? '/mis-ordenes' : '/admin')}
                  className="btn-primary text-sm"
                >
                  <LayoutDashboard size={16} /> <span className="hidden sm:inline">{profile?.role === 'user' ? 'Mis órdenes' : 'Ir al panel'}</span><span className="sm:hidden">{profile?.role === 'user' ? 'Órdenes' : 'Panel'}</span>
                </button>
              ) : (
                <button
                  onClick={() => navigate('/acceso')}
                  className="btn-primary text-sm"
                >
                  <LogIn size={16} /> <span className="hidden sm:inline">Iniciar sesión</span><span className="sm:hidden">Entrar</span>
                </button>
              )}
            </div>
          </nav>
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
        <div ref={captureRef} id="rate-graphic-target" className="space-y-5">
        <div className="flex items-center justify-center rounded-[1.6rem] border border-electric-400/20 bg-[radial-gradient(circle_at_72%_10%,rgba(0,144,240,0.28),transparent_30%),linear-gradient(135deg,#020819,#001b46_58%,#001039)] px-6 py-5">
          <Logo size="lg" />
        </div>
        <section className="relative overflow-hidden rounded-[1.6rem] border border-electric-400/20 bg-[radial-gradient(circle_at_72%_10%,rgba(0,144,240,0.28),transparent_30%),linear-gradient(135deg,#020819,#001b46_58%,#001039)]">
          <div data-capture-hide="true" className="absolute inset-0 opacity-20 [background-image:radial-gradient(#1aa8ff_1px,transparent_1px)] [background-size:18px_18px]" />
          <div className="relative grid items-center gap-8 pb-6 pt-8 lg:grid-cols-[1.12fr_0.88fr] lg:gap-10 lg:pt-12">
            <div className="pointer-events-none absolute -right-20 top-0 hidden h-[27rem] w-[33rem] overflow-hidden rounded-[3rem] opacity-35 mix-blend-screen lg:block" aria-hidden="true">
              <img src="/images/image copy.png" alt="" className="h-full w-full scale-[1.7] object-cover object-[85%_13%] blur-[0.4px]" />
              <div className="absolute inset-0 bg-gradient-to-l from-[#020819]/10 via-[#020819]/45 to-[#020819]" />
            </div>
            <div className="max-w-2xl">
              <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-electric-300 sm:text-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-gold-400" /> Cambio seguro <span className="text-gold-400">•</span> confiable <span className="text-gold-400">•</span> rápido
              </p>
              <h1 className="font-display text-[4.5rem] font-extrabold leading-[0.82] tracking-[-0.06em] text-white sm:text-[7rem] lg:text-[8.8rem]">
                TASA
                <span className="block text-gold-400">DEL DÍA</span>
              </h1>
              <p className="mt-6 max-w-md text-sm leading-relaxed text-white/65 sm:text-base">
                Consulta nuestras tasas actualizadas y cambia tu dinero con la seguridad de BitJhoins.
              </p>
              <div className="mt-6 inline-flex items-center gap-3 rounded-2xl border border-electric-400/60 bg-navy-950/60 px-4 py-3">
                <CalendarDays size={22} className="text-gold-400" />
                <div>
                  <p className="font-mono text-lg font-bold text-electric-300">
                    {displayDate.toLocaleDateString('es-VE')}
                  </p>
                  <p className="text-[11px] uppercase tracking-widest text-white/45">{settings?.published_date ? 'Fecha publicada por administración' : publishedAt ? formatDate(publishedAt).split(', ')[1] : 'Actualización disponible'}</p>
                </div>
              </div>
            </div>

            <div className="relative z-10 mx-auto hidden h-72 w-full max-w-sm lg:block">
              <div className="absolute right-4 top-1/2 h-[21rem] w-44 -translate-y-1/2 rotate-[10deg] rounded-[2.2rem] border-4 border-white/80 bg-navy-900 p-2 shadow-2xl shadow-electric-500/40 transition-transform duration-500 hover:rotate-[5deg] hover:scale-105">
                <div className="relative flex h-full flex-col overflow-hidden rounded-[1.7rem] border border-electric-400/30 bg-[radial-gradient(circle_at_70%_18%,rgba(22,216,255,.35),transparent_32%),linear-gradient(145deg,#003d7c,#000d2e)] p-3">
                  <div className="mx-auto mb-5 h-1 w-12 rounded-full bg-white/50" />
                  <div className="mb-5 flex items-center gap-2"><Logo size="sm" /><span className="text-[8px] font-bold uppercase tracking-widest text-white/55">Cambio digital</span></div>
                  <p className="font-display text-lg font-extrabold leading-none text-white">Cambia hoy,</p>
                  <p className="mt-1 font-display text-lg font-extrabold leading-none text-gold-400">gana tranquilo.</p>
                  <p className="mt-3 text-[9px] leading-relaxed text-white/60">Tu dinero en buenas manos, con atención real.</p>
                  <div className="mt-auto rounded-xl border border-electric-400/30 bg-navy-950/50 p-2.5"><div className="mb-2 flex items-center justify-between text-[8px] font-bold uppercase text-white/50"><span>Tasa del día</span><span className="text-lime-300">Actualizada</span></div><div className="h-1.5 rounded-full bg-electric-400/20"><div className="h-full w-4/5 rounded-full bg-gradient-to-r from-electric-400 to-gold-400" /></div></div>
                </div>
              </div>
              <div className="absolute bottom-0 left-3 flex h-24 w-24 -rotate-12 items-center justify-center rounded-full border-4 border-gold-400 bg-navy-950 text-center shadow-xl shadow-gold-400/20">
                <div className="text-[10px] font-bold uppercase leading-tight text-gold-300"><LockKeyhole size={21} className="mx-auto mb-1" />100%<br />seguro</div>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-[1.18fr_0.82fr]">
          <section className="overflow-hidden rounded-[1.6rem] border border-electric-400 bg-[#031b38] shadow-2xl shadow-black/20">
            <div className="bg-electric-400 px-5 py-3 text-center font-display text-sm font-extrabold uppercase tracking-[0.16em] text-navy-950 sm:text-base">
              Tipos de cambio actualizados
            </div>
            <div className="p-3 sm:p-5">
              {rates.map((rate, index) => (
                <div key={rate.id} className={`flex items-center gap-3 border-b border-white/10 px-2 py-3.5 last:border-0 sm:px-3 ${index % 2 === 0 ? 'bg-white/[0.025]' : ''}`}>
                  <FlagMark country={rate.country} />
                  <span className="min-w-0 flex-1 truncate text-sm font-bold uppercase tracking-wide text-white sm:text-base">{rate.country === 'Venezuela a Colombia' ? 'VZLA A COLOMBIA' : rate.country === 'Efectivo Venezuela' ? 'EFECTIVO VZLA' : rate.country}</span>
                  <span className="hidden flex-1 border-b border-dotted border-white/25 sm:block" />
                  <span className="min-w-[72px] text-right font-mono text-xl font-bold text-electric-300 sm:text-2xl">{formatNumber(rate.rate, rate.decimals)}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[1.6rem] border border-electric-400/60 bg-[#031b38] p-4 shadow-2xl shadow-black/20 sm:p-5">
            <h2 className="mb-4 text-center font-display text-2xl font-extrabold uppercase italic text-white sm:text-3xl">¿Por qué elegir <span className="text-gold-400">BitJhoins?</span></h2>
            <div className="space-y-3">
              <WhyCard icon={<Shield size={23} />} title="Seguridad" text="Tus transacciones siempre protegidas" tone="bg-electric-500/20 text-electric-300" />
              <WhyCard icon={<Zap size={23} />} title="Rapidez" text="Operaciones ágiles, sin demoras" tone="bg-gold-400/20 text-gold-300" />
              <WhyCard icon={<Handshake size={23} />} title="Confianza" text="Respaldo y experiencia en cada cambio" tone="bg-lime-400/20 text-lime-300" />
              <WhyCard icon={<Headphones size={23} />} title="Atención real" text="Soporte humano, cercano y efectivo" tone="bg-pink-400/20 text-pink-300" />
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2 border-t border-white/10 pt-4 text-center">
              <div><p className="font-display text-sm font-extrabold text-gold-400">MEJOR</p><p className="text-[10px] uppercase tracking-wide text-white/45">tasa</p></div>
              <div><p className="font-display text-sm font-extrabold text-electric-300">REAL</p><p className="text-[10px] uppercase tracking-wide text-white/45">atención</p></div>
              <div><p className="font-display text-sm font-extrabold text-lime-300">FÁCIL</p><p className="text-[10px] uppercase tracking-wide text-white/45">sin vueltas</p></div>
            </div>
          </section>

          <section className="flex items-center justify-center gap-3 rounded-[1.6rem] border border-electric-400/40 bg-[#031b38] px-6 py-4 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#25d366] text-white shadow-lg shadow-[#25d366]/20"><MessageCircle size={24} fill="currentColor" /></div>
            <div>
              <p className="text-sm font-bold uppercase text-white/70">Cotiza ahora <span className="text-gold-400">por WhatsApp</span></p>
              <p className="font-mono text-xl font-bold text-white sm:text-2xl">{formatWhatsappNumber(whatsappNumber)}</p>
            </div>
          </section>
        </div>
        </div>

          <div className="mt-5"><SponsorCarousel /></div>

        <div className="mt-5 flex flex-col gap-3 rounded-[1.4rem] border border-electric-400/60 bg-[#031b38] p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <a href={`https://wa.me/${whatsappNumber}?text=${WHATSAPP_MSG}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#25d366] text-white shadow-lg shadow-[#25d366]/20"><MessageCircle size={27} fill="currentColor" /></div>
            <div><p className="text-sm font-bold uppercase text-white/70">Cotiza ahora <span className="text-gold-400">por WhatsApp</span></p><p className="font-mono text-xl font-bold text-white sm:text-2xl">{formatWhatsappNumber(whatsappNumber)}</p></div>
          </a>
          <button onClick={() => downloadRateGraphic()} className="btn-gold w-full sm:w-auto"><Download size={18} /> Descargar tasa del día</button>
        </div>

        <div className="mt-12 scroll-mt-8" id="calculadora"><CalculatorWidget rates={rates} /></div>

        <div className="mt-8 flex flex-wrap justify-center gap-5 text-sm text-white/45">
          <span className="flex items-center gap-1.5"><Shield size={15} className="text-electric-400" /> Seguro</span>
          <span className="flex items-center gap-1.5"><Zap size={15} className="text-gold-400" /> Rápido</span>
          <span className="flex items-center gap-1.5"><Star size={15} className="text-electric-400" /> Confiable</span>
          <a href={`https://wa.me/${whatsappNumber}?text=${WHATSAPP_MSG}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-electric-300 hover:text-electric-200"><ArrowUpRight size={15} /> Hablar con un asesor</a>
        </div>
      </main>

      <footer className="border-t border-white/10 py-7"><div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-4 sm:flex-row sm:justify-between sm:px-6"><Logo size="sm" /><p className="text-xs text-white/30">Plataforma digital de cambio de divisas</p></div></footer>
    </div>
  );
}
