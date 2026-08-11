import { useEffect, useState, useCallback } from 'react';
import { Loader2, Users, Search, MessageCircle } from 'lucide-react';
import { supabase, type Customer } from '@/lib/supabase';
import { formatDate } from '@/lib/format';

export function AdminCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);
    setLoading(false);
    if (error) return;
    setCustomers((data as Customer[]) ?? []);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = customers.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      c.first_name?.toLowerCase().includes(q) ||
      c.last_name?.toLowerCase().includes(q) ||
      c.whatsapp?.includes(q) ||
      c.email?.toLowerCase().includes(q)
    );
  });

  return (
    <section className="card mb-6 p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold">Clientes registrados</h2>
          <p className="text-sm text-white/50">{customers.length} cliente{customers.length !== 1 ? 's' : ''} en total</p>
        </div>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            className="input-field pl-9 text-sm"
            placeholder="Buscar por nombre, WhatsApp o email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-6"><Loader2 size={22} className="animate-spin text-electric-400" /></div>
      ) : filtered.length === 0 ? (
        <div className="py-6 text-center">
          <Users size={32} className="mx-auto mb-2 text-white/20" />
          <p className="text-sm text-white/40">No hay clientes registrados todavía.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[.03] p-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-electric-400/15 text-sm font-bold text-electric-300">
                {c.first_name?.[0]?.toUpperCase() ?? '?'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold">{c.first_name} {c.last_name}</p>
                <p className="text-xs text-white/40">
                  <span className="font-mono">{c.whatsapp}</span>
                  {c.email && ` · ${c.email}`}
                </p>
                <p className="text-xs text-white/25">Registrado: {formatDate(c.created_at)}</p>
              </div>
              <a
                href={`https://wa.me/${c.whatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg bg-[#25d366]/15 p-2 text-[#25d366] hover:bg-[#25d366]/25"
                title="Contactar por WhatsApp"
              >
                <MessageCircle size={16} />
              </a>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
