/*
# BitJhoins - Tasa del Día (Phase 1)

## Overview
Creates the exchange rate management system for BitJhoins currency exchange platform.
The admin manages rates for multiple countries; a public page displays the "Tasa del Día".
Every publish action snapshots the full rate set into a history table for audit.

## New Tables

### `exchange_rates`
Stores the current published configuration for each currency route.
- `id` (uuid, primary key)
- `currency_code` (text, unique) - e.g. "COP_VES", "USD_VES"
- `country` (text) - display country/region label
- `display_name` (text) - human-friendly name shown publicly
- `rate` (numeric, 20,8) - the final published rate
- `calculation_type` (text) - "MULTIPLY" or "DIVIDE"
- `calculation_mode` (text) - "MANUAL" or "AUTOMATIC"
- `usdt_base_price` (numeric) - USDT base price for automatic calc
- `currency_reference_price` (numeric) - reference price for automatic calc
- `margin_percentage` (numeric) - margin % applied for automatic calc
- `decimals` (int) - display decimal places for destination currency
- `active` (boolean) - whether shown publicly
- `display_order` (int) - sort order on public page
- `published_at` (timestamptz) - last publish timestamp
- `created_at`, `updated_at` (timestamptz)

### `rate_history`
Append-only snapshot of every rate at each publish event.
- `id` (uuid, primary key)
- `publish_id` (uuid) - groups all rows from one publish action
- `currency_code` (text)
- `display_name` (text)
- `rate` (numeric, 20,8)
- `calculation_type` (text)
- `published_at` (timestamptz)
- `published_by` (text) - admin email
- `snapshot` (jsonb) - full row snapshot for audit

## Security
- RLS enabled on both tables.
- `exchange_rates`: SELECT is public (anon+authenticated) so the public page works;
  write operations (INSERT/UPDATE/DELETE) are restricted to authenticated admins.
- `rate_history`: SELECT restricted to authenticated admins (audit data);
  INSERT allowed for authenticated (admins publish snapshots).

## Notes
1. The app uses Supabase email/password auth for admin access.
2. Public /tasas page reads exchange_rates with anon key.
3. Rate snapshots preserve historical order integrity.
*/

CREATE TABLE IF NOT EXISTS exchange_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  currency_code text UNIQUE NOT NULL,
  country text NOT NULL,
  display_name text NOT NULL,
  rate numeric(20,8) NOT NULL DEFAULT 0,
  calculation_type text NOT NULL DEFAULT 'DIVIDE' CHECK (calculation_type IN ('MULTIPLY','DIVIDE')),
  calculation_mode text NOT NULL DEFAULT 'MANUAL' CHECK (calculation_mode IN ('MANUAL','AUTOMATIC')),
  usdt_base_price numeric(20,8),
  currency_reference_price numeric(20,8),
  margin_percentage numeric(10,4) DEFAULT 0,
  decimals integer NOT NULL DEFAULT 2,
  active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  published_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;

-- Public read for the /tasas page
DROP POLICY IF EXISTS "public_read_exchange_rates" ON exchange_rates;
CREATE POLICY "public_read_exchange_rates"
ON exchange_rates FOR SELECT
TO anon, authenticated USING (true);

-- Admin write (authenticated)
DROP POLICY IF EXISTS "admin_insert_exchange_rates" ON exchange_rates;
CREATE POLICY "admin_insert_exchange_rates"
ON exchange_rates FOR INSERT
TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "admin_update_exchange_rates" ON exchange_rates;
CREATE POLICY "admin_update_exchange_rates"
ON exchange_rates FOR UPDATE
TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admin_delete_exchange_rates" ON exchange_rates;
CREATE POLICY "admin_delete_exchange_rates"
ON exchange_rates FOR DELETE
TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS rate_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publish_id uuid NOT NULL DEFAULT gen_random_uuid(),
  currency_code text NOT NULL,
  display_name text NOT NULL,
  rate numeric(20,8) NOT NULL,
  calculation_type text NOT NULL,
  published_at timestamptz DEFAULT now(),
  published_by text,
  snapshot jsonb
);

ALTER TABLE rate_history ENABLE ROW LEVEL SECURITY;

-- Admin read for history/audit
DROP POLICY IF EXISTS "admin_read_rate_history" ON rate_history;
CREATE POLICY "admin_read_rate_history"
ON rate_history FOR SELECT
TO authenticated USING (true);

-- Admin insert for publish snapshots
DROP POLICY IF EXISTS "admin_insert_rate_history" ON rate_history;
CREATE POLICY "admin_insert_rate_history"
ON rate_history FOR INSERT
TO authenticated WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_rate_history_published_at ON rate_history(published_at desc);
CREATE INDEX IF NOT EXISTS idx_rate_history_publish_id ON rate_history(publish_id);

-- Seed initial currencies
INSERT INTO exchange_rates (currency_code, country, display_name, rate, calculation_type, calculation_mode, decimals, active, display_order) VALUES
('COP_VES', 'Colombia', 'Colombia (COP → VES)', 3.96, 'DIVIDE', 'MANUAL', 2, true, 1),
('VESCOL_VES', 'Venezuela a Colombia', 'Venezuela → Colombia (VES → COP)', 0.25, 'MULTIPLY', 'MANUAL', 0, true, 2),
('CLP_VES', 'Chile', 'Chile (CLP → VES)', 0.0042, 'MULTIPLY', 'MANUAL', 2, true, 3),
('PEN_VES', 'Perú', 'Perú (PEN → VES)', 1.05, 'MULTIPLY', 'MANUAL', 2, true, 4),
('EUR_VES', 'España', 'España (EUR → VES)', 4.30, 'MULTIPLY', 'MANUAL', 2, true, 5),
('USD_VES', 'EEUU / Zelle', 'EEUU / Zelle (USD → VES)', 3.95, 'MULTIPLY', 'MANUAL', 2, true, 6),
('USD_VES_ECU', 'Ecuador', 'Ecuador (USD → VES)', 3.90, 'MULTIPLY', 'MANUAL', 2, true, 7),
('USD_VES_PAN', 'Panamá', 'Panamá (USD → VES)', 3.88, 'MULTIPLY', 'MANUAL', 2, true, 8),
('MXN_VES', 'México', 'México (MXN → VES)', 0.22, 'MULTIPLY', 'MANUAL', 2, true, 9),
('CRC_VES', 'Costa Rica', 'Costa Rica (CRC → VES)', 0.0075, 'MULTIPLY', 'MANUAL', 2, true, 10),
('EFECTIVO_VES', 'Efectivo Venezuela', 'Efectivo Venezuela (USD → VES)', 4.05, 'MULTIPLY', 'MANUAL', 2, true, 11),
('USD_VES_PAYPAL', 'PayPal', 'PayPal (USD → VES)', 3.80, 'MULTIPLY', 'MANUAL', 2, true, 12)
ON CONFLICT (currency_code) DO NOTHING;

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_exchange_rates_updated ON exchange_rates;
CREATE TRIGGER trg_exchange_rates_updated
BEFORE UPDATE ON exchange_rates
FOR EACH ROW EXECUTE FUNCTION update_updated_at();
