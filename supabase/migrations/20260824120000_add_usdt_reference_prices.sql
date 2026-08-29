/*
# Precios USDT de referencia (Binance)

El jefe calcula todas las tasas partiendo del precio USDT de Binance por país
(ej. VES 871, COP 3.129). Esta tabla guarda esos precios UNA sola vez;
cada tasa en modo AUTOMATIC se enlaza a dos monedas de referencia
(auto_base_currency / auto_quote_currency) y su fórmula es:

  rate = precio(base) / precio(quote) * (1 + margen/100)

El margen puede ser negativo (ej. -10%). Para las rutas "tasa USDT vez"
(Zelle, Ecuador, Panamá, PayPal...) el quote es USD con precio 1.
*/

CREATE TABLE IF NOT EXISTS usdt_reference_prices (
  currency_code text PRIMARY KEY,
  display_name text NOT NULL DEFAULT '',
  usdt_price numeric(20,8) NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE usdt_reference_prices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_usdt_reference_prices" ON usdt_reference_prices;
CREATE POLICY "public_read_usdt_reference_prices"
ON usdt_reference_prices FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "admin_insert_usdt_reference_prices" ON usdt_reference_prices;
CREATE POLICY "admin_insert_usdt_reference_prices"
ON usdt_reference_prices FOR INSERT
TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "admin_update_usdt_reference_prices" ON usdt_reference_prices;
CREATE POLICY "admin_update_usdt_reference_prices"
ON usdt_reference_prices FOR UPDATE
TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admin_delete_usdt_reference_prices" ON usdt_reference_prices;
CREATE POLICY "admin_delete_usdt_reference_prices"
ON usdt_reference_prices FOR DELETE
TO authenticated USING (true);

DROP TRIGGER IF EXISTS trg_usdt_reference_prices_updated ON usdt_reference_prices;
CREATE TRIGGER trg_usdt_reference_prices_updated
BEFORE UPDATE ON usdt_reference_prices
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Monedas de referencia con las que trabaja el jefe hoy
INSERT INTO usdt_reference_prices (currency_code, display_name, usdt_price) VALUES
('VES', 'Bolívar (Binance USDT/VES)', 871),
('COP', 'Peso colombiano (Binance USDT/COP)', 3129),
('CLP', 'Peso chileno (Binance USDT/CLP)', 921),
('PEN', 'Sol peruano (Binance USDT/PEN)', 3.39),
('EUR', 'Euro (tasa Bizum)', 0.880),
('USD', 'Dólar (USDT = 1)', 1),
('MXN', 'Peso mexicano (tasa del tercero)', 0)
ON CONFLICT (currency_code) DO NOTHING;

-- Enlace de cada tasa automática con sus dos monedas de referencia
ALTER TABLE exchange_rates ADD COLUMN IF NOT EXISTS auto_base_currency text;
ALTER TABLE exchange_rates ADD COLUMN IF NOT EXISTS auto_quote_currency text;

/*
## Actualización automática desde Binance P2P (cada hora)

Extensión `http` (llamadas sincrónicas) + `pg_cron`. Cada hora se consulta
el P2P de Binance por cada moneda marcada con auto_update, se promedian los
primeros 5 anuncios (igual que hace el jefe a ojo: 870-874 → ~871) y se
recalculan y publican todas las tasas AUTOMATIC enlazadas.
*/

CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron;

ALTER TABLE usdt_reference_prices ADD COLUMN IF NOT EXISTS auto_update boolean NOT NULL DEFAULT false;
UPDATE usdt_reference_prices SET auto_update = true WHERE currency_code IN ('VES','COP','CLP','PEN','EUR');

CREATE OR REPLACE FUNCTION fetch_binance_usdt_price(p_fiat text)
RETURNS numeric
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  resp extensions.http_response;
  avg_price numeric;
BEGIN
  resp := extensions.http((
    'POST',
    'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search',
    ARRAY[extensions.http_header('Accept','application/json')],
    'application/json',
    json_build_object(
      'asset','USDT','fiat',p_fiat,'tradeType','BUY',
      'page',1,'rows',5,'payTypes',json_build_array(),'publisherType',null
    )::text
  )::extensions.http_request);
  IF resp.status <> 200 THEN RETURN NULL; END IF;
  SELECT round(avg((elem->'adv'->>'price')::numeric), 4)
    INTO avg_price
    FROM json_array_elements((resp.content::json)->'data') elem;
  RETURN avg_price;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION update_binance_rates()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  r record;
  p numeric;
  updated int := 0;
  recalced int := 0;
BEGIN
  FOR r IN SELECT currency_code FROM usdt_reference_prices WHERE auto_update LOOP
    p := fetch_binance_usdt_price(r.currency_code);
    IF p IS NOT NULL AND p > 0 THEN
      UPDATE usdt_reference_prices
         SET usdt_price = p, updated_at = now()
       WHERE currency_code = r.currency_code;
      updated := updated + 1;
    END IF;
  END LOOP;

  UPDATE exchange_rates e
     SET usdt_base_price = b.usdt_price,
         currency_reference_price = q.usdt_price,
         rate = (b.usdt_price / q.usdt_price) * (1 + coalesce(e.margin_percentage, 0) / 100),
         published_at = now()
    FROM usdt_reference_prices b, usdt_reference_prices q
   WHERE e.calculation_mode = 'AUTOMATIC'
     AND e.auto_base_currency = b.currency_code
     AND e.auto_quote_currency = q.currency_code
     AND b.usdt_price > 0 AND q.usdt_price > 0;
  GET DIAGNOSTICS recalced = ROW_COUNT;

  RETURN jsonb_build_object('updated_prices', updated, 'recalced_rates', recalced, 'at', now());
END $$;

REVOKE EXECUTE ON FUNCTION update_binance_rates() FROM public, anon;
GRANT EXECUTE ON FUNCTION update_binance_rates() TO authenticated;
REVOKE EXECUTE ON FUNCTION fetch_binance_usdt_price(text) FROM public, anon, authenticated;

-- Cada hora, minuto 5
SELECT cron.schedule('binance-rates-hourly', '5 * * * *', $$SELECT public.update_binance_rates()$$);

-- Primera corrida inmediata para dejar precios reales
SELECT public.update_binance_rates();
