import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowDown, Calculator, Loader2, ArrowRight } from 'lucide-react';
import type { ExchangeRate } from '@/lib/supabase';
import { formatNumber } from '@/lib/format';

type Props = {
  rates: ExchangeRate[];
};

export function CalculatorWidget({ rates }: Props) {
  const navigate = useNavigate();
  const activeRates = useMemo(() => rates.filter((r) => r.active), [rates]);
  const [sourceCurrency, setSourceCurrency] = useState('');
  const [destCurrency, setDestCurrency] = useState('');
  const [amount, setAmount] = useState('');
  const [result, setResult] = useState<number | null>(null);
  const [usedRate, setUsedRate] = useState<number | null>(null);
  const [usedRateRow, setUsedRateRow] = useState<ExchangeRate | null>(null);
  const [calculating, setCalculating] = useState(false);

  // Extract currency options from rate codes
  const currencyOptions = useMemo(() => {
    const map = new Map<string, string>();
    activeRates.forEach((r) => {
      const parts = r.currency_code.split('_');
      if (parts[0]) map.set(parts[0], parts[0]);
      if (parts[1]) map.set(parts[1], parts[1]);
    });
    return Array.from(map.keys()).sort();
  }, [activeRates]);

  // Find a matching rate for the selected route
  const findRate = (src: string, dst: string): ExchangeRate | null => {
    const direct = activeRates.find((r) => {
      const parts = r.currency_code.split('_');
      return parts[0] === src && parts[1] === dst;
    });
    if (direct) return direct;
    // Try reverse route
    const reverse = activeRates.find((r) => {
      const parts = r.currency_code.split('_');
      return parts[0] === dst && parts[1] === src;
    });
    return reverse ?? null;
  };

  const handleCalculate = () => {
    setCalculating(true);
    const src = sourceCurrency;
    const dst = destCurrency;
    const amt = parseFloat(amount);

    if (!src || !dst || !amt || amt <= 0) {
      setCalculating(false);
      setResult(null);
      setUsedRate(null);
      setUsedRateRow(null);
      return;
    }

    const rateRow = findRate(src, dst);
    if (!rateRow) {
      setCalculating(false);
      setResult(null);
      setUsedRate(null);
      setUsedRateRow(null);
      return;
    }

    const parts = rateRow.currency_code.split('_');
    const isForward = parts[0] === src && parts[1] === dst;
    const rate = rateRow.rate;
    let calcResult: number;

    if (isForward) {
      calcResult = rateRow.calculation_type === 'MULTIPLY' ? amt * rate : amt / rate;
    } else {
      // Reverse: invert the operation
      calcResult = rateRow.calculation_type === 'MULTIPLY' ? amt / rate : amt * rate;
    }

    setUsedRate(rate);
    setUsedRateRow(rateRow);
    setResult(calcResult);
    setTimeout(() => setCalculating(false), 300);
  };

  const destDecimals = usedRateRow?.decimals ?? 2;

  return (
    <div className="card p-6 sm:p-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-electric-500/15">
          <Calculator size={22} className="text-electric-400" />
        </div>
        <div>
          <h2 className="font-display text-xl font-bold">Calcula tu cambio</h2>
          <p className="text-sm text-white/50">Selecciona monedas y monto para ver tu estimación</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Source */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-white/60">Moneda origen</label>
          <select
            value={sourceCurrency}
            onChange={(e) => setSourceCurrency(e.target.value)}
            className="input-field"
          >
            <option value="">Selecciona...</option>
            {currencyOptions.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Amount */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-white/60">Monto a enviar</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="input-field font-mono text-lg"
            placeholder="0.00"
          />
        </div>

        {/* Arrow */}
        <div className="flex justify-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-electric-400/30 bg-electric-500/10">
            <ArrowDown size={18} className="text-electric-400" />
          </div>
        </div>

        {/* Destination */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-white/60">Moneda destino</label>
          <select
            value={destCurrency}
            onChange={(e) => setDestCurrency(e.target.value)}
            className="input-field"
          >
            <option value="">Selecciona...</option>
            {currencyOptions.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <button onClick={handleCalculate} className="btn-primary w-full" disabled={calculating}>
          {calculating ? <Loader2 size={18} className="animate-spin" /> : <Calculator size={18} />}
          Calcular
        </button>

        {result !== null && usedRate !== null && usedRateRow && (
          <div className="animate-fade-in rounded-2xl border border-electric-400/20 bg-electric-500/5 p-5">
            <div className="mb-3 flex items-center justify-between text-sm">
              <span className="text-white/50">Tasa utilizada</span>
              <span className="font-mono font-semibold text-electric-300">
                {formatNumber(usedRate, 4)}
              </span>
            </div>
            <div className="mb-1 text-sm text-white/50">Monto estimado a recibir</div>
            <div className="font-mono text-3xl font-bold text-gold-400">
              {formatNumber(result, destDecimals)} {destCurrency}
            </div>
            <div className="mt-3 text-xs text-white/30">
              {sourceCurrency} → {destCurrency} · {usedRateRow.calculation_type}
            </div>
            <button
              onClick={() =>
                navigate(
                  `/orden/nueva?rate_id=${usedRateRow.id}&src=${sourceCurrency}&dst=${destCurrency}&amt=${amount}&result=${result}`,
                )
              }
              className="btn-gold mt-4 w-full"
            >
              <ArrowRight size={18} /> Realizar este cambio
            </button>
          </div>
        )}

        {result === null && sourceCurrency && destCurrency && amount && !calculating && (
          <div className="rounded-xl border border-gold-400/20 bg-gold-400/5 px-4 py-3 text-sm text-gold-300">
            No hay ruta configurada para {sourceCurrency} → {destCurrency}. Contacta por WhatsApp para una cotización personalizada.
          </div>
        )}
      </div>
    </div>
  );
}
