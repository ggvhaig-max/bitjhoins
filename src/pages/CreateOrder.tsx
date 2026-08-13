import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Loader2, ArrowRight, ArrowLeft, User, Users, Upload, Check, X,
  Clock, FileText, AlertCircle, CheckCircle2, ArrowDown, Landmark, Send, MessageCircle, Image as ImageIcon,
} from 'lucide-react';
import { supabase, type ExchangeRate, type Customer, type Beneficiary, type Order, type OrderStatus, type PaymentAccount, type OrderMessage } from '@/lib/supabase';
import { formatNumber, formatDate } from '@/lib/format';
import { Logo } from '@/components/Logo';
import { useAuth } from '@/context/AuthContext';

type Step = 'customer' | 'beneficiary' | 'review' | 'payment' | 'tracking' | 'completed';

const PAYMENT_MINUTES = 30;
const DEFAULT_WHATSAPP_NUMBER = '573024629142';

const STATUS_FLOW: { status: OrderStatus; label: string }[] = [
  { status: 'CREATED', label: 'Solicitud recibida' },
  { status: 'PAYMENT_REPORTED', label: 'Pago reportado' },
  { status: 'PAYMENT_CONFIRMED', label: 'Pago confirmado' },
  { status: 'EXCHANGE_PROCESSING', label: 'Cambio en proceso' },
  { status: 'SENDING_TO_BENEFICIARY', label: 'Enviando al beneficiario' },
  { status: 'COMPLETED', label: 'Operación completada' },
];

export function CreateOrder() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user, isCustomer } = useAuth();

  const rateId = params.get('rate_id') ?? '';
  const src = params.get('src') ?? '';
  const dst = params.get('dst') ?? '';
  const amt = params.get('amt') ?? '';
  const result = params.get('result') ?? '';

  const [step, setStep] = useState<Step>('customer');
  const [loading, setLoading] = useState(true);
  const [rateRow, setRateRow] = useState<ExchangeRate | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [beneficiary, setBeneficiary] = useState<Beneficiary | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!rateId) { setLoading(false); return; }
      const { data } = await supabase.from('exchange_rates').select('*').eq('id', rateId).maybeSingle();
      setRateRow((data as ExchangeRate) ?? null);

      // If a customer is logged in, try to auto-load their profile and skip the customer step
      if (isCustomer && user?.email) {
        const { data: cust } = await supabase.from('customers').select('*').eq('email', user.email).maybeSingle();
        if (cust) {
          setCustomer(cust as Customer);
          setStep('beneficiary');
        } else {
          // Logged in but no customer record yet — show the form so they can complete their profile
          setStep('customer');
        }
      }

      setLoading(false);
    };
    load();
  }, [rateId, isCustomer, user]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-navy-950">
        <Loader2 size={32} className="animate-spin text-electric-400" />
      </div>
    );
  }

  if (!rateRow || !src || !dst || !amt || !result) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-navy-950 px-4">
        <div className="card max-w-md p-8 text-center">
          <AlertCircle size={40} className="mx-auto mb-4 text-gold-400" />
          <h2 className="font-display text-xl font-bold">Faltan datos del cálculo</h2>
          <p className="mt-2 text-sm text-white/50">Vuelve a la calculadora, elige las monedas y el monto, y luego presiona "Realizar este cambio".</p>
          <button onClick={() => navigate('/tasas')} className="btn-primary mt-6">Ir a la calculadora</button>
        </div>
      </div>
    );
  }

  const sourceAmount = parseFloat(amt);
  const destAmount = parseFloat(result);

  return (
    <div className="min-h-screen bg-navy-950 text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-navy-950/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3 sm:px-6">
          <button onClick={() => navigate('/tasas')} className="flex items-center gap-2">
            <Logo size="sm" />
          </button>
          <span className="badge bg-electric-500/15 text-electric-300">Nueva operación</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
        {/* Summary card - always visible */}
        <div className="card mb-6 p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-electric-500/15">
                <ArrowDown size={20} className="text-electric-400" />
              </div>
              <div>
                <p className="text-sm text-white/50">Cambio</p>
                <p className="font-display text-lg font-bold">
                  {formatNumber(sourceAmount, 2)} {src} → {formatNumber(destAmount, rateRow.decimals)} {dst}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-white/50">Tasa</p>
              <p className="font-mono text-lg font-bold text-gold-400">{formatNumber(rateRow.rate, 4)}</p>
            </div>
          </div>
        </div>

        {/* Step indicator */}
        <StepIndicator step={step} />

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {step === 'customer' && (!isCustomer || !customer) && (
          <CustomerStep
            initialEmail={user?.email ?? ''}
            onNext={(c) => { setCustomer(c); setStep('beneficiary'); setError(null); }}
            onBack={() => navigate('/tasas')}
          />
        )}

        {step === 'beneficiary' && customer && (
          <BeneficiaryStep
            customer={customer}
            initial={beneficiary}
            onNext={(b) => { setBeneficiary(b); setStep('review'); setError(null); }}
            onBack={() => setStep('customer')}
          />
        )}

        {step === 'review' && customer && beneficiary && (
          <ReviewStep
            customer={customer}
            beneficiary={beneficiary}
            src={src}
            dst={dst}
            sourceAmount={sourceAmount}
            destAmount={destAmount}
            rateRow={rateRow}
            submitting={submitting}
            onConfirm={async () => {
              setSubmitting(true);
              setError(null);
              try {
                const { data: orderNumber } = await supabase.rpc('generate_order_number');
                if (!orderNumber) throw new Error('No se pudo generar el número de orden');

                const expiresAt = new Date(Date.now() + PAYMENT_MINUTES * 60 * 1000).toISOString();

                const { data: orderData, error: orderError } = await supabase.from('orders').insert({
                  order_number: orderNumber,
                  customer_id: customer.id,
                  beneficiary_id: beneficiary.id,
                  source_currency: src,
                  destination_currency: dst,
                  source_amount: sourceAmount,
                  destination_amount: destAmount,
                  exchange_rate_snapshot: rateRow as unknown as Record<string, unknown>,
                  exchange_rate_value: rateRow.rate,
                  exchange_rate_calc_type: rateRow.calculation_type,
                  status: 'WAITING_PAYMENT',
                  expires_at: expiresAt,
                }).select('*').single();

                if (orderError || !orderData) throw new Error(orderError?.message ?? 'Error al crear la orden');

                setOrder(orderData as Order);
                setStep('payment');

                // Fire-and-forget notification
                void supabase.functions.invoke('whatsapp-notify', {
                  body: {
                    type: 'order_created',
                    order_id: (orderData as Order).id,
                    order_number: orderNumber,
                    customer_name: `${customer.first_name} ${customer.last_name}`,
                    source_amount: sourceAmount,
                    source_currency: src,
                    dest_currency: dst,
                    whatsapp: customer.whatsapp,
                  },
                });
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Error al crear la orden');
              } finally {
                setSubmitting(false);
              }
            }}
            onBack={() => setStep('beneficiary')}
          />
        )}

        {step === 'payment' && order && (
          <PaymentStep
            order={order}
            onUploaded={(url) => {
              setOrder({ ...order, payment_proof_url: url, status: 'PAYMENT_REPORTED' });
              setStep('tracking');
            }}
            onCancel={() => navigate('/tasas')}
          />
        )}

        {step === 'tracking' && order && (
          <TrackingStep
            order={order}
            onCompleted={(updatedOrder) => {
              setOrder(updatedOrder);
              setStep('completed');
            }}
          />
        )}

        {step === 'completed' && order && (
          <CompletedStep
            order={order}
            onFinish={() => navigate('/tasas')}
          />
        )}
      </main>
    </div>
  );
}

