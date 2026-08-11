import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Package, ArrowRight, Eye, MessageCircle, X, Check, Plus } from 'lucide-react';
import { supabase, type Order, type OrderStatus, type OrderMessage } from '@/lib/supabase';
import { formatNumber, formatDate, timeAgo } from '@/lib/format';
import { Logo } from '@/components/Logo';
import { useAuth } from '@/context/AuthContext';

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

const STATUS_FLOW: { status: OrderStatus; label: string }[] = [
  { status: 'CREATED', label: 'Solicitud recibida' },
  { status: 'PAYMENT_REPORTED', label: 'Pago reportado' },
  { status: 'PAYMENT_CONFIRMED', label: 'Pago confirmado' },
  { status: 'EXCHANGE_PROCESSING', label: 'Cambio en proceso' },
  { status: 'SENDING_TO_BENEFICIARY', label: 'Enviando al beneficiario' },
  { status: 'COMPLETED', label: 'Operación completada' },
];

export function CustomerOrders() {
  const { user, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [messages, setMessages] = useState<OrderMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [history, setHistory] = useState<{ status: OrderStatus; created_at: string }[]>([]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/acceso');
    }
  }, [authLoading, user, navigate]);

  useEffect(() => {
    const load = async () => {
      if (!user?.email) return;
      const { data: customer } = await supabase.from('customers').select('id').eq('email', user.email).maybeSingle();
      if (!customer) {
        setLoading(false);
        return;
      }
      const { data: orderData } = await supabase.from('orders').select('*').eq('customer_id', customer.id).order('created_at', { ascending: false });
      setOrders((orderData as Order[]) ?? []);
      setLoading(false);

      const channel = supabase
        .channel('customer-orders')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `customer_id=eq.${customer.id}` }, async () => {
          const { data: refreshed } = await supabase.from('orders').select('*').eq('customer_id', customer.id).order('created_at', { ascending: false });
          setOrders((refreshed as Order[]) ?? []);
        })
        .subscribe();

      return () => { void supabase.removeChannel(channel); };
    };
    void load();
  }, [user]);

  useEffect(() => {
    if (!selectedOrder) return;
    const loadDetail = async () => {
      const [histRes, msgRes] = await Promise.all([
        supabase.from('order_status_history').select('status, created_at').eq('order_id', selectedOrder.id).order('created_at', { ascending: true }),
        supabase.from('order_messages').select('*').eq('order_id', selectedOrder.id).order('created_at', { ascending: true }),
      ]);
      setHistory((histRes.data as { status: OrderStatus; created_at: string }[]) ?? []);
      setMessages((msgRes.data as OrderMessage[]) ?? []);
    };
    void loadDetail();

    const channel = supabase
      .channel(`cust-order-${selectedOrder.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${selectedOrder.id}` }, (payload) => {
        setSelectedOrder(payload.new as Order);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'order_messages', filter: `order_id=eq.${selectedOrder.id}` }, (payload) => {
        setMessages((prev) => [...prev, payload.new as OrderMessage]);
      })
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [selectedOrder]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedOrder) return;
    setSendingMessage(true);
    await supabase.from('order_messages').insert({ order_id: selectedOrder.id, sender: 'customer', message: newMessage.trim() });
    setNewMessage('');
    setSendingMessage(false);
  };

  const handleConfirmReceipt = async () => {
    if (!selectedOrder) return;
    setConfirming(true);
    await supabase.from('orders').update({ confirmed_by_customer_at: new Date().toISOString() }).eq('id', selectedOrder.id);
    setSelectedOrder({ ...selectedOrder, confirmed_by_customer_at: new Date().toISOString() });
    setConfirming(false);
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-navy-950">
        <Loader2 size={32} className="animate-spin text-electric-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-navy-950 text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-navy-950/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 sm:px-6">
          <button onClick={() => navigate('/tasas')} className="flex items-center gap-2">
            <Logo size="sm" />
          </button>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/tasas')} className="btn-ghost text-sm">Ver tasas</button>
            <button onClick={() => void signOut()} className="btn-ghost text-sm">Salir</button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold">Mis operaciones</h1>
          <button onClick={() => navigate('/tasas')} className="btn-primary text-sm">
            <Plus size={16} /> <span className="hidden sm:inline">Nueva operación</span><span className="sm:hidden">Nueva</span>
          </button>
        </div>

        {orders.length === 0 ? (
          <div className="card p-8 text-center">
            <Package size={40} className="mx-auto mb-4 text-white/20" />
            <p className="text-white/50">Aún no tienes operaciones.</p>
            <button onClick={() => navigate('/tasas')} className="btn-primary mt-4 text-sm">
              Realizar un cambio <ArrowRight size={14} />
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((o) => (
              <div key={o.id} className="card p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-electric-300">{o.order_number}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_COLORS[o.status]}`}>
                        {STATUS_LABELS[o.status]}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-white/60">
                      {formatNumber(o.source_amount, 2)} {o.source_currency} → {formatNumber(o.destination_amount, 2)} {o.destination_currency}
                    </p>
                    <p className="text-xs text-white/30">{timeAgo(o.created_at)}</p>
                  </div>
                  <button onClick={() => setSelectedOrder(o)} className="btn-ghost text-sm">
                    <Eye size={16} /> Ver seguimiento
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

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

            <div className="mb-5 rounded-xl border border-white/10 bg-white/[.02] p-4">
              <p className="mb-3 text-sm font-bold text-white/60">Progreso de la orden</p>
              <div className="space-y-2">
                {STATUS_FLOW.map((s, idx) => {
                  const completedIdx = STATUS_FLOW.findIndex((x) => x.status === selectedOrder.status);
                  const done = idx <= completedIdx;
                  const current = idx === completedIdx;
                  const histEntry = history.find((h) => h.status === s.status);
                  return (
                    <div key={s.status} className={`flex items-start gap-3 rounded-lg p-2 ${current ? 'bg-electric-400/10' : ''}`}>
                      <div className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${done ? 'bg-green-500/20 text-green-300' : current ? 'bg-electric-400 text-navy-950' : 'bg-white/10 text-white/30'}`}>
                        {done ? <Check size={12} /> : idx + 1}
                      </div>
                      <div>
                        <p className={`text-sm font-bold ${done || current ? 'text-white' : 'text-white/40'}`}>{s.label}</p>
                        {histEntry && <p className="text-xs text-white/30">{formatDate(histEntry.created_at)}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <DetailRow label="Envía" value={`${formatNumber(selectedOrder.source_amount, 2)} ${selectedOrder.source_currency}`} />
              <DetailRow label="Recibe" value={`${formatNumber(selectedOrder.destination_amount, 2)} ${selectedOrder.destination_currency}`} />
              <DetailRow label="Tasa" value={formatNumber(selectedOrder.exchange_rate_value, 4)} />
              <DetailRow label="Creada" value={formatDate(selectedOrder.created_at)} />
            </div>

            {selectedOrder.payment_proof_url && (
              <div className="mt-4">
                <p className="mb-2 text-sm font-medium text-white/60">Tu comprobante de pago</p>
                <img src={selectedOrder.payment_proof_url} alt="Comprobante" className="max-h-40 rounded-xl border border-white/10" />
              </div>
            )}

            {selectedOrder.admin_proof_url && (
              <div className="mt-4 rounded-xl border border-electric-400/20 bg-electric-400/[.05] p-3">
                <p className="mb-2 text-sm font-bold text-electric-300">Comprobante de envío del administrador</p>
                <img src={selectedOrder.admin_proof_url} alt="Comprobante de envío" className="max-h-40 rounded-xl border border-white/10" />
              </div>
            )}

            {(selectedOrder.status === 'SENT' || selectedOrder.status === 'COMPLETED') && !selectedOrder.confirmed_by_customer_at && selectedOrder.status !== 'COMPLETED' && (
              <div className="mt-4 rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-center">
                <p className="mb-3 text-sm text-green-200">¿Llegó el dinero a tu beneficiario? Confirma la recepción.</p>
                <button onClick={() => void handleConfirmReceipt()} disabled={confirming} className="btn-primary">
                  {confirming ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Confirmar recepción
                </button>
              </div>
            )}
            {selectedOrder.confirmed_by_customer_at && (
              <div className="mt-4 rounded-xl border border-green-500/20 bg-green-500/5 p-3 text-center text-sm text-green-300">
                Recepción confirmada el {formatDate(selectedOrder.confirmed_by_customer_at)}
              </div>
            )}

            <div className="mt-4 rounded-xl border border-white/10 bg-white/[.02] p-3">
              <p className="mb-2 text-sm font-medium text-white/60">Mensajes</p>
              <div className="mb-3 max-h-48 space-y-2 overflow-y-auto">
                {messages.length === 0 ? (
                  <p className="py-3 text-center text-xs text-white/30">No hay mensajes.</p>
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
                  {sendingMessage ? <Loader2 size={14} className="animate-spin" /> : <MessageCircle size={14} />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
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
