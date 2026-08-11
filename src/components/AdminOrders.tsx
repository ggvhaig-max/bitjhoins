import { useEffect, useState, useCallback } from 'react';
import {
  Loader2, Eye, Check, X, MessageCircle, Upload, FileText,
  Clock, ArrowRight, Package, Wallet, CheckCircle, Cog, Send, Image as ImageIcon,
} from 'lucide-react';
import { supabase, type Order, type OrderStatus, type Customer, type Beneficiary, type OrderMessage } from '@/lib/supabase';
import { formatNumber, formatDate, timeAgo } from '@/lib/format';

type OrderWithRelations = Order & {
  customers?: Customer;
  beneficiaries?: Beneficiary;
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  CREATED: 'Creada',
  WAITING_PAYMENT: 'Esperando pago',
  PAYMENT_REPORTED: 'Pago reportado',
  PAYMENT_CONFIRMED: 'Pago confirmado',
  EXCHANGE_PROCESSING: 'Cambio en proceso',
  SENDING_TO_BENEFICIARY: 'Enviando',
  SENT: 'Enviado',
  COMPLETED: 'Completada',
  CANCELLED: 'Cancelada',
  EXPIRED: 'Expirada',
};

const STATUS_COLORS: Record<OrderStatus, string> = {
  CREATED: 'bg-white/10 text-white/60',
  WAITING_PAYMENT: 'bg-gold-400/15 text-gold-300',
  PAYMENT_REPORTED: 'bg-blue-400/15 text-blue-300',
  PAYMENT_CONFIRMED: 'bg-electric-400/15 text-electric-300',
  EXCHANGE_PROCESSING: 'bg-purple-400/15 text-purple-300',
  SENDING_TO_BENEFICIARY: 'bg-pink-400/15 text-pink-300',
  SENT: 'bg-cyan-400/15 text-cyan-300',
  COMPLETED: 'bg-green-500/15 text-green-300',
  CANCELLED: 'bg-red-500/15 text-red-300',
  EXPIRED: 'bg-gray-500/15 text-gray-300',
};

const NEXT_STATUSES: Partial<Record<OrderStatus, OrderStatus[]>> = {
  WAITING_PAYMENT: ['PAYMENT_REPORTED', 'CANCELLED', 'EXPIRED'],
  PAYMENT_REPORTED: ['PAYMENT_CONFIRMED', 'CANCELLED'],
  PAYMENT_CONFIRMED: ['EXCHANGE_PROCESSING', 'CANCELLED'],
  EXCHANGE_PROCESSING: ['SENDING_TO_BENEFICIARY', 'CANCELLED'],
  SENDING_TO_BENEFICIARY: ['SENT', 'CANCELLED'],
  SENT: ['COMPLETED'],
  CREATED: ['WAITING_PAYMENT', 'CANCELLED'],
};

const ADMIN_STEPS: { status: OrderStatus; label: string; description: string }[] = [
  { status: 'PAYMENT_REPORTED', label: 'Verificar pago', description: 'El cliente subió su comprobante. Revísalo y confirma que el pago llegó.' },
  { status: 'PAYMENT_CONFIRMED', label: 'Confirmar pago', description: 'El pago fue verificado. Inicia el proceso de cambio.' },
  { status: 'EXCHANGE_PROCESSING', label: 'Procesar cambio', description: 'Estás realizando el cambio de moneda.' },
  { status: 'SENDING_TO_BENEFICIARY', label: 'Enviar a beneficiario', description: 'Estás enviando los fondos a la cuenta del beneficiario.' },
  { status: 'SENT', label: 'Subir comprobante de envío', description: 'Sube el comprobante de la transferencia enviada al beneficiario.' },
  { status: 'COMPLETED', label: 'Cerrar orden', description: 'El cliente confirmó recepción. Cierra la orden.' },
];

const NOTIFICATION_TYPES: Record<OrderStatus, string> = {
  CREATED: 'order_created',
  WAITING_PAYMENT: 'order_created',
  PAYMENT_REPORTED: 'payment_reported',
  PAYMENT_CONFIRMED: 'payment_confirmed',
  EXCHANGE_PROCESSING: 'exchange_processing',
  SENDING_TO_BENEFICIARY: 'sending_to_beneficiary',
  SENT: 'sent',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
};

