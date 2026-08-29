import { useCallback, useEffect, useState } from 'react';
import {
  Loader2, Save, Upload, ArrowUp, ArrowDown, Power, History,
  X, Calculator, Check, Clock, RefreshCw, LogOut, Eye, ImagePlus, Megaphone, ExternalLink,
  TrendingUp, ClipboardList, Users, Landmark, Settings, Coins, Plus, Share2,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase, type ExchangeRate, type RateHistoryEntry, type SiteSettings, type UserProfile, type UserRole, type Sponsor, type UsdtReferencePrice } from '@/lib/supabase';
import { formatNumber, formatDate, timeAgo } from '@/lib/format';
import { Logo } from '@/components/Logo';
import { RateGraphic } from '@/components/RateGraphic';
import { AdminOrders } from '@/components/AdminOrders';
import { AdminPaymentAccounts } from '@/components/AdminPaymentAccounts';
import { AdminCustomers } from '@/components/AdminCustomers';
import { ShareStory } from '@/components/ShareStory';

type EditState = Record<string, Partial<ExchangeRate>>;

export function AdminDashboard() {
  const { user, profile, isSuperadmin, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [edits, setEdits] = useState<EditState>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishMsg, setPublishMsg] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<RateHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [settingsEdit, setSettingsEdit] = useState({ whatsapp_number: '', published_date: '' });
  const [savingSettings, setSavingSettings] = useState(false);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [userForm, setUserForm] = useState({ email: '', password: '', display_name: '', role: 'admin' as UserRole });
  const [userMessage, setUserMessage] = useState<string | null>(null);
  const [creatingUser, setCreatingUser] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [sponsorForm, setSponsorForm] = useState({ title: '', link_url: '', button_label: 'Visitar' });
  const [sponsorFile, setSponsorFile] = useState<File | null>(null);
  const [sponsorPreview, setSponsorPreview] = useState<string | null>(null);
  const [sponsorMsg, setSponsorMsg] = useState<string | null>(null);
  const [savingSponsor, setSavingSponsor] = useState(false);
  const [sponsorsLoading, setSponsorsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'rates' | 'share' | 'orders' | 'customers' | 'accounts' | 'config'>('rates');
  const [refPrices, setRefPrices] = useState<UsdtReferencePrice[]>([]);
  const [refEdits, setRefEdits] = useState<Record<string, string>>({});
  const [refsMissing, setRefsMissing] = useState(false);
  const [savingRefs, setSavingRefs] = useState(false);
  const [refMsg, setRefMsg] = useState<string | null>(null);
  const [newRef, setNewRef] = useState({ code: '', name: '', price: '' });
  const [schedule, setSchedule] = useState<{ mode: string; hour_vzla?: number; minute?: number } | null>(null);
  const [schedEdit, setSchedEdit] = useState({ mode: 'daily', hour: 9, minute: 0 });
  const [savingSched, setSavingSched] = useState(false);
  const [schedMsg, setSchedMsg] = useState<string | null>(null);
  const [marginEdits, setMarginEdits] = useState<Record<string, string>>({});
  const [savingMargins, setSavingMargins] = useState(false);

  const handleSponsorFile = (file: File | null) => {
    if (!file) { setSponsorFile(null); setSponsorPreview(null); return; }
    if (!file.type.startsWith('image/')) { setSponsorMsg('Solo se permiten archivos de imagen.'); return; }
    if (file.size > 5 * 1024 * 1024) { setSponsorMsg('La imagen no puede pesar más de 5 MB.'); return; }
    setSponsorFile(file);
    setSponsorMsg(null);
    setSponsorPreview(URL.createObjectURL(file));
  };

  const uploadSponsorImage = async (file: File): Promise<string | null> => {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
    const path = `banners/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from('bj-sponsor-banners').upload(path, file, { contentType: file.type, upsert: false });
    if (error) return null;
    const { data } = supabase.storage.from('bj-sponsor-banners').getPublicUrl(path);
    return data.publicUrl;
  };

  const loadRates = useCallback(async () => {
    setLoading(true);
    const [{ data, error }, { data: settingsData }, refsRes] = await Promise.all([
      supabase.from('exchange_rates').select('*').order('display_order', { ascending: true }),
      supabase.from('site_settings').select('*').eq('id', 'main').maybeSingle(),
      supabase.from('usdt_reference_prices').select('*').order('currency_code', { ascending: true }),
    ]);
    setLoading(false);
    if (refsRes.error) {
      setRefsMissing(true);
    } else {
      setRefsMissing(false);
      setRefPrices((refsRes.data as UsdtReferencePrice[]) ?? []);
      setRefEdits({});
    }
    if (error) return;
    setRates(data as ExchangeRate[]);
    if (settingsData) {
      const nextSettings = settingsData as SiteSettings;
      setSettings(nextSettings);
      setSettingsEdit({ whatsapp_number: nextSettings.whatsapp_number, published_date: nextSettings.published_date });
    }
  }, []);

  const loadUsers = useCallback(async () => {
    if (!isSuperadmin) return;
    setUsersLoading(true);
    const { data } = await supabase.from('user_profiles').select('*').order('created_at', { ascending: false });
    setProfiles((data as UserProfile[]) ?? []);
    setUsersLoading(false);
  }, [isSuperadmin]);

  useEffect(() => {
    if (!authLoading && (!user || profile?.role === 'user')) {
      navigate('/admin/login');
      return;
    }
    if (user) loadRates();
  }, [user, profile, authLoading, navigate, loadRates]);

  useEffect(() => {
    if (isSuperadmin) loadUsers();
  }, [isSuperadmin, loadUsers]);

  const loadSponsors = useCallback(async () => {
    if (!isSuperadmin) return;
    setSponsorsLoading(true);
    const { data } = await supabase.from('sponsors').select('*').order('display_order', { ascending: true });
    setSponsors((data as Sponsor[]) ?? []);
    setSponsorsLoading(false);
  }, [isSuperadmin]);

  useEffect(() => {
    if (isSuperadmin) loadSponsors();
  }, [isSuperadmin, loadSponsors]);

  const getEdit = (r: ExchangeRate): Partial<ExchangeRate> => edits[r.id] ?? {};

  const setEdit = (id: string, patch: Partial<ExchangeRate>) => {
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const getEffective = (r: ExchangeRate): ExchangeRate => ({ ...r, ...edits[r.id] });

  const computeAutoRate = (r: Partial<ExchangeRate>): number => {
    const usdt = Number(r.usdt_base_price) || 0;
    const ref = Number(r.currency_reference_price) || 0;
    const margin = Number(r.margin_percentage) || 0;
    if (usdt <= 0 || ref <= 0) return 0;
    return (usdt / ref) * (1 + margin / 100);
  };

  const getRefPrice = (code: string | null | undefined): number => {
    if (!code) return 0;
    const edited = refEdits[code];
    if (edited !== undefined) return parseFloat(edited) || 0;
    return Number(refPrices.find((p) => p.currency_code === code)?.usdt_price) || 0;
  };

  const handleSave = async (r: ExchangeRate) => {
    const patch = edits[r.id];
    if (!patch) return;
    setSavingId(r.id);
    const update: Record<string, unknown> = { ...patch };
    const merged = { ...r, ...patch };
    if (merged.calculation_mode === 'AUTOMATIC') {
      update.rate = computeAutoRate(merged);
    }
    const { error } = await supabase
      .from('exchange_rates')
      .update(update)
      .eq('id', r.id);
    setSavingId(null);
    if (error) {
      setPublishMsg('Error al guardar: ' + error.message);
      return;
    }
    setEdits((prev) => {
      const next = { ...prev };
      delete next[r.id];
      return next;
    });
    setEditingId(null);
    await loadRates();
  };

  const handleSaveRefsAndRecalc = async () => {
    setSavingRefs(true);
    setRefMsg(null);

    // 1. Guardar los precios editados
    const upserts = refPrices.map((p) => ({
      currency_code: p.currency_code,
      display_name: p.display_name,
      auto_update: p.auto_update,
      usdt_price: refEdits[p.currency_code] !== undefined ? parseFloat(refEdits[p.currency_code]) || 0 : p.usdt_price,
    }));
    const { error: upsertError } = await supabase.from('usdt_reference_prices').upsert(upserts);
    if (upsertError) {
      setSavingRefs(false);
      setRefMsg('Error al guardar precios: ' + upsertError.message);
      return;
    }

    // 2. Recalcular todas las tasas automáticas enlazadas a estos precios
    const priceOf = (code: string | null) =>
      Number(upserts.find((p) => p.currency_code === code)?.usdt_price) || 0;
    let recalced = 0;
    for (const r of rates) {
      if (r.calculation_mode !== 'AUTOMATIC' || !r.auto_base_currency || !r.auto_quote_currency) continue;
      const base = priceOf(r.auto_base_currency);
      const quote = priceOf(r.auto_quote_currency);
      if (base <= 0 || quote <= 0) continue;
      const margin = Number(r.margin_percentage) || 0;
      const newRate = (base / quote) * (1 + margin / 100);
      const { error } = await supabase
        .from('exchange_rates')
        .update({ usdt_base_price: base, currency_reference_price: quote, rate: newRate })
        .eq('id', r.id);
      if (!error) recalced++;
    }

    setSavingRefs(false);
    setRefMsg(`Precios guardados. ${recalced} tasa${recalced === 1 ? '' : 's'} automática${recalced === 1 ? '' : 's'} recalculada${recalced === 1 ? '' : 's'}. Recuerda "Publicar Tasas" para que se vean en la página.`);
    await loadRates();
  };

  const handleFetchBinanceNow = async () => {
    setSavingRefs(true);
    setRefMsg(null);
    const { data, error } = await supabase.rpc('update_binance_rates');
    setSavingRefs(false);
    if (error) {
      setRefMsg('Error al consultar Binance: ' + error.message);
      return;
    }
    const res = data as { updated_prices?: number; recalced_rates?: number } | null;
    setRefMsg(`Binance consultado: ${res?.updated_prices ?? 0} precios actualizados, ${res?.recalced_rates ?? 0} tasas recalculadas y publicadas.`);
    await loadRates();
  };

  const handleToggleAutoUpdate = async (p: UsdtReferencePrice) => {
    const newVal = !p.auto_update;
    setRefPrices((prev) => prev.map((x) => (x.currency_code === p.currency_code ? { ...x, auto_update: newVal } : x)));
    await supabase.from('usdt_reference_prices').update({ auto_update: newVal }).eq('currency_code', p.currency_code);
  };

  const handleAddRef = async () => {
    const code = newRef.code.trim().toUpperCase();
    const price = parseFloat(newRef.price) || 0;
    if (!code) return;
    const { error } = await supabase.from('usdt_reference_prices').upsert({
      currency_code: code,
      display_name: newRef.name.trim() || code,
      usdt_price: price,
    });
    if (error) {
      setRefMsg('Error al agregar la moneda: ' + error.message);
      return;
    }
    setNewRef({ code: '', name: '', price: '' });
    await loadRates();
  };

  const loadSchedule = useCallback(async () => {
    const { data } = await supabase.rpc('get_binance_schedule');
    const s = data as { mode: string; hour_vzla?: number; minute?: number } | null;
    if (s) {
      setSchedule(s);
      setSchedEdit({ mode: s.mode, hour: s.hour_vzla ?? 9, minute: s.minute ?? 0 });
    }
  }, []);

  useEffect(() => {
    if (isSuperadmin) loadSchedule();
  }, [isSuperadmin, loadSchedule]);

  const handleSaveSchedule = async () => {
    setSavingSched(true);
    setSchedMsg(null);
    const { data, error } = await supabase.rpc('set_binance_schedule', {
      p_mode: schedEdit.mode,
      p_hour_vzla: schedEdit.hour,
      p_minute: schedEdit.minute,
    });
    setSavingSched(false);
    if (error) {
      setSchedMsg('Error: ' + error.message);
      return;
    }
    setSchedule(data as typeof schedule);
    setSchedMsg('Automatización guardada.');
    setTimeout(() => setSchedMsg(null), 3500);
  };

  const handleSaveMargins = async () => {
    setSavingMargins(true);
    setSchedMsg(null);
    for (const [id, val] of Object.entries(marginEdits)) {
      const m = parseFloat(val);
      if (Number.isNaN(m)) continue;
      await supabase.from('exchange_rates').update({ margin_percentage: m }).eq('id', id);
    }
    // Recalcular y publicar con los márgenes nuevos y los últimos precios
    const { error } = await supabase.rpc('update_binance_rates');
    setSavingMargins(false);
    setMarginEdits({});
    setSchedMsg(error ? 'Márgenes guardados, pero falló el recálculo: ' + error.message : 'Márgenes guardados y tasas recalculadas.');
    await loadRates();
    setTimeout(() => setSchedMsg(null), 4000);
  };

  const handleSaveSettings = async () => {
    if (!settings) return;
    setSavingSettings(true);
    setPublishMsg(null);
    const { data, error } = await supabase
      .from('site_settings')
      .update({ whatsapp_number: settingsEdit.whatsapp_number.replace(/\D/g, ''), published_date: settingsEdit.published_date })
      .eq('id', 'main')
      .select()
      .maybeSingle();
    setSavingSettings(false);
    if (error || !data) {
      setPublishMsg('Error al guardar la configuración pública.');
      return;
    }
    setSettings(data as SiteSettings);
    setPublishMsg('Configuración pública guardada.');
    setTimeout(() => setPublishMsg(null), 3500);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingUser(true);
    setUserMessage(null);
    try {
      // Cliente aparte para no reemplazar la sesión del superadmin al registrar
      const { createClient } = await import('@supabase/supabase-js');
      const temp = createClient(
        import.meta.env.VITE_SUPABASE_URL as string,
        import.meta.env.VITE_SUPABASE_ANON_KEY as string,
        { auth: { persistSession: false }, db: { schema: 'bitjhoins' } },
      );
      const email = userForm.email.trim().toLowerCase();
      const { data, error } = await temp.auth.signUp({
        email,
        password: userForm.password,
        options: { data: { display_name: userForm.display_name.trim(), app_origin: 'bitjhoins' } },
      });
      if (error || !data.user) {
        setCreatingUser(false);
        setUserMessage(error?.message?.includes('already') || error?.message?.includes('registered')
          ? 'Ya existe una cuenta con ese correo.'
          : 'No se pudo crear la cuenta.');
        return;
      }
      if (!data.session) {
        await temp.auth.signInWithPassword({ email, password: userForm.password });
      }
      await temp.from('user_profiles').insert({
        user_id: data.user.id,
        email,
        display_name: userForm.display_name.trim(),
        role: 'user',
      });
      if (userForm.role !== 'user') {
        // Subir el rol lo hace el superadmin con su propia sesión
        await supabase.rpc('admin_update_user_role', { p_user_id: data.user.id, p_role: userForm.role });
      }
      setCreatingUser(false);
      setUserForm({ email: '', password: '', display_name: '', role: 'admin' });
      setUserMessage('Cuenta creada correctamente.');
      await loadUsers();
    } catch {
      setCreatingUser(false);
      setUserMessage('No se pudo crear la cuenta. Intenta nuevamente.');
    }
  };

  const handleRoleChange = async (member: UserProfile, role: UserRole) => {
    const { error } = await supabase.rpc('admin_update_user_role', { p_user_id: member.user_id, p_role: role });
    if (error) {
      setUserMessage('No se pudo cambiar el rol.');
      return;
    }
    await loadUsers();
  };

  const handleDeleteUser = async (member: UserProfile) => {
    if (member.user_id === user?.id || !window.confirm(`¿Eliminar la cuenta de ${member.email}?`)) return;
    const { error } = await supabase.rpc('admin_delete_user', { p_user_id: member.user_id });
    if (error) {
      setUserMessage('No se pudo eliminar la cuenta.');
      return;
    }
    await loadUsers();
  };

  const handleAddSponsor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sponsorFile) { setSponsorMsg('Debes subir una imagen para el banner.'); return; }
    setSavingSponsor(true);
    setSponsorMsg(null);
    const imageUrl = await uploadSponsorImage(sponsorFile);
    if (!imageUrl) {
      setSavingSponsor(false);
      setSponsorMsg('No se pudo subir la imagen. Inténtalo nuevamente.');
      return;
    }
    const { error } = await supabase.from('sponsors').insert({
      title: sponsorForm.title.trim(),
      image_url: imageUrl,
      link_url: sponsorForm.link_url.trim(),
      button_label: sponsorForm.button_label.trim() || 'Visitar',
      active: true,
      display_order: sponsors.length,
    });
    setSavingSponsor(false);
    if (error) {
      setSponsorMsg('No se pudo guardar el banner.');
      return;
    }
    setSponsorForm({ title: '', link_url: '', button_label: 'Visitar' });
    setSponsorFile(null);
    setSponsorPreview(null);
    setSponsorMsg('Banner agregado correctamente.');
    await loadSponsors();
  };

  const handleSponsorToggle = async (s: Sponsor) => {
    await supabase.from('sponsors').update({ active: !s.active }).eq('id', s.id);
    await loadSponsors();
  };

  const handleSponsorReorder = async (s: Sponsor, direction: 'up' | 'down') => {
    const idx = sponsors.findIndex((x) => x.id === s.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sponsors.length) return;
    const other = sponsors[swapIdx];
    await Promise.all([
      supabase.from('sponsors').update({ display_order: other.display_order }).eq('id', s.id),
      supabase.from('sponsors').update({ display_order: s.display_order }).eq('id', other.id),
    ]);
    await loadSponsors();
  };

  const handleDeleteSponsor = async (s: Sponsor) => {
    if (!window.confirm(`¿Eliminar el banner "${s.title}"?`)) return;
    try {
      const url = new URL(s.image_url);
      const pathMatch = url.pathname.match(/\/sponsor-banners\/(.+)$/);
      if (pathMatch) await supabase.storage.from('bj-sponsor-banners').remove([decodeURIComponent(pathMatch[1])]);
    } catch { /* not a storage URL, ignore */ }
    await supabase.from('sponsors').delete().eq('id', s.id);
    await loadSponsors();
  };

  const handleToggleActive = async (r: ExchangeRate) => {
    const newVal = !r.active;
    setRates((prev) => prev.map((x) => (x.id === r.id ? { ...x, active: newVal } : x)));
    await supabase.from('exchange_rates').update({ active: newVal }).eq('id', r.id);
  };

  const handleReorder = async (r: ExchangeRate, direction: 'up' | 'down') => {
    const sorted = [...rates].sort((a, b) => a.display_order - b.display_order);
    const idx = sorted.findIndex((x) => x.id === r.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const a = sorted[idx];
    const b = sorted[swapIdx];
    const updates = [
      supabase.from('exchange_rates').update({ display_order: b.display_order }).eq('id', a.id),
      supabase.from('exchange_rates').update({ display_order: a.display_order }).eq('id', b.id),
    ];
    await Promise.all(updates);
    await loadRates();
  };

  const handlePublish = async () => {
    setPublishing(true);
    setPublishMsg(null);
    const publishId = crypto.randomUUID();
    const publishedBy = user?.email ?? 'admin';
    const now = new Date().toISOString();

    const { error: updateError } = await supabase
      .from('exchange_rates')
      .update({ published_at: now })
      .in('id', rates.map((r) => r.id));

    if (updateError) {
      setPublishing(false);
      setPublishMsg('Error al publicar: ' + updateError.message);
      return;
    }

    const snapshots = rates.map((r) => ({
      publish_id: publishId,
      currency_code: r.currency_code,
      display_name: r.display_name,
      rate: r.rate,
      calculation_type: r.calculation_type,
      published_at: now,
      published_by: publishedBy,
      snapshot: r as unknown as Record<string, unknown>,
    }));

    const { error: historyError } = await supabase.from('rate_history').insert(snapshots);
    setPublishing(false);

    if (historyError) {
      setPublishMsg('Error al guardar historial: ' + historyError.message);
      return;
    }

    setPublishMsg('Tasas publicadas correctamente. Página pública actualizada.');
    await loadRates();
    setTimeout(() => setPublishMsg(null), 4000);
  };

  const loadHistory = async () => {
    setHistoryLoading(true);
    const { data } = await supabase
      .from('rate_history')
      .select('*')
      .order('published_at', { ascending: false })
      .limit(120);
    setHistoryLoading(false);
    setHistory((data as RateHistoryEntry[]) ?? []);
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-navy-950">
        <Loader2 size={32} className="animate-spin text-electric-400" />
      </div>
    );
  }

  const activeCount = rates.filter((r) => r.active).length;
  const lastPublished = rates.find((r) => r.published_at)?.published_at;

  return (
    <div className="min-h-screen bg-navy-950">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-navy-950/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-4">
            <Logo size="sm" />
            <span className="badge bg-electric-500/15 text-electric-300">Admin</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/tasas')} className="btn-ghost text-sm">
              <Eye size={16} /> Ver página
            </button>
            <button onClick={() => signOut()} className="btn-ghost text-sm">
              <LogOut size={16} /> Salir
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        {/* Tabs */}
        <div className="mb-6 flex flex-wrap gap-1.5 rounded-2xl border border-white/10 bg-navy-900/50 p-1.5">
          <TabButton active={activeTab === 'rates'} onClick={() => setActiveTab('rates')} icon={<TrendingUp size={17} />} label="Tasas de cambio" />
          <TabButton active={activeTab === 'share'} onClick={() => setActiveTab('share')} icon={<Share2 size={17} />} label="Compartir tasa" />
          <TabButton active={activeTab === 'orders'} onClick={() => setActiveTab('orders')} icon={<ClipboardList size={17} />} label="Órdenes de cambio" />
          <TabButton active={activeTab === 'customers'} onClick={() => setActiveTab('customers')} icon={<Users size={17} />} label="Clientes registrados" />
          <TabButton active={activeTab === 'accounts'} onClick={() => setActiveTab('accounts')} icon={<Landmark size={17} />} label="Cuentas de pago" />
          {isSuperadmin && <TabButton active={activeTab === 'config'} onClick={() => setActiveTab('config')} icon={<Settings size={17} />} label="Configuración" />}
        </div>

        {activeTab === 'rates' && (
          <>
        {/* Stats row */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Monedas totales" value={String(rates.length)} icon={<Calculator size={18} />} />
          <StatCard label="Monedas activas" value={String(activeCount)} icon={<Power size={18} />} />
          <StatCard label="Última publicación" value={lastPublished ? timeAgo(lastPublished) : 'Sin publicar'} icon={<Clock size={18} />} />
          <StatCard label="Cambios sin guardar" value={String(Object.keys(edits).length)} icon={<Save size={18} />} />
        </div>

        {/* Action bar */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold">Gestión de Tasas</h1>
            <p className="text-sm text-white/50">Edita, reorganiza y publica las tasas del día</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => { setShowHistory(true); loadHistory(); }} className="btn-ghost">
              <History size={16} /> Historial
            </button>
            <button onClick={loadRates} className="btn-ghost">
              <RefreshCw size={16} /> Refrescar
            </button>
            <button onClick={handlePublish} disabled={publishing} className="btn-gold">
              {publishing ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
              Publicar Tasas
            </button>
          </div>
        </div>

        {publishMsg && (
          <div className={`mb-4 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${
            publishMsg.includes('Error')
              ? 'border-red-500/30 bg-red-500/10 text-red-300'
              : 'border-green-500/30 bg-green-500/10 text-green-300'
          }`}>
            {publishMsg.includes('Error') ? <X size={16} /> : <Check size={16} />}
            {publishMsg}
          </div>
        )}

        {/* Precios USDT de referencia (Binance) */}
        <section className="card mb-6 p-5">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold-400/15">
                <Coins size={20} className="text-gold-400" />
              </div>
              <div>
                <h2 className="font-display text-lg font-bold">Precios USDT de referencia (Binance)</h2>
                <p className="text-sm text-white/50">
                  Los precios se traen solos de Binance P2P cada día a las 9:00 a. m. (hora Venezuela) y las tasas automáticas se recalculan y publican con su margen. También puedes corregir un precio a mano o actualizar al instante.
                </p>
              </div>
            </div>
            {!refsMissing && (
              <div className="flex flex-wrap gap-2">
                <button onClick={handleFetchBinanceNow} disabled={savingRefs} className="btn-gold">
                  {savingRefs ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                  Actualizar desde Binance ahora
                </button>
                <button onClick={handleSaveRefsAndRecalc} disabled={savingRefs} className="btn-primary">
                  {savingRefs ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  Guardar manual y recalcular
                </button>
              </div>
            )}
          </div>

          {refsMissing ? (
            <p className="rounded-xl border border-gold-400/20 bg-gold-400/5 px-4 py-3 text-sm text-gold-300">
              Falta crear la tabla de precios en la base de datos (migración <span className="font-mono">add_usdt_reference_prices</span>). Pídele al desarrollador que la aplique.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {refPrices.map((p) => (
                  <div key={p.currency_code} className="rounded-xl border border-white/10 bg-white/[.03] p-3">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="font-mono text-sm font-bold text-electric-300">{p.currency_code}</span>
                      <button
                        onClick={() => handleToggleAutoUpdate(p)}
                        className={`rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wide ${
                          p.auto_update
                            ? 'bg-green-500/15 text-green-400'
                            : 'bg-white/5 text-white/30'
                        }`}
                        title={p.auto_update ? 'Se actualiza solo desde Binance cada día a las 9 a.m. (clic para pasar a manual)' : 'Manual (clic para activar Binance automático)'}
                      >
                        {p.auto_update ? 'AUTO' : 'MANUAL'}
                      </button>
                    </div>
                    <input
                      type="number"
                      step="0.0001"
                      className="input-field font-mono"
                      value={refEdits[p.currency_code] ?? String(p.usdt_price)}
                      onChange={(e) => setRefEdits((prev) => ({ ...prev, [p.currency_code]: e.target.value }))}
                    />
                    <div className="mt-1 truncate text-[11px] text-white/30">
                      {p.display_name}{p.updated_at ? ` · ${timeAgo(p.updated_at)}` : ''}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <input className="input-field w-24" placeholder="Código" value={newRef.code} onChange={(e) => setNewRef((p) => ({ ...p, code: e.target.value }))} />
                <input className="input-field w-52" placeholder="Nombre (opcional)" value={newRef.name} onChange={(e) => setNewRef((p) => ({ ...p, name: e.target.value }))} />
                <input type="number" step="0.0001" className="input-field w-32 font-mono" placeholder="Precio" value={newRef.price} onChange={(e) => setNewRef((p) => ({ ...p, price: e.target.value }))} />
                <button onClick={handleAddRef} className="btn-ghost"><Plus size={16} /> Agregar moneda</button>
              </div>
              {refMsg && (
                <p className={`mt-3 rounded-lg border px-3 py-2 text-sm ${refMsg.includes('Error') ? 'border-red-500/30 bg-red-500/10 text-red-300' : 'border-green-500/30 bg-green-500/10 text-green-300'}`}>
                  {refMsg}
                </p>
              )}
            </>
          )}
        </section>

        {/* Rates list */}
        <div className="space-y-3">
          {rates.map((r, idx) => {
            const eff = getEffective(r);
            const isEditing = editingId === r.id;
            const hasEdits = !!edits[r.id];
            const autoRate = eff.calculation_mode === 'AUTOMATIC' ? computeAutoRate(eff) : 0;

            return (
              <div
                key={r.id}
                className={`card overflow-hidden transition-all ${
                  !r.active ? 'opacity-50' : ''
                } ${isEditing ? 'ring-2 ring-electric-400/40' : ''}`}
              >
                <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                  {/* Order controls */}
                  <div className="flex items-center gap-1">
                    <span className="w-6 text-center font-mono text-sm text-white/30">{r.display_order}</span>
                    <div className="flex flex-col">
                      <button
                        onClick={() => handleReorder(r, 'up')}
                        disabled={idx === 0}
                        className="rounded-md p-1 text-white/40 hover:bg-white/10 hover:text-white disabled:opacity-20"
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        onClick={() => handleReorder(r, 'down')}
                        disabled={idx === rates.length - 1}
                        className="rounded-md p-1 text-white/40 hover:bg-white/10 hover:text-white disabled:opacity-20"
                      >
                        <ArrowDown size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex-1">
                    {isEditing ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <Field label="Nombre visible">
                            <input
                              className="input-field"
                              value={eff.display_name}
                              onChange={(e) => setEdit(r.id, { display_name: e.target.value })}
                            />
                          </Field>
                          <Field label="País / Región">
                            <input
                              className="input-field"
                              value={eff.country}
                              onChange={(e) => setEdit(r.id, { country: e.target.value })}
                            />
                          </Field>
                        </div>

                        <div className="flex flex-wrap gap-4">
                          <Field label="Modo de cálculo">
                            <select
                              className="input-field"
                              value={eff.calculation_mode}
                              onChange={(e) => setEdit(r.id, { calculation_mode: e.target.value as 'MANUAL' | 'AUTOMATIC' })}
                            >
                              <option value="MANUAL">MANUAL</option>
                              <option value="AUTOMATIC">AUTOMÁTICO</option>
                            </select>
                          </Field>
                          <Field label="Tipo de cálculo">
                            <select
                              className="input-field"
                              value={eff.calculation_type}
                              onChange={(e) => setEdit(r.id, { calculation_type: e.target.value as 'MULTIPLY' | 'DIVIDE' })}
                            >
                              <option value="MULTIPLY">MULTIPLY</option>
                              <option value="DIVIDE">DIVIDE</option>
                            </select>
                          </Field>
                          <Field label="Decimales">
                            <input
                              type="number"
                              min={0}
                              max={8}
                              className="input-field w-24"
                              value={eff.decimals}
                              onChange={(e) => setEdit(r.id, { decimals: parseInt(e.target.value) || 0 })}
                            />
                          </Field>
                        </div>

                        {eff.calculation_mode === 'AUTOMATIC' && (
                          <div className="rounded-xl border border-electric-400/20 bg-electric-500/5 p-3">
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-electric-300">
                              Cálculo automático — tasa = precio(base) ÷ precio(destino) ± margen
                            </p>
                            {!refsMissing && refPrices.length > 0 && (
                              <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <Field label="Moneda base (Binance)">
                                  <select
                                    className="input-field"
                                    value={eff.auto_base_currency ?? ''}
                                    onChange={(e) => {
                                      const code = e.target.value || null;
                                      setEdit(r.id, { auto_base_currency: code, usdt_base_price: getRefPrice(code) });
                                    }}
                                  >
                                    <option value="">— manual —</option>
                                    {refPrices.map((p) => (
                                      <option key={p.currency_code} value={p.currency_code}>{p.currency_code} · {formatNumber(p.usdt_price, 4)}</option>
                                    ))}
                                  </select>
                                </Field>
                                <Field label="Moneda destino (Binance)">
                                  <select
                                    className="input-field"
                                    value={eff.auto_quote_currency ?? ''}
                                    onChange={(e) => {
                                      const code = e.target.value || null;
                                      setEdit(r.id, { auto_quote_currency: code, currency_reference_price: getRefPrice(code) });
                                    }}
                                  >
                                    <option value="">— manual —</option>
                                    {refPrices.map((p) => (
                                      <option key={p.currency_code} value={p.currency_code}>{p.currency_code} · {formatNumber(p.usdt_price, 4)}</option>
                                    ))}
                                  </select>
                                </Field>
                              </div>
                            )}
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                              <Field label="USDT precio base">
                                <input
                                  type="number"
                                  step="0.01"
                                  className="input-field"
                                  value={eff.usdt_base_price ?? ''}
                                  onChange={(e) => setEdit(r.id, { usdt_base_price: parseFloat(e.target.value) || 0 })}
                                />
                              </Field>
                              <Field label="Precio referencia moneda">
                                <input
                                  type="number"
                                  step="0.01"
                                  className="input-field"
                                  value={eff.currency_reference_price ?? ''}
                                  onChange={(e) => setEdit(r.id, { currency_reference_price: parseFloat(e.target.value) || 0 })}
                                />
                              </Field>
                              <Field label="Margen %">
                                <input
                                  type="number"
                                  step="0.01"
                                  className="input-field"
                                  value={eff.margin_percentage ?? ''}
                                  onChange={(e) => setEdit(r.id, { margin_percentage: parseFloat(e.target.value) || 0 })}
                                />
                              </Field>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-4 text-sm">
                              <span className="text-white/50">
                                Tasa base: <span className="font-mono text-white">{eff.usdt_base_price && eff.currency_reference_price ? formatNumber(eff.usdt_base_price / eff.currency_reference_price, 4) : '—'}</span>
                              </span>
                              <span className="text-white/50">
                                Margen: <span className="font-mono text-white">{eff.margin_percentage ?? 0}%</span>
                              </span>
                              <span className="text-electric-300">
                                Tasa sugerida: <span className="font-mono font-bold">{autoRate ? formatNumber(autoRate, 4) : '—'}</span>
                              </span>
                            </div>
                          </div>
                        )}

                        <Field label="Tasa final publicada">
                          <input
                            type="number"
                            step="0.0001"
                            className="input-field font-mono text-lg"
                            value={eff.rate}
                            onChange={(e) => setEdit(r.id, { rate: parseFloat(e.target.value) || 0 })}
                          />
                        </Field>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-white">{r.display_name}</h3>
                          {hasEdits && <span className="badge bg-gold-400/20 text-gold-300">Sin guardar</span>}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-white/50">
                          <span className="font-mono">{r.currency_code}</span>
                          <span>·</span>
                          <span>{r.country}</span>
                          <span>·</span>
                          <span className="font-mono text-electric-300">{r.calculation_type}</span>
                          <span>·</span>
                          <span>{r.calculation_mode === 'AUTOMATIC' ? 'Automático' : 'Manual'}</span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Rate display */}
                  {!isEditing && (
                    <div className="text-right">
                      <div className="font-mono text-2xl font-bold text-gold-400">
                        {formatNumber(r.rate, r.decimals)}
                      </div>
                      {r.published_at && (
                        <div className="text-xs text-white/30">{timeAgo(r.published_at)}</div>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {isEditing ? (
                      <>
                        <button
                          onClick={() => handleSave(r)}
                          disabled={savingId === r.id}
                          className="btn-primary px-4 py-2 text-sm"
                        >
                          {savingId === r.id ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                          Guardar
                        </button>
                        <button
                          onClick={() => { setEditingId(null); setEdits((prev) => { const n = { ...prev }; delete n[r.id]; return n; }); }}
                          className="btn-ghost px-3 py-2 text-sm"
                        >
                          <X size={16} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => setEditingId(r.id)}
                          className="btn-ghost px-4 py-2 text-sm"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleToggleActive(r)}
                          className={`rounded-lg p-2 transition-colors ${
                            r.active
                              ? 'bg-green-500/15 text-green-400 hover:bg-green-500/25'
                              : 'bg-white/5 text-white/30 hover:bg-white/10'
                          }`}
                          title={r.active ? 'Desactivar' : 'Activar'}
                        >
                          <Power size={16} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
          </>
        )}

        {activeTab === 'share' && <ShareStory rates={rates} settings={settings} onSettingsChange={loadRates} />}

        {activeTab === 'orders' && <AdminOrders />}
        {activeTab === 'customers' && <AdminCustomers />}
        {activeTab === 'accounts' && <AdminPaymentAccounts />}

        {activeTab === 'config' && isSuperadmin && (
          <>
          <section className="card mb-6 p-5">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-bold">Información pública</h2>
                <p className="text-sm text-white/50">Estos datos aparecen en la tarjeta del día y en el botón de WhatsApp.</p>
              </div>
              <span className="badge bg-green-500/15 text-green-300">Visible al público</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <Field label="WhatsApp de contacto">
                <input className="input-field" inputMode="tel" value={settingsEdit.whatsapp_number} onChange={(e) => setSettingsEdit((prev) => ({ ...prev, whatsapp_number: e.target.value }))} placeholder="573024629142" />
              </Field>
              <Field label="Día de la tasa">
                <input type="date" className="input-field" value={settingsEdit.published_date} onChange={(e) => setSettingsEdit((prev) => ({ ...prev, published_date: e.target.value }))} />
              </Field>
              <button onClick={handleSaveSettings} disabled={savingSettings} className="btn-primary h-[46px] px-5">
                {savingSettings ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Guardar datos
              </button>
            </div>
          </section>

          <section className="card mb-6 p-5">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold-400/15">
                  <RefreshCw size={20} className="text-gold-400" />
                </div>
                <div>
                  <h2 className="font-display text-lg font-bold">Automatización de tasas (Binance)</h2>
                  <p className="text-sm text-white/50">Cuándo se consultan los precios de Binance y qué margen se aplica a cada ruta. Todo en hora de Venezuela.</p>
                </div>
              </div>
              <span className="badge bg-gold-400/15 text-gold-300">Superadministrador</span>
            </div>

            <div className="mb-5 grid gap-4 rounded-xl border border-white/10 bg-white/[.03] p-4 sm:grid-cols-[auto_auto_auto_1fr] sm:items-end">
              <Field label="Frecuencia">
                <select className="input-field" value={schedEdit.mode} onChange={(e) => setSchedEdit((p) => ({ ...p, mode: e.target.value }))}>
                  <option value="daily">Una vez al día</option>
                  <option value="hourly">Cada hora</option>
                  <option value="off">Apagada (solo manual)</option>
                </select>
              </Field>
              {schedEdit.mode === 'daily' && (
                <Field label="Hora (Venezuela)">
                  <select className="input-field" value={schedEdit.hour} onChange={(e) => setSchedEdit((p) => ({ ...p, hour: parseInt(e.target.value) }))}>
                    {Array.from({ length: 24 }, (_, h) => (
                      <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
                    ))}
                  </select>
                </Field>
              )}
              {schedEdit.mode !== 'off' && (
                <Field label="Minuto">
                  <select className="input-field" value={schedEdit.minute} onChange={(e) => setSchedEdit((p) => ({ ...p, minute: parseInt(e.target.value) }))}>
                    {[0, 15, 30, 45].map((m) => <option key={m} value={m}>:{String(m).padStart(2, '0')}</option>)}
                  </select>
                </Field>
              )}
              <div className="flex items-end gap-3">
                <button onClick={handleSaveSchedule} disabled={savingSched} className="btn-primary h-[46px] px-5">
                  {savingSched ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Guardar
                </button>
                {schedule && (
                  <span className="pb-3 text-xs text-white/40">
                    Actual: {schedule.mode === 'off' ? 'apagada' : schedule.mode === 'hourly' ? `cada hora al minuto ${schedule.minute ?? 0}` : `diaria a las ${String(schedule.hour_vzla ?? 9).padStart(2, '0')}:${String(schedule.minute ?? 0).padStart(2, '0')} (Vzla)`}
                  </span>
                )}
              </div>
            </div>

            <p className="mb-2 text-sm font-semibold text-white/70">Márgenes por ruta (%)</p>
            <p className="mb-3 text-xs text-white/40">Positivo suma, negativo resta (ej. Colombia +8, Zelle −10). Al guardar se recalculan y publican todas las tasas automáticas.</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {rates.filter((r) => r.calculation_mode === 'AUTOMATIC').map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[.03] px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{r.country}</p>
                    <p className="text-[11px] text-white/35">{r.auto_base_currency} ÷ {r.auto_quote_currency} · tasa {formatNumber(r.rate, r.decimals)}</p>
                  </div>
                  <input
                    type="number"
                    step="0.5"
                    className="input-field w-24 text-right font-mono"
                    value={marginEdits[r.id] ?? String(r.margin_percentage ?? 0)}
                    onChange={(e) => setMarginEdits((prev) => ({ ...prev, [r.id]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-3">
              <button onClick={handleSaveMargins} disabled={savingMargins || Object.keys(marginEdits).length === 0} className="btn-gold">
                {savingMargins ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Guardar márgenes y recalcular
              </button>
              {schedMsg && (
                <span className={`text-sm ${schedMsg.includes('Error') || schedMsg.includes('falló') ? 'text-red-300' : 'text-green-300'}`}>{schedMsg}</span>
              )}
            </div>
          </section>

          <section className="card mb-6 p-5">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-bold">Usuarios y administradores</h2>
                <p className="text-sm text-white/50">Crea cuentas y controla quién puede entrar al panel.</p>
              </div>
              <span className="badge bg-gold-400/15 text-gold-300">Superadministrador</span>
            </div>
            <form onSubmit={handleCreateUser} className="mb-5 grid gap-3 rounded-xl border border-white/10 bg-white/[.03] p-4 sm:grid-cols-2 lg:grid-cols-5">
              <input required type="text" className="input-field" placeholder="Nombre" value={userForm.display_name} onChange={(e) => setUserForm((prev) => ({ ...prev, display_name: e.target.value }))} />
              <input required type="email" className="input-field" placeholder="Correo electrónico" value={userForm.email} onChange={(e) => setUserForm((prev) => ({ ...prev, email: e.target.value }))} />
              <input required minLength={8} type="password" className="input-field" placeholder="Contraseña" value={userForm.password} onChange={(e) => setUserForm((prev) => ({ ...prev, password: e.target.value }))} />
              <select className="input-field" value={userForm.role} onChange={(e) => setUserForm((prev) => ({ ...prev, role: e.target.value as UserRole }))}>
                <option value="admin">Administrador</option>
                <option value="user">Usuario</option>
                <option value="superadmin">Superadministrador</option>
              </select>
              <button disabled={creatingUser} className="btn-primary"><>{creatingUser ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Crear cuenta</></button>
            </form>
            {userMessage && <p className="mb-4 rounded-lg border border-electric-400/20 bg-electric-400/10 px-3 py-2 text-sm text-electric-200">{userMessage}</p>}
            {usersLoading ? <div className="flex justify-center py-5"><Loader2 size={22} className="animate-spin text-electric-400" /></div> : <div className="space-y-2">
              {profiles.map((member) => <div key={member.user_id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[.03] px-3 py-3">
                <div><p className="font-medium">{member.display_name || 'Sin nombre'}</p><p className="text-xs text-white/45">{member.email}</p></div>
                <div className="flex items-center gap-2"><select disabled={member.user_id === user?.id} className="input-field h-9 py-1 text-xs" value={member.role} onChange={(e) => handleRoleChange(member, e.target.value as UserRole)}><option value="admin">Administrador</option><option value="user">Usuario</option><option value="superadmin">Superadministrador</option></select><button disabled={member.user_id === user?.id} onClick={() => handleDeleteUser(member)} className="rounded-lg p-2 text-red-300/70 hover:bg-red-500/10 hover:text-red-300" title="Eliminar cuenta"><X size={16} /></button></div>
              </div>)}
            </div>}
          </section>

          <section className="card mb-6 p-5">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-bold">Patrocinados</h2>
                <p className="text-sm text-white/50">Banners publicitarios de terceros que aparecen como carrusel en la página principal.</p>
              </div>
              <span className="badge bg-gold-400/15 text-gold-300">Superadministrador</span>
            </div>
            <form onSubmit={handleAddSponsor} className="mb-5 space-y-3 rounded-xl border border-white/10 bg-white/[.03] p-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <input required type="text" className="input-field" placeholder="Nombre del patrocinador" value={sponsorForm.title} onChange={(e) => setSponsorForm((prev) => ({ ...prev, title: e.target.value }))} />
                <input required type="url" className="input-field" placeholder="URL de destino (link)" value={sponsorForm.link_url} onChange={(e) => setSponsorForm((prev) => ({ ...prev, link_url: e.target.value }))} />
                <input type="text" className="input-field" placeholder="Texto del botón" value={sponsorForm.button_label} onChange={(e) => setSponsorForm((prev) => ({ ...prev, button_label: e.target.value }))} />
                <label className="input-field flex cursor-pointer items-center gap-2 hover:border-electric-400/50">
                  <Upload size={16} className="shrink-0 text-electric-400" />
                  <span className="truncate text-sm text-white/60">{sponsorFile ? sponsorFile.name : 'Subir imagen del banner'}</span>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleSponsorFile(e.target.files?.[0] ?? null)} />
                </label>
              </div>
              {sponsorPreview && (
                <div className="relative inline-block overflow-hidden rounded-xl border border-white/10">
                  <img src={sponsorPreview} alt="Vista previa" className="h-28 w-full max-w-sm object-cover" />
                  <button type="button" onClick={() => { setSponsorFile(null); setSponsorPreview(null); }} className="absolute right-2 top-2 rounded-full bg-[#020819]/80 p-1.5 text-white/80 hover:text-white"><X size={14} /></button>
                </div>
              )}
              <button disabled={savingSponsor} className="btn-primary"><>{savingSponsor ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />} Agregar banner</></button>
            </form>
            {sponsorMsg && <p className="mb-4 rounded-lg border border-electric-400/20 bg-electric-400/10 px-3 py-2 text-sm text-electric-200">{sponsorMsg}</p>}
            {sponsorsLoading ? <div className="flex justify-center py-5"><Loader2 size={22} className="animate-spin text-electric-400" /></div> : sponsors.length === 0 ? <p className="py-6 text-center text-sm text-white/40">No hay banners agregados todavía.</p> : <div className="space-y-2">
              {sponsors.map((s, idx) => <div key={s.id} className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[.03] px-3 py-3 ${!s.active ? 'opacity-50' : ''}`}>
                <div className="flex items-center gap-3"><div className="flex flex-col"><button onClick={() => handleSponsorReorder(s, 'up')} disabled={idx === 0} className="rounded-md p-1 text-white/40 hover:bg-white/10 hover:text-white disabled:opacity-20"><ArrowUp size={14} /></button><button onClick={() => handleSponsorReorder(s, 'down')} disabled={idx === sponsors.length - 1} className="rounded-md p-1 text-white/40 hover:bg-white/10 hover:text-white disabled:opacity-20"><ArrowDown size={14} /></button></div><div className="h-12 w-20 overflow-hidden rounded-lg bg-white/5"><img src={s.image_url} alt={s.title} className="h-full w-full object-cover" /></div><div><p className="font-medium">{s.title}</p><p className="text-xs text-white/45 truncate max-w-[14rem]">{s.link_url}</p></div></div>
                <div className="flex items-center gap-2"><button onClick={() => handleSponsorToggle(s)} className={`rounded-lg p-2 transition-colors ${s.active ? 'bg-green-500/15 text-green-400 hover:bg-green-500/25' : 'bg-white/5 text-white/30 hover:bg-white/10'}`} title={s.active ? 'Desactivar' : 'Activar'}><Power size={16} /></button><button onClick={() => handleDeleteSponsor(s)} className="rounded-lg p-2 text-red-300/70 hover:bg-red-500/10 hover:text-red-300" title="Eliminar banner"><X size={16} /></button></div>
              </div>)}
            </div>}
          </section>
          </>
        )}
      </main>

      {/* History modal */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm" onClick={() => setShowHistory(false)}>
          <div className="card my-8 w-full max-w-4xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-xl font-bold">Historial de Tasas</h2>
              <button onClick={() => setShowHistory(false)} className="btn-ghost px-3 py-2">
                <X size={18} />
              </button>
            </div>
            {historyLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 size={24} className="animate-spin text-electric-400" />
              </div>
            ) : history.length === 0 ? (
              <p className="py-8 text-center text-white/40">No hay historial de publicaciones aún.</p>
            ) : (
              <div className="space-y-4">
                {Object.entries(
                  history.reduce<Record<string, RateHistoryEntry[]>>((acc, h) => {
                    (acc[h.publish_id] ??= []).push(h);
                    return acc;
                  }, {})
                ).slice(0, 20).map(([pid, entries]) => (
                  <div key={pid} className="rounded-xl border border-white/10 bg-navy-900/40 p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-semibold text-electric-300">
                        {formatDate(entries[0].published_at)}
                      </span>
                      <span className="text-xs text-white/40">por {entries[0].published_by ?? 'admin'}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                      {entries.map((e) => (
                        <div key={e.id} className="flex justify-between rounded-lg bg-white/5 px-3 py-1.5">
                          <span className="text-white/50">{e.currency_code}</span>
                          <span className="font-mono text-gold-400">{formatNumber(e.rate, 4)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="card p-4">
      <div className="mb-1 flex items-center gap-2 text-white/40">{icon}<span className="text-xs">{label}</span></div>
      <div className="font-display text-lg font-bold">{value}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-white/50">{label}</label>
      {children}
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
        active
          ? 'bg-electric-500/15 text-electric-300 shadow-sm ring-1 ring-electric-400/30'
          : 'text-white/50 hover:bg-white/5 hover:text-white/80'
      }`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
