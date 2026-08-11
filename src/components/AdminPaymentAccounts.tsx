import { useEffect, useState, useCallback } from 'react';
import {
  Loader2, Plus, X, Check, Power, ArrowUp, ArrowDown, Landmark, Copy,
} from 'lucide-react';
import { supabase, type PaymentAccount, type ExchangeRate } from '@/lib/supabase';

export function AdminPaymentAccounts() {
  const [accounts, setAccounts] = useState<PaymentAccount[]>([]);
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [form, setForm] = useState({
    currency: '',
    bank_name: '',
    account_holder: '',
    account_number: '',
    account_type: 'Ahorros',
    document_id: '',
    phone: '',
    payment_method: 'Transferencia',
    active: true,
  });

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: acctData, error: acctErr }, { data: rateData }] = await Promise.all([
      supabase.from('payment_accounts').select('*').order('currency', { ascending: true }).order('display_order', { ascending: true }),
      supabase.from('exchange_rates').select('*').order('display_order', { ascending: true }),
    ]);
    setLoading(false);
    if (acctErr) { setError('No se pudieron cargar las cuentas.'); return; }
    setAccounts((acctData as PaymentAccount[]) ?? []);
    setRates((rateData as ExchangeRate[]) ?? []);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const currencies = Array.from(new Set(rates.map((r) => r.currency_code))).sort();

  const resetForm = () => {
    setForm({
      currency: '', bank_name: '', account_holder: '', account_number: '',
      account_type: 'Ahorros', document_id: '', phone: '', payment_method: 'Transferencia', active: true,
    });
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMsg(null);

    if (!form.currency || !form.bank_name || !form.account_holder || !form.account_number || !form.document_id) {
      setError('Completa todos los campos obligatorios.');
      return;
    }

    if (editingId) {
      const { error: updErr } = await supabase.from('payment_accounts').update({
        ...form,
        phone: form.phone || null,
        updated_at: new Date().toISOString(),
      }).eq('id', editingId);
      if (updErr) { setError('No se pudo actualizar la cuenta.'); return; }
      setMsg('Cuenta actualizada.');
    } else {
      const { error: insErr } = await supabase.from('payment_accounts').insert({
        ...form,
        phone: form.phone || null,
      });
      if (insErr) { setError('No se pudo crear la cuenta.'); return; }
      setMsg('Cuenta creada.');
    }
    resetForm();
    void load();
  };

  const handleEdit = (a: PaymentAccount) => {
    setEditingId(a.id);
    setShowForm(true);
    setForm({
      currency: a.currency,
      bank_name: a.bank_name,
      account_holder: a.account_holder,
      account_number: a.account_number,
      account_type: a.account_type,
      document_id: a.document_id,
      phone: a.phone ?? '',
      payment_method: a.payment_method,
      active: a.active,
    });
  };

  const handleToggle = async (a: PaymentAccount) => {
    await supabase.from('payment_accounts').update({ active: !a.active }).eq('id', a.id);
    void load();
  };

  const handleDelete = async (a: PaymentAccount) => {
    await supabase.from('payment_accounts').delete().eq('id', a.id);
    void load();
  };

  const handleReorder = async (a: PaymentAccount, dir: 'up' | 'down') => {
    const sameCurrency = accounts.filter((x) => x.currency === a.currency);
    const idx = sameCurrency.findIndex((x) => x.id === a.id);
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sameCurrency.length) return;
    const swapWith = sameCurrency[swapIdx];
    await Promise.all([
      supabase.from('payment_accounts').update({ display_order: swapWith.display_order }).eq('id', a.id),
      supabase.from('payment_accounts').update({ display_order: a.display_order }).eq('id', swapWith.id),
    ]);
    void load();
  };

  const groupedByCurrency = accounts.reduce((acc, a) => {
    (acc[a.currency] ??= []).push(a);
    return acc;
  }, {} as Record<string, PaymentAccount[]>);

  return (
    <section className="card mb-6 p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold">Cuentas de pago</h2>
          <p className="text-sm text-white/50">Configura las cuentas donde los clientes envían su dinero, agrupadas por moneda</p>
        </div>
        {!showForm && (
          <button onClick={() => { setShowForm(true); setEditingId(null); }} className="btn-primary text-sm">
            <Plus size={16} /> Agregar cuenta
          </button>
        )}
      </div>

      {msg && <div className="mb-3 rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm text-green-300">{msg}</div>}
      {error && <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>}

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-5 space-y-3 rounded-xl border border-electric-400/20 bg-white/[.03] p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold">{editingId ? 'Editar cuenta' : 'Nueva cuenta'}</h3>
            <button type="button" onClick={resetForm} className="rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white"><X size={16} /></button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-white/50">Moneda *</label>
              <select required className="input-field" value={form.currency} onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value }))}>
                <option value="">Seleccionar...</option>
                {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
                {currencies.length === 0 && <option value="_none">Sin monedas configuradas</option>}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-white/50">Método de pago *</label>
              <select className="input-field" value={form.payment_method} onChange={(e) => setForm((p) => ({ ...p, payment_method: e.target.value }))}>
                <option value="Transferencia">Transferencia</option>
                <option value="Pago Móvil">Pago Móvil</option>
                <option value="Nequi">Nequi</option>
                <option value="Daviplata">Daviplata</option>
                <option value="Zelle">Zelle</option>
                <option value="PayPal">PayPal</option>
                <option value="Binance">Binance</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-white/50">Banco *</label>
              <input required className="input-field" value={form.bank_name} onChange={(e) => setForm((p) => ({ ...p, bank_name: e.target.value }))} placeholder="Banco de Venezuela" />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-white/50">Titular *</label>
              <input required className="input-field" value={form.account_holder} onChange={(e) => setForm((p) => ({ ...p, account_holder: e.target.value }))} placeholder="BitJhoins C.A." />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-white/50">Documento (CI/RIF) *</label>
              <input required className="input-field" value={form.document_id} onChange={(e) => setForm((p) => ({ ...p, document_id: e.target.value }))} placeholder="J-12345678-9" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-white/50">Tipo de cuenta</label>
              <select className="input-field" value={form.account_type} onChange={(e) => setForm((p) => ({ ...p, account_type: e.target.value }))}>
                <option value="Ahorros">Ahorros</option>
                <option value="Corriente">Corriente</option>
              </select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-white/50">Número de cuenta *</label>
              <input required className="input-field font-mono" value={form.account_number} onChange={(e) => setForm((p) => ({ ...p, account_number: e.target.value }))} placeholder="0102-0000-00-0000000000" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-white/50">Teléfono</label>
              <input className="input-field font-mono" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} placeholder="0414-1234567" />
            </div>
            <div className="flex items-end">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-white/60">
                <input type="checkbox" checked={form.active} onChange={(e) => setForm((p) => ({ ...p, active: e.target.checked }))} className="h-4 w-4 accent-electric-400" />
                Cuenta activa
              </label>
            </div>
          </div>
          <button type="submit" className="btn-primary">
            <Check size={16} /> {editingId ? 'Guardar cambios' : 'Crear cuenta'}
          </button>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-6"><Loader2 size={22} className="animate-spin text-electric-400" /></div>
      ) : accounts.length === 0 ? (
        <p className="py-6 text-center text-sm text-white/40">No hay cuentas configuradas. Agrega la primera con el botón de arriba.</p>
      ) : (
        <div className="space-y-5">
          {Object.entries(groupedByCurrency).map(([currency, acctList]) => (
            <div key={currency}>
              <div className="mb-2 flex items-center gap-2">
                <Landmark size={16} className="text-electric-400" />
                <h3 className="font-display text-sm font-bold uppercase tracking-wide text-electric-300">{currency}</h3>
                <span className="text-xs text-white/30">({acctList.length} cuenta{acctList.length !== 1 ? 's' : ''})</span>
              </div>
              <div className="space-y-2">
                {acctList.map((a, idx) => (
                  <div key={a.id} className={`rounded-xl border p-3 ${a.active ? 'border-white/10 bg-white/[.03]' : 'border-white/5 bg-white/[.01] opacity-50'}`}>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex flex-col">
                        <button onClick={() => handleReorder(a, 'up')} disabled={idx === 0} className="rounded-md p-1 text-white/40 hover:bg-white/10 hover:text-white disabled:opacity-20"><ArrowUp size={12} /></button>
                        <button onClick={() => handleReorder(a, 'down')} disabled={idx === acctList.length - 1} className="rounded-md p-1 text-white/40 hover:bg-white/10 hover:text-white disabled:opacity-20"><ArrowDown size={12} /></button>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold">{a.bank_name}</span>
                          <span className="rounded-full bg-electric-400/15 px-2 py-0.5 text-[10px] font-bold uppercase text-electric-300">{a.payment_method}</span>
                          {!a.active && <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase text-white/40">Inactiva</span>}
                        </div>
                        <p className="mt-0.5 text-sm text-white/50">
                          {a.account_holder} · {a.account_type} · <span className="font-mono">{a.account_number}</span>
                        </p>
                        <p className="text-xs text-white/30">
                          {a.document_id}{a.phone ? ` · ${a.phone}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => handleEdit(a)} className="rounded-lg bg-white/5 p-2 text-white/60 hover:bg-white/10 hover:text-white" title="Editar">
                          <Copy size={14} />
                        </button>
                        <button onClick={() => handleToggle(a)} className={`rounded-lg p-2 ${a.active ? 'bg-green-500/15 text-green-400 hover:bg-green-500/25' : 'bg-white/5 text-white/30 hover:bg-white/10'}`} title={a.active ? 'Desactivar' : 'Activar'}>
                          <Power size={14} />
                        </button>
                        <button onClick={() => handleDelete(a)} className="rounded-lg p-2 text-red-300/70 hover:bg-red-500/10 hover:text-red-300" title="Eliminar">
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