export function AdminOrders() {
  const [orders, setOrders] = useState<OrderWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<OrderStatus | 'ALL' | 'TODAY'>('ALL');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<OrderWithRelations | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [adminProofFile, setAdminProofFile] = useState<File | null>(null);
  const [uploadingAdminProof, setUploadingAdminProof] = useState(false);
  const [messages, setMessages] = useState<OrderMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    if (orderError) {
      setLoading(false);
      setLoadError('No se pudieron cargar las órdenes. Revisa tu conexión o los permisos del panel.');
      return;
    }

    const rawOrders = (orderData as Order[]) ?? [];
    const customerIds = Array.from(new Set(rawOrders.map((order) => order.customer_id)));
    const beneficiaryIds = Array.from(new Set(rawOrders.map((order) => order.beneficiary_id).filter((id): id is string => Boolean(id))));
    const [{ data: customerData, error: customerError }, { data: beneficiaryData, error: beneficiaryError }] = await Promise.all([
      customerIds.length ? supabase.from('customers').select('*').in('id', customerIds) : Promise.resolve({ data: [], error: null }),
      beneficiaryIds.length ? supabase.from('beneficiaries').select('*').in('id', beneficiaryIds) : Promise.resolve({ data: [], error: null }),
    ]);

    setLoading(false);
    if (customerError || beneficiaryError) {
      setLoadError('Las órdenes cargaron, pero no se pudieron cargar todos los datos del cliente.');
    } else {
      setLoadError(null);
    }
    const customers = new Map(((customerData as Customer[]) ?? []).map((customer) => [customer.id, customer]));
    const beneficiaries = new Map(((beneficiaryData as Beneficiary[]) ?? []).map((beneficiary) => [beneficiary.id, beneficiary]));
    setOrders(rawOrders.map((order) => ({
      ...order,
      customers: customers.get(order.customer_id),
      beneficiaries: order.beneficiary_id ? beneficiaries.get(order.beneficiary_id) : undefined,
    })));
  }, []);

  useEffect(() => {
    void loadOrders();

    const channel = supabase
      .channel('admin-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        void loadOrders();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'order_status_history' }, () => {
        void loadOrders();
      })
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [loadOrders]);

  // Load messages when an order is selected
  useEffect(() => {
    if (!selectedOrder) {
      setMessages([]);
      return;
    }

    const loadMessages = async () => {
      const { data } = await supabase
        .from('order_messages')
        .select('*')
        .eq('order_id', selectedOrder.id)
        .order('created_at', { ascending: true });
      setMessages((data as OrderMessage[]) ?? []);
    };
    void loadMessages();

    const msgChannel = supabase
      .channel(`admin-msgs-${selectedOrder.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'order_messages', filter: `order_id=eq.${selectedOrder.id}` }, (payload) => {
        setMessages((prev) => [...prev, payload.new as OrderMessage]);
      })
      .subscribe();

    return () => { void supabase.removeChannel(msgChannel); };
  }, [selectedOrder]);

  const sendNotification = async (order: OrderWithRelations, type: string, extraMessage?: string) => {
    const customer = order.customers;
    if (!customer) return;
    try {
      const fnUrl = `${import.meta.env.VITE_SUPABASE_URL ?? import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/whatsapp-notify`;
      await fetch(fnUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY ?? import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          type,
          order_id: order.id,
          order_number: order.order_number,
          customer_name: `${customer.first_name} ${customer.last_name}`,
          whatsapp: customer.whatsapp,
          source_amount: order.source_amount,
          source_currency: order.source_currency,
          dest_currency: order.destination_currency,
          message_text: extraMessage,
        }),
      });
    } catch {
      // notifications are best-effort
    }
  };

  const updateOrderStatus = async (orderId: string, status: OrderStatus) => {
    setActionLoading(true);
    const updates: Record<string, unknown> = { status };
    if (status === 'COMPLETED') updates.admin_confirmed_at = new Date().toISOString();
    await supabase.from('orders').update(updates).eq('id', orderId);
    void loadOrders();
    setSelectedOrder((prev) => prev ? { ...prev, status } : null);
    const order = orders.find((o) => o.id === orderId);
    if (order) await sendNotification({ ...order, status }, NOTIFICATION_TYPES[status]);
    setActionLoading(false);
  };

  const handleUploadProof = async (orderId: string) => {
    if (!proofFile) return;
    setUploadingProof(true);
    const ext = proofFile.name.split('.').pop()?.toLowerCase() ?? 'png';
    const path = `proofs/${orderId}-admin-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('payment-proofs').upload(path, proofFile, { contentType: proofFile.type, upsert: false });
    if (upErr) { setUploadingProof(false); return; }
    const { data } = supabase.storage.from('payment-proofs').getPublicUrl(path);
    await supabase.from('orders').update({ payment_proof_url: data.publicUrl }).eq('id', orderId);
    setUploadingProof(false);
    setProofFile(null);
    void loadOrders();
    setSelectedOrder((prev) => prev ? { ...prev, payment_proof_url: data.publicUrl } : null);
  };

  const handleUploadAdminProof = async (orderId: string) => {
    if (!adminProofFile) return;
    setUploadingAdminProof(true);
    const ext = adminProofFile.name.split('.').pop()?.toLowerCase() ?? 'png';
    const path = `proofs/${orderId}-transfer-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('payment-proofs').upload(path, adminProofFile, { contentType: adminProofFile.type, upsert: false });
    if (upErr) { setUploadingAdminProof(false); return; }
    const { data } = supabase.storage.from('payment-proofs').getPublicUrl(path);
    await supabase.from('orders').update({ admin_proof_url: data.publicUrl }).eq('id', orderId);
    setUploadingAdminProof(false);
    setAdminProofFile(null);
    void loadOrders();
    setSelectedOrder((prev) => prev ? { ...prev, admin_proof_url: data.publicUrl } : null);
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedOrder) return;
    setSendingMessage(true);
    await supabase.from('order_messages').insert({
      order_id: selectedOrder.id,
      sender: 'admin',
      message: newMessage.trim(),
    });
    await sendNotification(selectedOrder, 'admin_message', newMessage.trim());
    setNewMessage('');
    setSendingMessage(false);
  };

  const filtered = orders.filter((o) => {
    if (filter === 'ALL') return true;
    if (filter === 'TODAY') {
      const today = new Date().toISOString().slice(0, 10);
      return o.created_at.slice(0, 10) === today;
    }
    return o.status === filter;
  });

  const stats = {
    today: orders.filter((o) => o.created_at.slice(0, 10) === new Date().toISOString().slice(0, 10)).length,
    waiting: orders.filter((o) => o.status === 'WAITING_PAYMENT').length,
    reported: orders.filter((o) => o.status === 'PAYMENT_REPORTED').length,
    processing: orders.filter((o) => ['EXCHANGE_PROCESSING', 'SENDING_TO_BENEFICIARY', 'SENT'].includes(o.status)).length,
    completed: orders.filter((o) => o.status === 'COMPLETED').length,
    cancelled: orders.filter((o) => o.status === 'CANCELLED' || o.status === 'EXPIRED').length,
  };

  const currentStepIndex = ADMIN_STEPS.findIndex((s) => s.status === selectedOrder?.status);
  const isCompleted = selectedOrder?.status === 'COMPLETED';
  const isCancelled = selectedOrder?.status === 'CANCELLED' || selectedOrder?.status === 'EXPIRED';

  return (
    <section className="card mb-6 p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold">Órdenes de cambio</h2>
          <p className="text-sm text-white/50">Gestiona cada paso de la operación en tiempo real</p>
        </div>
        <button onClick={() => void loadOrders()} className="btn-ghost text-sm">
          <Loader2 size={14} className={loading ? 'animate-spin' : 'hidden'} /> Refrescar
        </button>
      </div>

      {loadError && (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {loadError}
        </div>
      )}

      {/* Stats */}
      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <OrderStat label="Hoy" value={stats.today} icon={<Package size={15} />} tone="text-electric-300" />
        <OrderStat label="Esperando pago" value={stats.waiting} icon={<Clock size={15} />} tone="text-gold-300" />
        <OrderStat label="Por verificar" value={stats.reported} icon={<Wallet size={15} />} tone="text-blue-300" />
        <OrderStat label="En proceso" value={stats.processing} icon={<Cog size={15} />} tone="text-purple-300" />
        <OrderStat label="Completadas" value={stats.completed} icon={<CheckCircle size={15} />} tone="text-green-300" />
        <OrderStat label="Canceladas" value={stats.cancelled} icon={<X size={15} />} tone="text-red-300" />
      </div>

      {/* Filter tabs */}
      <div className="mb-4 flex flex-wrap gap-2">
        {(['TODAY', 'ALL', 'WAITING_PAYMENT', 'PAYMENT_REPORTED', 'EXCHANGE_PROCESSING', 'COMPLETED', 'CANCELLED'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
              filter === f ? 'bg-electric-400 text-navy-950' : 'bg-white/5 text-white/50 hover:bg-white/10'
            }`}
          >
            {f === 'ALL' ? 'Todas' : f === 'TODAY' ? 'Hoy' : STATUS_LABELS[f]}
          </button>
        ))}
      </div>

      {/* Orders list */}
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-electric-400" /></div>
      ) : filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-white/40">No hay órdenes para mostrar.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((o) => {
            const cust = o.customers;
            return (
              <div key={o.id} className="rounded-xl border border-white/10 bg-white/[.03] p-3">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-electric-300">{o.order_number}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_COLORS[o.status]}`}>
                        {STATUS_LABELS[o.status]}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-white/60">
                      {cust ? `${cust.first_name} ${cust.last_name}` : '—'} · {formatNumber(o.source_amount, 2)} {o.source_currency} → {formatNumber(o.destination_amount, 2)} {o.destination_currency}
                    </p>
                    <p className="text-xs text-white/30">
                      Tasa: {formatNumber(o.exchange_rate_value, 4)} · {timeAgo(o.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => setSelectedOrder(o)} className="rounded-lg bg-white/5 p-2 text-white/60 hover:bg-white/10 hover:text-white" title="Ver detalle">
                      <Eye size={16} />
                    </button>
                    {o.status === 'PAYMENT_REPORTED' && (
                      <button onClick={() => updateOrderStatus(o.id, 'PAYMENT_CONFIRMED')} className="rounded-lg bg-green-500/15 p-2 text-green-300 hover:bg-green-500/25" title="Confirmar pago">
                        <Check size={16} />
                      </button>
                    )}
                    {cust && (
                      <a
                        href={`https://wa.me/${cust.whatsapp}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg bg-[#25d366]/15 p-2 text-[#25d366] hover:bg-[#25d366]/25"
                        title="Contactar WhatsApp"
                      >
                        <MessageCircle size={16} />
                      </a>
                    )}
                    {NEXT_STATUSES[o.status]?.includes('COMPLETED') && (
                      <button onClick={() => updateOrderStatus(o.id, 'COMPLETED')} className="rounded-lg bg-gold-400/15 p-2 text-gold-300 hover:bg-gold-400/25" title="Completar orden">
                        <CheckCircle size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm" onClick={() => setSelectedOrder(null)}>
          <div className="card my-8 w-full max-w-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="font-display text-xl font-bold">{selectedOrder.order_number}</h3>
                <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_COLORS[selectedOrder.status]}`}>
                  {STATUS_LABELS[selectedOrder.status]}
                </span>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="btn-ghost px-3 py-2"><X size={18} /></button>
            </div>

            {/* Step tracker */}
            <div className="mb-5 rounded-xl border border-white/10 bg-white/[.02] p-4">
              <p className="mb-3 text-sm font-bold text-white/60">Progreso de la orden</p>
              <div className="space-y-2">
                {ADMIN_STEPS.map((step, idx) => {
                  const done = idx < currentStepIndex || isCompleted;
                  const current = idx === currentStepIndex;
                  return (
                    <div key={step.status} className={`flex items-start gap-3 rounded-lg p-2 ${current ? 'bg-electric-400/10' : ''}`}>
                      <div className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        done ? 'bg-green-500/20 text-green-300' : current ? 'bg-electric-400 text-navy-950' : 'bg-white/10 text-white/30'
                      }`}>
                        {done ? <Check size={12} /> : idx + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-bold ${done || current ? 'text-white' : 'text-white/40'}`}>{step.label}</p>
                        <p className="text-xs text-white/40">{step.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3">
              <DetailRow label="Cliente" value={selectedOrder.customers ? `${selectedOrder.customers.first_name} ${selectedOrder.customers.last_name}` : '—'} />
              <DetailRow label="WhatsApp" value={selectedOrder.customers?.whatsapp ?? '—'} />
              <DetailRow label="Email" value={selectedOrder.customers?.email ?? '—'} />
              <DetailRow label="Beneficiario" value={selectedOrder.beneficiaries ? `${selectedOrder.beneficiaries.alias} (${selectedOrder.beneficiaries.full_name})` : '—'} />
              <DetailRow label="Cuenta" value={selectedOrder.beneficiaries ? `${selectedOrder.beneficiaries.bank} · ${selectedOrder.beneficiaries.account_number}` : '—'} />
              <DetailRow label="Envía" value={`${formatNumber(selectedOrder.source_amount, 2)} ${selectedOrder.source_currency}`} />
              <DetailRow label="Recibe" value={`${formatNumber(selectedOrder.destination_amount, 2)} ${selectedOrder.destination_currency}`} />
              <DetailRow label="Tasa congelada" value={formatNumber(selectedOrder.exchange_rate_value, 4)} />
              <DetailRow label="Creada" value={formatDate(selectedOrder.created_at)} />
              {selectedOrder.expires_at && <DetailRow label="Expira" value={formatDate(selectedOrder.expires_at)} />}
              {selectedOrder.confirmed_by_customer_at && <DetailRow label="Cliente confirmó" value={formatDate(selectedOrder.confirmed_by_customer_at)} />}
              {selectedOrder.admin_confirmed_at && <DetailRow label="Cerrada por admin" value={formatDate(selectedOrder.admin_confirmed_at)} />}
            </div>

            {/* Customer payment proof */}
            {selectedOrder.payment_proof_url && (
              <div className="mt-4">
                <p className="mb-2 text-sm font-medium text-white/60">Comprobante de pago del cliente</p>
                {selectedOrder.payment_proof_url.match(/\.(pdf)$/i) ? (
                  <a href={selectedOrder.payment_proof_url} target="_blank" rel="noopener noreferrer" className="btn-ghost text-sm">
                    <FileText size={16} /> Ver comprobante (PDF)
                  </a>
                ) : (
                  <img src={selectedOrder.payment_proof_url} alt="Comprobante del cliente" className="max-h-60 rounded-xl border border-white/10" />
                )}
              </div>
            )}

            {/* Admin proof of transfer to beneficiary */}
            <div className="mt-4 rounded-xl border border-electric-400/20 bg-electric-400/[.05] p-3">
              <p className="mb-2 text-sm font-medium text-electric-300">Comprobante de envío al beneficiario (admin)</p>
              {selectedOrder.admin_proof_url ? (
                <div className="space-y-2">
                  {selectedOrder.admin_proof_url.match(/\.(pdf)$/i) ? (
                    <a href={selectedOrder.admin_proof_url} target="_blank" rel="noopener noreferrer" className="btn-ghost text-sm">
                      <FileText size={16} /> Ver comprobante (PDF)
                    </a>
                  ) : (
                    <img src={selectedOrder.admin_proof_url} alt="Comprobante de envío" className="max-h-60 rounded-xl border border-white/10" />
                  )}
                  <label className="input-field flex cursor-pointer items-center gap-2 text-sm text-white/60">
                    <Upload size={14} className="text-electric-400" />
                    <span className="truncate">{adminProofFile ? adminProofFile.name : 'Reemplazar comprobante'}</span>
                    <input type="file" accept="image/jpeg,image/png,application/pdf" className="hidden" onChange={(e) => setAdminProofFile(e.target.files?.[0] ?? null)} />
                  </label>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <label className="input-field flex flex-1 cursor-pointer items-center gap-2 text-sm text-white/60">
                    <ImageIcon size={14} className="text-electric-400" />
                    <span className="truncate">{adminProofFile ? adminProofFile.name : 'Seleccionar comprobante de transferencia'}</span>
                    <input type="file" accept="image/jpeg,image/png,application/pdf" className="hidden" onChange={(e) => setAdminProofFile(e.target.files?.[0] ?? null)} />
                  </label>
                  <button onClick={() => handleUploadAdminProof(selectedOrder.id)} disabled={!adminProofFile || uploadingAdminProof} className="btn-primary text-sm">
                    {uploadingAdminProof ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Subir
                  </button>
                </div>
              )}
              {adminProofFile && selectedOrder.admin_proof_url && (
                <button onClick={() => handleUploadAdminProof(selectedOrder.id)} disabled={uploadingAdminProof} className="btn-primary mt-2 text-sm">
                  {uploadingAdminProof ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Subir nuevo
                </button>
              )}
            </div>

            {/* Messages */}
            <div className="mt-4 rounded-xl border border-white/10 bg-white/[.02] p-3">
              <p className="mb-2 text-sm font-medium text-white/60">Mensajes con el cliente</p>
              <div className="mb-3 max-h-48 space-y-2 overflow-y-auto">
                {messages.length === 0 ? (
                  <p className="py-3 text-center text-xs text-white/30">No hay mensajes aún. Escribe algo para notificar al cliente.</p>
                ) : (
                  messages.map((m) => (
                    <div key={m.id} className={`flex ${m.sender === 'admin' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${m.sender === 'admin' ? 'bg-electric-400/20 text-white' : 'bg-white/10 text-white/70'}`}>
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
                  placeholder="Escribe un mensaje al cliente..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSendMessage(); } }}
                />
                <button onClick={() => void handleSendMessage()} disabled={!newMessage.trim() || sendingMessage} className="btn-primary text-sm">
                  {sendingMessage ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                </button>
              </div>
            </div>

            {/* Status changer — step buttons */}
            {!isCompleted && !isCancelled && NEXT_STATUSES[selectedOrder.status] && (
              <div className="mt-4 rounded-xl border border-white/10 bg-white/[.02] p-3">
                <p className="mb-2 text-sm font-medium text-white/60">Avanzar al siguiente paso</p>
                <div className="flex flex-wrap gap-2">
                  {NEXT_STATUSES[selectedOrder.status]!.map((s) => (
                    <button
                      key={s}
                      onClick={() => updateOrderStatus(selectedOrder.id, s)}
                      disabled={actionLoading}
                      className={`rounded-lg px-3 py-2 text-xs font-bold ${STATUS_COLORS[s]} hover:opacity-80 disabled:opacity-50`}
                    >
                      <ArrowRight size={12} className="mr-1 inline" /> {STATUS_LABELS[s]}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-white/30">Al avanzar, el cliente verá el cambio en su seguimiento y recibirá un mensaje de WhatsApp.</p>
              </div>
            )}

            {(isCompleted || isCancelled) && (
              <div className="mt-4 rounded-xl border border-white/10 bg-white/[.02] p-3 text-center">
                <p className="text-sm text-white/50">
                  {isCompleted ? 'Esta orden está completada.' : 'Esta orden fue cancelada.'}
                </p>
              </div>
            )}

            {/* WhatsApp contact */}
            {selectedOrder.customers && (
              <a
                href={`https://wa.me/${selectedOrder.customers.whatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ghost mt-4 w-full"
              >
                <MessageCircle size={16} /> Contactar al cliente por WhatsApp
              </a>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function OrderStat({ label, value, icon, tone }: { label: string; value: number; icon: React.ReactNode; tone: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[.03] p-3">
      <div className={`mb-1 flex items-center gap-1.5 ${tone}`}>{icon}<span className="text-[10px] uppercase tracking-wide">{label}</span></div>
      <div className="font-display text-xl font-bold">{value}</div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-white/10 pb-2 last:border-0 last:pb-0">
      <span className="text-sm text-white/50">{label}</span>
      <span className="font-bold text-white">{value}</span>
    </div>
  );
}