function StepIndicator({ step }: { step: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: 'customer', label: 'Cliente' },
    { key: 'beneficiary', label: 'Beneficiario' },
    { key: 'review', label: 'Revisión' },
    { key: 'payment', label: 'Pago' },
    { key: 'tracking', label: 'Seguimiento' },
    { key: 'completed', label: 'Listo' },
  ];
  const currentIdx = steps.findIndex((s) => s.key === step);

  return (
    <div className="mb-6 flex items-center gap-1 overflow-x-auto pb-2">
      {steps.map((s, idx) => (
        <div key={s.key} className="flex items-center gap-1">
          <div className={`flex h-7 items-center rounded-full px-3 text-xs font-bold transition-colors ${
            idx <= currentIdx ? 'bg-electric-400 text-navy-950' : 'bg-white/5 text-white/40'
          }`}>
            {idx + 1}. {s.label}
          </div>
          {idx < steps.length - 1 && <div className={`h-px w-4 ${idx < currentIdx ? 'bg-electric-400' : 'bg-white/10'}`} />}
        </div>
      ))}
    </div>
  );
}

// ── Customer Step ──────────────────────────────────────────
function CustomerStep({ initialEmail, onNext, onBack }: { initialEmail: string; onNext: (c: Customer) => void; onBack: () => void }) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dialCode, setDialCode] = useState('57');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const localDigits = whatsapp.replace(/\D/g, '');
    if (localDigits.length < 7) {
      setError('Escribe un número de WhatsApp válido.');
      setLoading(false);
      return;
    }
    const fullNumber = `${dialCode}${localDigits}`;

    // Find or create customer by whatsapp
    const { data: existing } = await supabase.from('customers').select('*').eq('whatsapp', fullNumber).maybeSingle();
    if (existing) {
      setLoading(false);
      onNext(existing as Customer);
      return;
    }

    const { data, error: insertError } = await supabase.from('customers').insert({
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      whatsapp: fullNumber,
      email: email.trim() || null,
    }).select('*').single();

    setLoading(false);
    if (insertError || !data) {
      setError('No se pudo crear el perfil de cliente. Inténtalo nuevamente.');
      return;
    }
    onNext(data as Customer);
  };

  return (
    <div className="card p-6 sm:p-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-electric-500/15">
          <User size={22} className="text-electric-400" />
        </div>
        <div>
          <h2 className="font-display text-xl font-bold">Tus datos</h2>
          <p className="text-sm text-white/50">Necesitamos tu información para crear la operación</p>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-white/60">Nombre</label>
            <input required className="input-field" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Juan" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-white/60">Apellido</label>
            <input required className="input-field" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Pérez" />
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-white/60">WhatsApp</label>
          <div className="flex gap-2">
            <select className="input-field w-28 flex-shrink-0" value={dialCode} onChange={(e) => setDialCode(e.target.value)}>
              <option value="57">🇨🇴 +57</option>
              <option value="51">🇵🇪 +51</option>
              <option value="58">🇻🇪 +58</option>
              <option value="56">🇨🇱 +56</option>
              <option value="54">🇦🇷 +54</option>
              <option value="591">🇧🇴 +591</option>
              <option value="593">🇪🇨 +593</option>
              <option value="598">🇺🇾 +598</option>
              <option value="52">🇲🇽 +52</option>
              <option value="1">🇺🇸 +1</option>
              <option value="34">🇪🇸 +34</option>
              <option value="44">🇬🇧 +44</option>
              <option value="49">🇩🇪 +49</option>
              <option value="33">🇫🇷 +33</option>
              <option value="39">🇮🇹 +39</option>
            </select>
            <input required className="input-field font-mono flex-1" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="3024567890" inputMode="tel" />
          </div>
          <p className="mt-1 text-xs text-white/30">Selecciona el código de país y escribe tu número sin el código</p>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-white/60">Email</label>
          <input required type="email" className="input-field" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="juan@email.com" />
          <p className="mt-1 text-xs text-white/30">Tu email es obligatorio. Sirve para recuperar tu cuenta y recibir notificaciones.</p>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 pt-2">
          <button type="button" onClick={onBack} className="btn-ghost">
            <ArrowLeft size={16} /> Cancelar
          </button>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
            Continuar
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Beneficiary Step ───────────────────────────────────────
function BeneficiaryStep({ customer, initial, onNext, onBack }: {
  customer: Customer;
  initial: Beneficiary | null;
  onNext: (b: Beneficiary) => void;
  onBack: () => void;
}) {
  const [saved, setSaved] = useState<Beneficiary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(initial?.id ?? null);

  // form fields
  const [fullName, setFullName] = useState('');
  const [docId, setDocId] = useState('');
  const [bank, setBank] = useState('');
  const [accountType, setAccountType] = useState('Ahorros');
  const [accountNumber, setAccountNumber] = useState('');
  const [currency, setCurrency] = useState('');
  const [country, setCountry] = useState('');
  const [alias, setAlias] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('beneficiaries').select('*').eq('customer_id', customer.id).order('created_at', { ascending: false });
    setSaved((data as Beneficiary[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { void load(); }, [customer.id]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const { data, error: insErr } = await supabase.from('beneficiaries').insert({
      customer_id: customer.id,
      full_name: fullName.trim(),
      document_id: docId.trim(),
      bank: bank.trim(),
      account_type: accountType,
      account_number: accountNumber.trim(),
      currency: currency.trim(),
      country: country.trim(),
      alias: alias.trim(),
    }).select('*').single();
    setSaving(false);
    if (insErr || !data) { setError('No se pudo guardar el beneficiario.'); return; }
    setShowForm(false);
    setFullName(''); setDocId(''); setBank(''); setAccountNumber(''); setCurrency(''); setCountry(''); setAlias('');
    await load();
    setSelectedId((data as Beneficiary).id);
  };

  const selected = saved.find((b) => b.id === selectedId) ?? null;

  return (
    <div className="card p-6 sm:p-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-electric-500/15">
          <Users size={22} className="text-electric-400" />
        </div>
        <div>
          <h2 className="font-display text-xl font-bold">Beneficiario</h2>
          <p className="text-sm text-white/50">¿A quién le enviamos el dinero?</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-electric-400" /></div>
      ) : (
        <>
          {saved.length > 0 && !showForm && (
            <div className="space-y-2">
              {saved.map((b) => (
                <button
                  key={b.id}
                  onClick={() => setSelectedId(b.id)}
                  className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-colors ${
                    selectedId === b.id ? 'border-electric-400 bg-electric-500/10' : 'border-white/10 bg-white/[.03] hover:border-white/20'
                  }`}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gold-400/15 text-gold-400">
                    <Users size={18} />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold">{b.alias}</p>
                    <p className="text-sm text-white/50">{b.full_name} · {b.bank} · {b.account_number}</p>
                  </div>
                  {selectedId === b.id && <Check size={20} className="text-electric-400" />}
                </button>
              ))}
              <button onClick={() => setShowForm(true)} className="btn-ghost w-full">
                + Agregar nuevo beneficiario
              </button>
            </div>
          )}

          {(showForm || saved.length === 0) && (
            <form onSubmit={handleSave} className="space-y-4">
              {saved.length > 0 && (
                <button type="button" onClick={() => setShowForm(false)} className="text-sm text-electric-300 hover:text-electric-200">
                  ← Usar beneficiario existente
                </button>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-white/60">Nombre completo</label>
                  <input required className="input-field" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="María Pérez" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-white/60">Documento de identidad</label>
                  <input required className="input-field" value={docId} onChange={(e) => setDocId(e.target.value)} placeholder="V-12.345.678" />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-white/60">Banco</label>
                  <input required className="input-field" value={bank} onChange={(e) => setBank(e.target.value)} placeholder="Banco de Venezuela" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-white/60">Tipo de cuenta</label>
                  <select className="input-field" value={accountType} onChange={(e) => setAccountType(e.target.value)}>
                    <option value="Ahorros">Ahorros</option>
                    <option value="Corriente">Corriente</option>
                  </select>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-white/60">Número de cuenta</label>
                  <input required className="input-field font-mono" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="0102-0123-45-6789" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-white/60">Alias</label>
                  <input required className="input-field" value={alias} onChange={(e) => setAlias(e.target.value)} placeholder="Mamá Venezuela" />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-white/60">Moneda</label>
                  <input required className="input-field" value={currency} onChange={(e) => setCurrency(e.target.value)} placeholder="VES" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-white/60">País</label>
                  <input required className="input-field" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Venezuela" />
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  <AlertCircle size={16} /> {error}
                </div>
              )}

              <div className="flex items-center justify-between gap-3 pt-2">
                <button type="button" onClick={onBack} className="btn-ghost">
                  <ArrowLeft size={16} /> Atrás
                </button>
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  Guardar beneficiario
                </button>
              </div>
            </form>
          )}

          {selected && !showForm && (
            <div className="mt-6 flex items-center justify-between gap-3">
              <button onClick={onBack} className="btn-ghost">
                <ArrowLeft size={16} /> Atrás
              </button>
              <button onClick={() => onNext(selected)} className="btn-primary">
                <ArrowRight size={16} /> Continuar con este beneficiario
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Review Step ─────────────────────────────────────────────
function ReviewStep({ customer, beneficiary, src, dst, sourceAmount, destAmount, rateRow, submitting, onConfirm, onBack }: {
  customer: Customer;
  beneficiary: Beneficiary;
  src: string;
  dst: string;
  sourceAmount: number;
  destAmount: number;
  rateRow: ExchangeRate;
  submitting: boolean;
  onConfirm: () => void;
  onBack: () => void;
}) {
  return (
    <div className="card p-6 sm:p-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-electric-500/15">
          <FileText size={22} className="text-electric-400" />
        </div>
        <div>
          <h2 className="font-display text-xl font-bold">Revisa tu operación</h2>
          <p className="text-sm text-white/50">Confirma los datos antes de crear la orden</p>
        </div>
      </div>

      <div className="space-y-4">
        <ReviewRow label="Cliente" value={`${customer.first_name} ${customer.last_name}`} />
        <ReviewRow label="WhatsApp" value={customer.whatsapp} />
        <ReviewRow label="Beneficiario" value={`${beneficiary.alias} (${beneficiary.full_name})`} />
        <ReviewRow label="Cuenta destino" value={`${beneficiary.bank} · ${beneficiary.account_type} · ${beneficiary.account_number}`} />
        <ReviewRow label="Envías" value={`${formatNumber(sourceAmount, 2)} ${src}`} />
        <ReviewRow label="Recibes" value={`${formatNumber(destAmount, rateRow.decimals)} ${dst}`} highlight />
        <ReviewRow label="Tasa congelada" value={formatNumber(rateRow.rate, 4)} />
      </div>

      <div className="mt-6 rounded-xl border border-gold-400/20 bg-gold-400/5 px-4 py-3 text-sm text-gold-300">
        Al confirmar, la tasa se congela para esta orden. Aunque cambie la tasa pública, tu operación mantendrá este precio.
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        <button onClick={onBack} disabled={submitting} className="btn-ghost">
          <ArrowLeft size={16} /> Atrás
        </button>
        <button onClick={onConfirm} disabled={submitting} className="btn-gold">
          {submitting ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          Crear orden y pagar
        </button>
      </div>
    </div>
  );
}

function ReviewRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-white/10 pb-3 last:border-0 last:pb-0">
      <span className="text-sm text-white/50">{label}</span>
      <span className={`font-bold ${highlight ? 'font-mono text-lg text-gold-400' : 'text-white'}`}>{value}</span>
    </div>
  );
}

// ── Payment Step ───────────────────────────────────────────
function PaymentStep({ order, onUploaded, onCancel }: {
  order: Order;
  onUploaded: (url: string) => void;
  onCancel: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [accounts, setAccounts] = useState<PaymentAccount[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [whatsappNumber, setWhatsappNumber] = useState(DEFAULT_WHATSAPP_NUMBER);

  useEffect(() => {
    const loadAccounts = async () => {
      const { data } = await supabase
        .from('payment_accounts')
        .select('*')
        .eq('currency', order.source_currency)
        .eq('active', true)
        .order('display_order', { ascending: true });
      setAccounts((data as PaymentAccount[]) ?? []);
      setAccountsLoading(false);
    };
    void loadAccounts();
  }, [order.source_currency]);

  useEffect(() => {
    const loadSettings = async () => {
      const { data } = await supabase.from('site_settings').select('whatsapp_number').eq('id', 'main').maybeSingle();
      if (data?.whatsapp_number) setWhatsappNumber(data.whatsapp_number);
    };
    void loadSettings();
  }, []);

  useEffect(() => {
    if (!order.expires_at) return;
    const update = () => {
      const diff = Math.max(0, Math.floor((new Date(order.expires_at!).getTime() - Date.now()) / 1000));
      setSecondsLeft(diff);
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [order.expires_at]);

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const expired = secondsLeft <= 0;

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png';
    const path = `proofs/${order.id}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('payment-proofs').upload(path, file, { contentType: file.type, upsert: false });
    if (upErr) {
      setUploading(false);
      setError('No se pudo subir el comprobante. Inténtalo nuevamente.');
      return;
    }
    const { data } = supabase.storage.from('payment-proofs').getPublicUrl(path);
    const url = data.publicUrl;

    const { error: updErr } = await supabase.from('orders').update({ payment_proof_url: url, status: 'PAYMENT_REPORTED' }).eq('id', order.id);
    setUploading(false);
    if (updErr) { setError('No se pudo actualizar la orden.'); return; }
    onUploaded(url);
  };

  return (
    <div className="card p-6 sm:p-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold-400/15">
          <Clock size={22} className="text-gold-400" />
        </div>
        <div>
          <h2 className="font-display text-xl font-bold">Realiza tu pago</h2>
          <p className="text-sm text-white/50">Orden {order.order_number}</p>
        </div>
      </div>

      {/* Countdown */}
      <div className={`mb-6 rounded-2xl border p-5 text-center ${expired ? 'border-red-500/30 bg-red-500/10' : 'border-electric-400/30 bg-electric-500/5'}`}>
        <p className="text-sm text-white/50">Tiempo restante para conservar tu cotización</p>
        <p className={`mt-1 font-mono text-4xl font-bold ${expired ? 'text-red-400' : 'text-electric-300'}`}>
          {expired ? 'EXPIRADO' : `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`}
        </p>
        <p className="mt-2 text-xs text-white/40">Realiza tu pago dentro del tiempo establecido para conservar esta cotización.</p>
      </div>

      <div className="mb-6 rounded-2xl border border-white/10 bg-white/[.03] p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-bold">Cuentas para pagar en {order.source_currency}</h3>
            <p className="mt-1 text-xs text-white/40">Puedes usar cualquiera de estas cuentas activas.</p>
          </div>
          <Landmark size={22} className="text-electric-400" />
        </div>
        {accountsLoading ? (
          <div className="flex justify-center py-5"><Loader2 size={22} className="animate-spin text-electric-400" /></div>
        ) : accounts.length === 0 ? (
          <div className="rounded-xl border border-gold-400/30 bg-gold-400/10 px-4 py-3">
            <p className="text-sm text-gold-200">Aún no hay cuentas habilitadas para {order.source_currency}. Contacta a un asesor antes de pagar.</p>
            <a
              href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(`Hola, quiero pagar mi orden ${order.order_number} en ${order.source_currency} pero no veo cuentas disponibles.`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary mt-3 w-full sm:w-auto"
            >
              <MessageCircle size={18} /> Contactar asesor por WhatsApp
            </a>
          </div>
        ) : (
          <div className="space-y-3">
            {accounts.map((account) => (
              <div key={account.id} className="rounded-xl border border-white/10 bg-navy-950/50 p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-electric-300">{account.bank_name}</span>
                  <span className="rounded-full bg-electric-400/15 px-2 py-1 text-[10px] font-bold uppercase text-electric-300">{account.payment_method}</span>
                </div>
                <div className="grid gap-x-5 gap-y-1 text-sm sm:grid-cols-2">
                  <div><span className="text-white/45">Titular: </span><span className="font-bold">{account.account_holder}</span></div>
                  <div><span className="text-white/45">Cuenta: </span><span className="font-mono font-bold">{account.account_number}</span></div>
                  <div><span className="text-white/45">Tipo: </span><span>{account.account_type}</span></div>
                  <div><span className="text-white/45">Documento: </span><span>{account.document_id}</span></div>
                  {account.phone && <div><span className="text-white/45">Teléfono: </span><span className="font-mono">{account.phone}</span></div>}
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="mt-4 text-xs text-gold-300">Transfiere {formatNumber(order.source_amount, 2)} {order.source_currency} a una de estas cuentas.</p>
      </div>

      {/* Upload */}
      <div className="mb-6">
        <label className="mb-2 block text-sm font-medium text-white/60">Subir comprobante de pago</label>
        <div className="rounded-xl border-2 border-dashed border-white/15 bg-white/[.02] p-6 text-center">
          {file ? (
            <div className="flex items-center justify-between">
              <span className="truncate text-sm text-white/70">{file.name}</span>
              <button onClick={() => setFile(null)} className="rounded-lg p-1 text-white/40 hover:text-white"><X size={16} /></button>
            </div>
          ) : (
            <label className="cursor-pointer">
              <Upload size={28} className="mx-auto mb-2 text-electric-400" />
              <p className="text-sm text-white/50">Haz clic para seleccionar tu comprobante</p>
              <p className="mt-1 text-xs text-white/30">JPG, PNG o PDF · Máximo 10 MB</p>
              <input
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  if (f && f.size > 10 * 1024 * 1024) { setError('El archivo no puede pesar más de 10 MB.'); return; }
                  setFile(f);
                  setError(null);
                }}
              />
            </label>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <button onClick={onCancel} disabled={uploading} className="btn-ghost">Cancelar</button>
        <button onClick={handleUpload} disabled={!file || uploading || expired} className="btn-primary">
          {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
          Subir comprobante
        </button>
      </div>
    </div>
  );
}

// ── Tracking Step ──────────────────────────────────────────
function TrackingStep({ order, onCompleted }: { order: Order; onCompleted: (o: Order) => void }) {
  const [currentOrder, setCurrentOrder] = useState<Order>(order);
  const [history, setHistory] = useState<{ status: OrderStatus; created_at: string }[]>([]);
  const [messages, setMessages] = useState<OrderMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmedReceipt, setConfirmedReceipt] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [histRes, msgRes] = await Promise.all([
        supabase.from('order_status_history').select('status, created_at').eq('order_id', order.id).order('created_at', { ascending: true }),
        supabase.from('order_messages').select('*').eq('order_id', order.id).order('created_at', { ascending: true }),
      ]);
      setHistory((histRes.data as { status: OrderStatus; created_at: string }[]) ?? []);
      setMessages((msgRes.data as OrderMessage[]) ?? []);
    };
    void load();

    const channel = supabase
      .channel(`order-${order.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${order.id}` }, (payload) => {
        const updated = payload.new as Order;
        setCurrentOrder(updated);
        setHistory((prev) => prev.some((h) => h.status === updated.status) ? prev : [...prev, { status: updated.status, created_at: new Date().toISOString() }]);
        if (updated.status === 'COMPLETED') onCompleted(updated);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'order_status_history', filter: `order_id=eq.${order.id}` }, (payload) => {
        const entry = payload.new as { status: OrderStatus; created_at: string };
        setHistory((prev) => prev.some((h) => h.status === entry.status) ? prev : [...prev, entry]);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'order_messages', filter: `order_id=eq.${order.id}` }, (payload) => {
        setMessages((prev) => [...prev, payload.new as OrderMessage]);
      })
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [order.id]);

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;
    setSendingMessage(true);
    await supabase.from('order_messages').insert({ order_id: order.id, sender: 'customer', message: newMessage.trim() });
    setNewMessage('');
    setSendingMessage(false);
  };

  const handleConfirmReceipt = async () => {
    setConfirming(true);
    await supabase.from('orders').update({ confirmed_by_customer_at: new Date().toISOString() }).eq('id', order.id);
    setConfirmedReceipt(true);
    setConfirming(false);
  };

  const completedIdx = STATUS_FLOW.findIndex((s) => s.status === currentOrder.status);
  const isCancelled = currentOrder.status === 'CANCELLED' || currentOrder.status === 'EXPIRED';
  const isSent = currentOrder.status === 'SENT' || currentOrder.status === 'COMPLETED';
  const showConfirmButton = isSent && !confirmedReceipt && !currentOrder.confirmed_by_customer_at && currentOrder.status !== 'COMPLETED';

  return (
    <div className="card p-6 sm:p-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-electric-500/15">
          <CheckCircle2 size={22} className="text-electric-400" />
        </div>
        <div>
          <h2 className="font-display text-xl font-bold">Seguimiento de tu operación</h2>
          <p className="text-sm text-white/50">Orden {currentOrder.order_number}</p>
        </div>
      </div>

      {isCancelled ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center">
          <X size={32} className="mx-auto mb-3 text-red-400" />
          <p className="font-display text-lg font-bold text-red-300">
            {currentOrder.status === 'EXPIRED' ? 'La orden expiró' : 'La orden fue cancelada'}
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {STATUS_FLOW.map((s, idx) => {
            const isDone = idx <= completedIdx;
            const isCurrent = idx === completedIdx;
            const histEntry = history.find((h) => h.status === s.status);
            return (
              <div key={s.status} className="flex items-start gap-4">
                <div className="flex flex-col items-center">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition-colors ${
                    isDone ? 'border-electric-400 bg-electric-400 text-navy-950' : 'border-white/20 bg-navy-900 text-white/30'
                  }`}>
                    {isDone ? <Check size={18} /> : <span className="text-xs font-bold">{idx + 1}</span>}
                  </div>
                  {idx < STATUS_FLOW.length - 1 && <div className={`h-8 w-0.5 ${idx < completedIdx ? 'bg-electric-400' : 'bg-white/10'}`} />}
                </div>
                <div className="pt-1.5">
                  <p className={`font-bold ${isCurrent ? 'text-electric-300' : isDone ? 'text-white' : 'text-white/40'}`}>{s.label}</p>
                  {histEntry && <p className="text-xs text-white/30">{formatDate(histEntry.created_at)}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Admin proof of transfer */}
      {currentOrder.admin_proof_url && (
        <div className="mt-5 rounded-xl border border-electric-400/20 bg-electric-400/[.05] p-4">
          <p className="mb-2 flex items-center gap-2 text-sm font-bold text-electric-300"><ImageIcon size={16} /> Comprobante de envío del administrador</p>
          {currentOrder.admin_proof_url.match(/\.pdf$/i) ? (
            <a href={currentOrder.admin_proof_url} target="_blank" rel="noopener noreferrer" className="btn-ghost text-sm">
              <FileText size={16} /> Ver comprobante (PDF)
            </a>
          ) : (
            <img src={currentOrder.admin_proof_url} alt="Comprobante de envío" className="max-h-60 rounded-xl border border-white/10" />
          )}
        </div>
      )}

      {/* Confirm receipt button */}
      {showConfirmButton && (
        <div className="mt-5 rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-center">
          <p className="mb-3 text-sm text-green-200">¿Llegó el dinero a tu beneficiario? Confirma la recepción para cerrar la orden.</p>
          <button onClick={() => void handleConfirmReceipt()} disabled={confirming} className="btn-primary">
            {confirming ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            Confirmar recepción
          </button>
        </div>
      )}
      {(confirmedReceipt || currentOrder.confirmed_by_customer_at) && (
        <div className="mt-5 rounded-xl border border-green-500/20 bg-green-500/5 p-3 text-center text-sm text-green-300">
          <CheckCircle2 size={20} className="mx-auto mb-1" /> Recepción confirmada. El administrador cerrará la orden.
        </div>
      )}

      {/* Messages */}
      <div className="mt-5 rounded-xl border border-white/10 bg-white/[.02] p-4">
        <p className="mb-2 flex items-center gap-2 text-sm font-medium text-white/60"><MessageCircle size={16} /> Mensajes</p>
        <div className="mb-3 max-h-48 space-y-2 overflow-y-auto">
          {messages.length === 0 ? (
            <p className="py-3 text-center text-xs text-white/30">No hay mensajes. El administrador puede escribirte aquí.</p>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={`flex ${m.sender === 'customer' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${m.sender === 'customer' ? 'bg-electric-400/20 text-white' : 'bg-white/10 text-white/70'}`}>
                  <p>{m.message}</p>
                  <p className="mt-1 text-[10px] text-white/30">{timeAgo(m.created_at)}</p>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="flex gap-2">
          <input
            className="input-field flex-1 text-sm"
            placeholder="Escribe un mensaje..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSendMessage(); } }}
          />
          <button onClick={() => void handleSendMessage()} disabled={!newMessage.trim() || sendingMessage} className="btn-primary text-sm">
            {sendingMessage ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          </button>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-white/10 bg-white/[.03] p-4">
        <p className="text-sm text-white/50">Te notificaremos por WhatsApp cada vez que avance tu operación. Puedes cerrar esta página y volver cuando quieras.</p>
      </div>
    </div>
  );
}

// ── Completed Step ─────────────────────────────────────────
function CompletedStep({ order, onFinish }: { order: Order; onFinish: () => void }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [review, setReview] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const submitRating = async () => {
    if (rating < 1) return;
    setSaving(true);
    await supabase.from('order_ratings').insert({
      order_id: order.id,
      rating,
      review: review.trim() || null,
    });
    setSaving(false);
    setSaved(true);
  };

  const downloadReceipt = () => {
    const text = `BITJHOINS - COMPROBANTE DE OPERACIÓN
================================
Orden: ${order.order_number}
Fecha: ${formatDate(order.created_at)}
Estado: COMPLETADA

Envías: ${formatNumber(order.source_amount, 2)} ${order.source_currency}
Recibes: ${formatNumber(order.destination_amount, 2)} ${order.destination_currency}
Tasa: ${formatNumber(order.exchange_rate_value, 4)} (${order.exchange_rate_calc_type})

¡Gracias por tu confianza!
BitJhoins - Cambio seguro de divisas`;
    const blob = new Blob([text], { type: 'text/plain' });
    const link = document.createElement('a');
    link.download = `comprobante-${order.order_number}.txt`;
    link.href = URL.createObjectURL(blob);
    link.click();
  };

  return (
    <div className="card p-6 sm:p-8">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/15">
          <CheckCircle2 size={36} className="text-green-400" />
        </div>
        <h2 className="font-display text-2xl font-bold">¡Operación completada!</h2>
        <p className="mt-2 text-sm text-white/50">Orden {order.order_number}</p>
      </div>

      {/* Summary */}
      <div className="mb-6 space-y-3 rounded-2xl border border-white/10 bg-white/[.03] p-5">
        <ReviewRow label="Enviaste" value={`${formatNumber(order.source_amount, 2)} ${order.source_currency}`} />
        <ReviewRow label="Recibiste" value={`${formatNumber(order.destination_amount, 2)} ${order.destination_currency}`} highlight />
        <ReviewRow label="Tasa aplicada" value={formatNumber(order.exchange_rate_value, 4)} />
        <ReviewRow label="Fecha" value={formatDate(order.created_at)} />
      </div>

      <button onClick={downloadReceipt} className="btn-ghost mb-6 w-full">
        <FileText size={16} /> Descargar comprobante
      </button>

      {/* Rating */}
      {!saved ? (
        <div className="rounded-2xl border border-gold-400/20 bg-gold-400/5 p-5">
          <h3 className="mb-3 font-display text-lg font-bold">¿Cómo fue tu experiencia?</h3>
          <div className="mb-4 flex gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onMouseEnter={() => setHover(n)}
                onMouseLeave={() => setHover(0)}
                onClick={() => setRating(n)}
                className="text-3xl transition-transform hover:scale-110"
                style={{ color: (hover || rating) >= n ? '#fbbf24' : '#ffffff30' }}
              >
                ★
              </button>
            ))}
          </div>
          <textarea
            className="input-field min-h-[80px] resize-none"
            placeholder="Comentario (opcional)..."
            value={review}
            onChange={(e) => setReview(e.target.value)}
          />
          <button onClick={submitRating} disabled={rating < 1 || saving} className="btn-gold mt-4 w-full">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            Enviar calificación
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border border-green-500/20 bg-green-500/5 p-5 text-center">
          <CheckCircle2 size={28} className="mx-auto mb-2 text-green-400" />
          <p className="font-bold text-green-300">¡Gracias por tu calificación!</p>
        </div>
      )}

      <button onClick={onFinish} className="btn-primary mt-6 w-full">
        Volver al inicio
      </button>
    </div>
  );
}
