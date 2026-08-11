import { useCallback, useEffect, useState } from 'react';
import {
  Loader2, Save, Upload, ArrowUp, ArrowDown, Power, History,
  X, Calculator, Check, Clock, RefreshCw, LogOut, Eye, ImagePlus, Megaphone, ExternalLink,
  TrendingUp, ClipboardList, Users, Landmark, Settings,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase, type ExchangeRate, type RateHistoryEntry, type SiteSettings, type UserProfile, type UserRole, type Sponsor } from '@/lib/supabase';
import { formatNumber, formatDate, timeAgo } from '@/lib/format';
import { Logo } from '@/components/Logo';
import { RateGraphic } from '@/components/RateGraphic';
import { AdminOrders } from '@/components/AdminOrders';
import { AdminPaymentAccounts } from '@/components/AdminPaymentAccounts';
import { AdminCustomers } from '@/components/AdminCustomers';

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
  const [activeTab, setActiveTab] = useState<'rates' | 'orders' | 'customers' | 'accounts' | 'config'>('rates');

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
    const { error } = await supabase.storage.from('sponsor-banners').upload(path, file, { contentType: file.type, upsert: false });
    if (error) return null;
    const { data } = supabase.storage.from('sponsor-banners').getPublicUrl(path);
    return data.publicUrl;
  };

  const loadRates = useCallback(async () => {
    setLoading(true);
    const [{ data, error }, { data: settingsData }] = await Promise.all([
      supabase.from('exchange_rates').select('*').order('display_order', { ascending: true }),
      supabase.from('site_settings').select('*').eq('id', 'main').maybeSingle(),
    ]);
    setLoading(false);
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

  const handleSave = async (r: ExchangeRate) => {
    const patch = edits[r.id];
    if (!patch) return;
    setSavingId(r.id);
    const update: Record<string, unknown> = { ...patch };
    if (patch.calculation_mode === 'AUTOMATIC') {
      update.rate = computeAutoRate(patch);
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
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token ?? '';
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-create-user`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
        },
        body: JSON.stringify({
          email: userForm.email.trim(),
          password: userForm.password,
          display_name: userForm.display_name.trim(),
          role: userForm.role,
        }),
      });
      const data = await res.json();
      setCreatingUser(false);
      if (!res.ok) {
        setUserMessage((data?.error as string) ?? 'No se pudo crear la cuenta.');
        return;
      }
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
      if (pathMatch) await supabase.storage.from('sponsor-banners').remove([decodeURIComponent(pathMatch[1])]);
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
                              Cálculo automático
                            </p>
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
