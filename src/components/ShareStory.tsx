import { useEffect, useMemo, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import {
  Download, Share2, Loader2, Palette, Type, ListChecks, Sparkles,
  Image as ImageIcon, Save, RotateCcw, Crop,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { ExchangeRate, SiteSettings } from '@/lib/supabase';
import { formatNumber } from '@/lib/format';

/**
 * Imagen para compartir la tasa del día.
 *
 * El jefe pidió (29-ago) que quedara "editable, personalizable, con el logo y
 * todo eso". Tres cosas cambiaron respecto a la primera versión:
 *
 *  1. **El logo es el suyo.** Antes estaba DIBUJADO A MANO en el código (un SVG
 *     fijo). Ahora se sube desde aquí, se guarda en `site_settings.logo_url` y
 *     vive en el bucket `bj-brand`. El dibujo viejo queda solo de respaldo, por
 *     si todavía no han subido nada.
 *  2. **El diseño se recuerda.** Antes había que reconfigurar colores y textos
 *     cada día. Ahora se guarda en `site_settings.share_design`.
 *  3. **Tres formatos.** Historia 9:16, publicación cuadrada 1:1 y ancha 16:9,
 *     porque una historia no sirve para el feed ni para mandar por WhatsApp.
 */

type Props = {
  rates: ExchangeRate[];
  settings: SiteSettings | null;
  onSettingsChange?: () => void;
};

type Template = {
  id: string;
  name: string;
  bg1: string;
  bg2: string;
  accent: string;
  text: string;
  cardBg: string;
};

const TEMPLATES: Template[] = [
  { id: 'noche', name: 'Noche BitJhoins', bg1: '#020b20', bg2: '#0a2472', accent: '#ffc024', text: '#ffffff', cardBg: 'rgba(255,255,255,0.07)' },
  { id: 'dorado', name: 'Dorado elegante', bg1: '#1a1206', bg2: '#3d2e0a', accent: '#ffd24a', text: '#fff8e7', cardBg: 'rgba(255,210,74,0.10)' },
  { id: 'electrico', name: 'Azul eléctrico', bg1: '#001233', bg2: '#0466c8', accent: '#7ee8fa', text: '#ffffff', cardBg: 'rgba(255,255,255,0.10)' },
  { id: 'esmeralda', name: 'Esmeralda', bg1: '#01201a', bg2: '#04724d', accent: '#7cf7c4', text: '#ffffff', cardBg: 'rgba(255,255,255,0.08)' },
  { id: 'claro', name: 'Claro limpio', bg1: '#f4f7ff', bg2: '#dbe7ff', accent: '#00145c', text: '#0a1633', cardBg: 'rgba(0,20,92,0.06)' },
];

/** Los tres formatos, en pixeles reales de salida. */
const FORMATOS = {
  historia: { id: 'historia', nombre: 'Historia 9:16', w: 1080, h: 1920, previewW: 300 },
  cuadrado: { id: 'cuadrado', nombre: 'Publicación 1:1', w: 1080, h: 1080, previewW: 340 },
  ancho: { id: 'ancho', nombre: 'Ancha 16:9', w: 1200, h: 675, previewW: 400 },
} as const;
type FormatoId = keyof typeof FORMATOS;

const FLAGS: Record<string, string> = {
  COP_VES: '🇨🇴', VESCOL_VES: '🇻🇪', CLP_VES: '🇨🇱', PEN_VES: '🇵🇪', EUR_VES: '🇪🇸',
  USD_VES: '🇺🇸', USD_VES_ECU: '🇪🇨', USD_VES_PAN: '🇵🇦', MXN_VES: '🇲🇽', CRC_VES: '🇨🇷',
  EFECTIVO_VES: '💵', USD_VES_PAYPAL: '💳',
};

const FONT = "'Segoe UI', system-ui, -apple-system, Arial, sans-serif";

/** Todo lo que se guarda en `share_design`. */
type Diseno = {
  templateId: string;
  bg1: string; bg2: string; accent: string; textColor: string; cardBg: string;
  title: string; subtitle: string; footer: string; slogan: string;
  showDate: boolean; showFlags: boolean; showWhatsapp: boolean; showLogo: boolean;
  fontScale: number; logoScale: number;
  formato: FormatoId;
  ocultas: string[];
};

const DISENO_INICIAL: Diseno = {
  templateId: TEMPLATES[0].id,
  bg1: TEMPLATES[0].bg1, bg2: TEMPLATES[0].bg2, accent: TEMPLATES[0].accent,
  textColor: TEMPLATES[0].text, cardBg: TEMPLATES[0].cardBg,
  title: 'TASA DEL DÍA', subtitle: '', footer: '¡Escríbenos y cambia hoy mismo!',
  slogan: 'Cambio seguro, confiable y rápido',
  showDate: true, showFlags: true, showWhatsapp: true, showLogo: true,
  fontScale: 1, logoScale: 1,
  formato: 'historia',
  ocultas: [],
};

export function ShareStory({ rates, settings, onSettingsChange }: Props) {
  const activeRates = useMemo(() => rates.filter((r) => r.active), [rates]);
  const [d, setD] = useState<Diseno>(DISENO_INICIAL);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState<'download' | 'share' | 'logo' | 'guardar' | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const storyRef = useRef<HTMLDivElement>(null);

  // Cargar lo guardado. Si nunca han guardado nada, quedan los valores de fábrica.
  useEffect(() => {
    setLogoUrl(settings?.logo_url ?? null);
    const g = settings?.share_design as Partial<Diseno> | null;
    if (g && Object.keys(g).length) setD((prev) => ({ ...prev, ...g }));
  }, [settings?.logo_url, settings?.share_design]);

  const set = <K extends keyof Diseno>(k: K, v: Diseno[K]) => setD((p) => ({ ...p, [k]: v }));

  const fmt = FORMATOS[d.formato];
  // El lienzo se dibuja a la mitad del tamaño real y se exporta al doble, para
  // que el PNG salga nítido sin manejar fuentes gigantes en la vista previa.
  const W = fmt.w / 2;
  const H = fmt.h / 2;
  const escalaVista = fmt.previewW / W;

  const visibleRates = activeRates.filter((r) => !d.ocultas.includes(r.id));
  // En la ancha caben menos renglones: se aprieta antes.
  const limite = d.formato === 'ancho' ? 5 : d.formato === 'cuadrado' ? 6 : 8;
  const compact = visibleRates.length > limite;

  const applyTemplate = (t: Template) =>
    setD((p) => ({ ...p, templateId: t.id, bg1: t.bg1, bg2: t.bg2, accent: t.accent, textColor: t.text, cardBg: t.cardBg }));

  const dateStr = new Date().toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const whatsapp = settings?.whatsapp_number ?? '';
  const whatsappPretty = whatsapp ? '+' + whatsapp.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})$/, '$1 $2 $3 $4') : '';

  async function subirLogo(file: File) {
    setBusy('logo'); setMsg(null);
    try {
      const ext = (file.name.split('.').pop() || 'png').toLowerCase();
      const ruta = `logo-${Date.now()}.${ext}`;
      const { error: errUp } = await supabase.storage.from('bj-brand').upload(ruta, file, { upsert: true });
      if (errUp) throw errUp;
      const { data } = supabase.storage.from('bj-brand').getPublicUrl(ruta);
      const url = data.publicUrl;
      const { error } = await supabase.schema('bitjhoins').from('site_settings')
        .update({ logo_url: url }).eq('id', settings?.id ?? 'main');
      if (error) throw error;
      setLogoUrl(url);
      onSettingsChange?.();
      setMsg('Logo actualizado. Ya sale en la imagen.');
    } catch (e: any) {
      setMsg(e?.message || 'No se pudo subir el logo.');
    } finally {
      setBusy(null);
      setTimeout(() => setMsg(null), 5000);
    }
  }

  async function guardarDiseno() {
    setBusy('guardar'); setMsg(null);
    const { error } = await supabase.schema('bitjhoins').from('site_settings')
      .update({ share_design: d }).eq('id', settings?.id ?? 'main');
    setBusy(null);
    setMsg(error ? (error.message || 'No se pudo guardar.') : 'Diseño guardado. Mañana lo encuentras igual.');
    if (!error) onSettingsChange?.();
    setTimeout(() => setMsg(null), 5000);
  }

  const capture = async (): Promise<string | null> => {
    const node = storyRef.current;
    if (!node) return null;
    try {
      return await toPng(node, {
        pixelRatio: 2,          // dibujado a W×H, sale a fmt.w × fmt.h
        cacheBust: true,
        skipFonts: true,
        width: W, height: H,
        style: { transform: 'none', margin: '0' },
      });
    } catch {
      return null;
    }
  };

  const nombreArchivo = () => `bitjhoins-tasa-${d.formato}-${new Date().toISOString().slice(0, 10)}.png`;

  const handleDownload = async () => {
    setBusy('download'); setMsg(null);
    const dataUrl = await capture();
    setBusy(null);
    if (!dataUrl) { setMsg('No se pudo generar la imagen.'); return; }
    const link = document.createElement('a');
    link.download = nombreArchivo();
    link.href = dataUrl;
    link.click();
    setMsg(`Descargada en ${fmt.w}×${fmt.h}.`);
    setTimeout(() => setMsg(null), 4000);
  };

  const handleShare = async () => {
    setBusy('share'); setMsg(null);
    const dataUrl = await capture();
    if (!dataUrl) { setBusy(null); setMsg('No se pudo generar la imagen.'); return; }
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], nombreArchivo(), { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Tasa del día BitJhoins' });
        setMsg('Compartida.');
      } else {
        const link = document.createElement('a');
        link.download = file.name;
        link.href = dataUrl;
        link.click();
        setMsg('Tu navegador no comparte directo: se descargó para que la subas.');
      }
    } catch { /* el usuario canceló */ }
    setBusy(null);
    setTimeout(() => setMsg(null), 4000);
  };

  const s = (px: number) => px * d.fontScale;
  const esAncho = d.formato === 'ancho';

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      {/* ==== Vista previa ==== */}
      <div className="flex flex-col items-center gap-4">
        <div style={{ width: fmt.previewW, height: H * escalaVista, overflow: 'hidden', borderRadius: 18, boxShadow: '0 20px 60px rgba(0,0,0,.5)' }}>
          <div style={{ transform: `scale(${escalaVista})`, transformOrigin: 'top left' }}>
            <div
              ref={storyRef}
              style={{
                width: W, height: H, fontFamily: FONT, color: d.textColor,
                background: `linear-gradient(160deg, ${d.bg1} 0%, ${d.bg2} 100%)`,
                display: 'flex', flexDirection: 'column',
                padding: esAncho ? '28px 40px 24px' : '44px 40px 36px',
                position: 'relative', overflow: 'hidden',
              }}
            >
              <div style={{ position: 'absolute', top: -90, right: -90, width: 260, height: 260, borderRadius: '50%', background: d.accent, opacity: 0.12 }} />
              <div style={{ position: 'absolute', bottom: -110, left: -110, width: 300, height: 300, borderRadius: '50%', background: d.accent, opacity: 0.08 }} />

              {/* Logo: el suyo si lo subieron; si no, el dibujo de respaldo. */}
              {d.showLogo && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center' }}>
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt=""
                      crossOrigin="anonymous"
                      style={{ height: s(46) * d.logoScale, maxWidth: W - 80, objectFit: 'contain' }}
                    />
                  ) : (
                    <>
                      <svg viewBox="0 0 100 100" width={s(40) * d.logoScale} height={s(40) * d.logoScale}>
                        <circle cx="50" cy="50" r="44" fill="#ffffff" stroke="#00145c" strokeWidth="5" />
                        <path d="M39 24v52M39 26h22c10 0 14 5 14 12s-4 11-12 12H39m0 0h24c9 0 14 5 14 12 0 9-6 14-16 14H39" fill="none" stroke="#ffc024" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M62 25v48c0 8-4 13-13 13" fill="none" stroke="#00145c" strokeWidth="8" strokeLinecap="round" />
                      </svg>
                      <span style={{ fontWeight: 900, fontSize: s(26) * d.logoScale, letterSpacing: '-0.04em' }}>
                        <span style={{ color: d.accent }}>BIT</span><span>JHOINS</span>
                      </span>
                    </>
                  )}
                </div>
              )}

              <div style={{ textAlign: 'center', marginTop: esAncho ? s(6) : s(18) }}>
                <div style={{ fontWeight: 900, fontSize: s(esAncho ? 34 : 44), letterSpacing: '0.02em', lineHeight: 1.05 }}>{d.title}</div>
                {d.subtitle && <div style={{ fontSize: s(19), opacity: 0.85, marginTop: 6 }}>{d.subtitle}</div>}
                {d.showDate && (
                  <div style={{ display: 'inline-block', marginTop: 10, padding: '5px 16px', borderRadius: 999, background: d.accent, color: d.bg1, fontWeight: 700, fontSize: s(15) }}>
                    {dateStr}
                  </div>
                )}
              </div>

              {/* Tasas. En la ancha van en dos columnas para que quepan. */}
              <div style={{
                flex: 1, display: esAncho ? 'grid' : 'flex',
                gridTemplateColumns: esAncho ? '1fr 1fr' : undefined,
                flexDirection: esAncho ? undefined : 'column',
                alignContent: 'center', justifyContent: 'center',
                gap: compact ? 7 : 10, marginTop: s(esAncho ? 8 : 16),
              }}>
                {visibleRates.map((r) => (
                  <div key={r.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: d.cardBg, borderRadius: 14, padding: compact ? '8px 16px' : '11px 18px',
                    border: `1px solid ${d.accent}22`,
                  }}>
                    <span style={{ fontSize: compact ? s(16) : s(18), fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                      {d.showFlags && <span style={{ fontSize: compact ? s(18) : s(21) }}>{FLAGS[r.currency_code] ?? '🌎'}</span>}
                      {r.country}
                    </span>
                    <span style={{ fontSize: compact ? s(19) : s(22), fontWeight: 900, color: d.accent, fontVariantNumeric: 'tabular-nums' }}>
                      {formatNumber(r.rate, r.decimals)}
                    </span>
                  </div>
                ))}
                {visibleRates.length === 0 && (
                  <div style={{ textAlign: 'center', opacity: 0.6, fontSize: s(18) }}>Activa al menos una tasa →</div>
                )}
              </div>

              <div style={{ textAlign: 'center', marginTop: s(esAncho ? 6 : 14) }}>
                {d.footer && <div style={{ fontSize: s(18), fontWeight: 600, opacity: 0.95 }}>{d.footer}</div>}
                {d.showWhatsapp && whatsappPretty && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 8, padding: '8px 20px', borderRadius: 999, border: `2px solid ${d.accent}`, fontWeight: 800, fontSize: s(17) }}>
                    <span>📲</span> {whatsappPretty}
                  </div>
                )}
                {d.slogan && <div style={{ fontSize: s(12), opacity: 0.5, marginTop: 10 }}>{d.slogan}</div>}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          <button onClick={handleShare} disabled={busy !== null} className="btn-gold">
            {busy === 'share' ? <Loader2 size={18} className="animate-spin" /> : <Share2 size={18} />} Compartir
          </button>
          <button onClick={handleDownload} disabled={busy !== null} className="btn-primary">
            {busy === 'download' ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />} Descargar PNG
          </button>
          <button onClick={guardarDiseno} disabled={busy !== null} className="btn-primary">
            {busy === 'guardar' ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} Guardar diseño
          </button>
        </div>
        {msg && <p className="text-center text-sm text-electric-300">{msg}</p>}
        <p className="text-center text-xs text-white/35">Sale en {fmt.w} × {fmt.h} px.</p>
      </div>

      {/* ==== Panel de personalización ==== */}
      <div className="space-y-4">
        <section className="card p-4">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><Crop size={15} className="text-gold-400" /> Formato</p>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(FORMATOS) as FormatoId[]).map((k) => (
              <button key={k} onClick={() => set('formato', k)}
                className={`rounded-xl border px-2 py-2 text-xs transition ${d.formato === k ? 'border-gold-400/60 bg-gold-400/10' : 'border-white/10 bg-white/[.03] hover:bg-white/[.06]'}`}>
                {FORMATOS[k].nombre}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-white/40">
            Historia para estado de WhatsApp e Instagram; cuadrada para el feed; ancha para mandar por chat o correo.
          </p>
        </section>

        <section className="card p-4">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><ImageIcon size={15} className="text-gold-400" /> Tu logo</p>
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white/5">
              {logoUrl ? <img src={logoUrl} alt="" className="max-h-full max-w-full object-contain" /> : <span className="text-[10px] text-white/40">Sin logo</span>}
            </div>
            <label className={`flex-1 cursor-pointer rounded-xl border border-dashed border-white/20 px-3 py-2 text-center text-sm transition hover:border-gold-400/50 ${busy === 'logo' ? 'pointer-events-none opacity-50' : ''}`}>
              {busy === 'logo' ? 'Subiendo…' : logoUrl ? 'Cambiar logo' : 'Subir logo'}
              <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) subirLogo(f); }} />
            </label>
          </div>
          <p className="mt-2 text-[11px] text-white/40">PNG con fondo transparente se ve mejor.</p>
          <div className="mt-3">
            <label className="mb-1 block text-xs text-white/50">Tamaño del logo</label>
            <input type="range" min={0.6} max={2} step={0.05} value={d.logoScale}
              onChange={(e) => set('logoScale', parseFloat(e.target.value))} className="w-full" />
          </div>
          {logoUrl && (
            <button onClick={() => setLogoUrl(null)} className="mt-2 text-xs text-white/40 underline hover:text-white/70">
              Usar el logo de respaldo
            </button>
          )}
        </section>

        <section className="card p-4">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><Sparkles size={15} className="text-gold-400" /> Estilo</p>
          <div className="grid grid-cols-1 gap-2">
            {TEMPLATES.map((t) => (
              <button key={t.id} onClick={() => applyTemplate(t)}
                className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-left text-sm transition ${d.templateId === t.id ? 'border-gold-400/60 bg-gold-400/10' : 'border-white/10 bg-white/[.03] hover:bg-white/[.06]'}`}>
                <span style={{ width: 34, height: 34, borderRadius: 10, background: `linear-gradient(160deg, ${t.bg1}, ${t.bg2})`, border: `2px solid ${t.accent}`, flexShrink: 0 }} />
                {t.name}
              </button>
            ))}
          </div>
        </section>

        <section className="card p-4">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><Palette size={15} className="text-gold-400" /> Colores</p>
          <div className="grid grid-cols-2 gap-3">
            <ColorField label="Fondo arriba" value={d.bg1} onChange={(v) => set('bg1', v)} />
            <ColorField label="Fondo abajo" value={d.bg2} onChange={(v) => set('bg2', v)} />
            <ColorField label="Color de acento" value={d.accent} onChange={(v) => set('accent', v)} />
            <ColorField label="Color del texto" value={d.textColor} onChange={(v) => set('textColor', v)} />
          </div>
        </section>

        <section className="card p-4">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><Type size={15} className="text-gold-400" /> Textos</p>
          <div className="space-y-2">
            <input className="input-field" value={d.title} onChange={(e) => set('title', e.target.value)} placeholder="Título" />
            <input className="input-field" value={d.subtitle} onChange={(e) => set('subtitle', e.target.value)} placeholder="Subtítulo (opcional)" />
            <input className="input-field" value={d.footer} onChange={(e) => set('footer', e.target.value)} placeholder="Mensaje del pie" />
            <input className="input-field" value={d.slogan} onChange={(e) => set('slogan', e.target.value)} placeholder="Frase pequeña de abajo" />
          </div>
          <div className="mt-3">
            <label className="mb-1 block text-xs text-white/50">Tamaño de letra</label>
            <input type="range" min={0.8} max={1.25} step={0.05} value={d.fontScale}
              onChange={(e) => set('fontScale', parseFloat(e.target.value))} className="w-full" />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <Toggle label="Fecha" on={d.showDate} set={(v) => set('showDate', v)} />
            <Toggle label="Banderas" on={d.showFlags} set={(v) => set('showFlags', v)} />
            <Toggle label="WhatsApp" on={d.showWhatsapp} set={(v) => set('showWhatsapp', v)} />
            <Toggle label="Logo" on={d.showLogo} set={(v) => set('showLogo', v)} />
          </div>
        </section>

        <section className="card p-4">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><ListChecks size={15} className="text-gold-400" /> Tasas que salen en la imagen</p>
          <div className="space-y-1.5">
            {activeRates.map((r) => (
              <Toggle key={r.id} label={`${FLAGS[r.currency_code] ?? ''} ${r.country}`}
                on={!d.ocultas.includes(r.id)}
                set={(v) => set('ocultas', v ? d.ocultas.filter((x) => x !== r.id) : [...d.ocultas, r.id])} />
            ))}
          </div>
        </section>

        <button onClick={() => setD(DISENO_INICIAL)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-white/50 transition hover:bg-white/[.04] hover:text-white/80">
          <RotateCcw size={14} /> Volver al diseño de fábrica
        </button>
      </div>
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-xs text-white/50">{label}</label>
      <div className="flex items-center gap-2">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-9 w-12 cursor-pointer rounded-lg border border-white/10 bg-transparent" />
        <span className="font-mono text-xs text-white/40">{value}</span>
      </div>
    </div>
  );
}

function Toggle({ label, on, set }: { label: string; on: boolean; set: (v: boolean) => void }) {
  return (
    <button onClick={() => set(!on)}
      className={`flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left text-sm transition ${on ? 'bg-green-500/10 text-white' : 'bg-white/[.03] text-white/40'}`}>
      <span>{label}</span>
      <span className={`h-4 w-8 rounded-full transition ${on ? 'bg-green-400/80' : 'bg-white/15'} relative`}>
        <span className="absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all" style={{ left: on ? 18 : 2 }} />
      </span>
    </button>
  );
}
