/*
# Create customers, beneficiaries, orders, order status history, and order ratings tables

1. New Tables
- `customers`: stores customer profiles (name, lastname, whatsapp, email). One profile per person.
  - `id` (uuid, primary key)
  - `first_name` (text, not null)
  - `last_name` (text, not null)
  - `whatsapp` (text, not null) — digits only, includes country code
  - `email` (text, nullable, optional)
  - `created_at` (timestamptz, default now)
- `beneficiaries`: stores bank account / recipient info saved by a customer for reuse across orders.
  - `id` (uuid, primary key)
  - `customer_id` (uuid, FK -> customers.id ON DELETE CASCADE)
  - `full_name` (text, not null)
  - `document_id` (text, not null)
  - `bank` (text, not null)
  - `account_type` (text, not null) — e.g. Ahorros, Corriente
  - `account_number` (text, not null)
  - `currency` (text, not null)
  - `country` (text, not null)
  - `alias` (text, not null) — e.g. "Mamá Venezuela"
  - `created_at` (timestamptz, default now)
- `orders`: the core exchange order. Stores a SNAPSHOT of the rate used so historical orders never change when public rates update.
  - `id` (uuid, primary key)
  - `order_number` (text, unique, not null) — e.g. BJ-260809-0001
  - `customer_id` (uuid, FK -> customers.id)
  - `beneficiary_id` (uuid, nullable, FK -> beneficiaries.id)
  - `source_currency` (text, not null)
  - `destination_currency` (text, not null)
  - `source_amount` (numeric, not null)
  - `destination_amount` (numeric, not null)
  - `exchange_rate_snapshot` (jsonb, not null) — full copy of the ExchangeRate row at creation time
  - `exchange_rate_value` (numeric, not null) — the numeric rate applied
  - `exchange_rate_calc_type` (text, not null) — MULTIPLY or DIVIDE
  - `payment_proof_url` (text, nullable) — public URL of uploaded comprobante
  - `status` (text, not null, default 'CREATED')
  - `expires_at` (timestamptz, nullable)
  - `created_at` (timestamptz, default now)
  - `updated_at` (timestamptz, default now)
- `order_status_history`: one row per status transition, with timestamp. Powers the visual timeline.
  - `id` (uuid, primary key)
  - `order_id` (uuid, FK -> orders.id ON DELETE CASCADE)
  - `status` (text, not null)
  - `note` (text, nullable)
  - `changed_by` (uuid, nullable) — admin user_id if changed from dashboard
  - `created_at` (timestamptz, default now)
- `order_ratings`: customer rating + review left when the order completes.
  - `id` (uuid, primary key)
  - `order_id` (uuid, FK -> orders.id ON DELETE CASCADE, unique)
  - `rating` (integer, not null, check 1-5)
  - `review` (text, nullable)
  - `review_date` (timestamptz, default now)
2. Security
- Enable RLS on all new tables.
- customers/beneficiaries/orders/order_status_history/order_ratings: public read+write via anon+authenticated (no-auth public app — the customer is not a signed-in admin user). The admin dashboard (authenticated superadmin/admin) also reads/writes these tables.
- All policies use `TO anon, authenticated` with `USING (true)` / `WITH CHECK (true)` because this is a public-facing exchange app where orders are created by anonymous visitors.
3. Indexes
- orders.order_number (unique)
- orders.customer_id
- orders.status
- orders.created_at
- beneficiaries.customer_id
- order_status_history.order_id
4. Important notes
- The order stores a FULL COPY of the rate row in `exchange_rate_snapshot` (jsonb) plus the numeric value in `exchange_rate_value`. If the public rate changes later, the historical order is unaffected.
- Order numbers are generated as BJ-YYMMDD-NNNN via a SECURITY DEFINER function `generate_order_number()` that is atomic and safe to call from the anon client.
- A trigger auto-inserts the first `order_status_history` row (status = 'CREATED') when an order is inserted.
- `expires_at` is set by the frontend (default 30 minutes from creation) to drive the countdown timer.
*/

CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  whatsapp text NOT NULL,
  email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_customers" ON customers;
CREATE POLICY "anon_select_customers" ON customers FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_customers" ON customers;
CREATE POLICY "anon_insert_customers" ON customers FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_customers" ON customers;
CREATE POLICY "anon_update_customers" ON customers FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_customers" ON customers;
CREATE POLICY "anon_delete_customers" ON customers FOR DELETE
  TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS beneficiaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  document_id text NOT NULL,
  bank text NOT NULL,
  account_type text NOT NULL,
  account_number text NOT NULL,
  currency text NOT NULL,
  country text NOT NULL,
  alias text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE beneficiaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_beneficiaries" ON beneficiaries;
CREATE POLICY "anon_select_beneficiaries" ON beneficiaries FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_beneficiaries" ON beneficiaries;
CREATE POLICY "anon_insert_beneficiaries" ON beneficiaries FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_beneficiaries" ON beneficiaries;
CREATE POLICY "anon_update_beneficiaries" ON beneficiaries FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_beneficiaries" ON beneficiaries;
CREATE POLICY "anon_delete_beneficiaries" ON beneficiaries FOR DELETE
  TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text UNIQUE NOT NULL,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  beneficiary_id uuid REFERENCES beneficiaries(id) ON DELETE SET NULL,
  source_currency text NOT NULL,
  destination_currency text NOT NULL,
  source_amount numeric NOT NULL,
  destination_amount numeric NOT NULL,
  exchange_rate_snapshot jsonb NOT NULL,
  exchange_rate_value numeric NOT NULL,
  exchange_rate_calc_type text NOT NULL,
  payment_proof_url text,
  status text NOT NULL DEFAULT 'CREATED',
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_orders" ON orders;
CREATE POLICY "anon_select_orders" ON orders FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_orders" ON orders;
CREATE POLICY "anon_insert_orders" ON orders FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_orders" ON orders;
CREATE POLICY "anon_update_orders" ON orders FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_orders" ON orders;
CREATE POLICY "anon_delete_orders" ON orders FOR DELETE
  TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS order_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status text NOT NULL,
  note text,
  changed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_order_status_history" ON order_status_history;
CREATE POLICY "anon_select_order_status_history" ON order_status_history FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_order_status_history" ON order_status_history;
CREATE POLICY "anon_insert_order_status_history" ON order_status_history FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_order_status_history" ON order_status_history;
CREATE POLICY "anon_update_order_status_history" ON order_status_history FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_order_status_history" ON order_status_history;
CREATE POLICY "anon_delete_order_status_history" ON order_status_history FOR DELETE
  TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS order_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review text,
  review_date timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE order_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_order_ratings" ON order_ratings;
CREATE POLICY "anon_select_order_ratings" ON order_ratings FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_order_ratings" ON order_ratings;
CREATE POLICY "anon_insert_order_ratings" ON order_ratings FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_order_ratings" ON order_ratings;
CREATE POLICY "anon_update_order_ratings" ON order_ratings FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_order_ratings" ON order_ratings;
CREATE POLICY "anon_delete_order_ratings" ON order_ratings FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_beneficiaries_customer_id ON beneficiaries(customer_id);
CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id ON order_status_history(order_id);

-- Atomic order number generator: BJ-YYMMDD-NNNN
-- Uses a per-day counter stored in a helper table to guarantee sequential numbering.
CREATE TABLE IF NOT EXISTS order_number_seq (
  seq_date date PRIMARY KEY,
  last_seq integer NOT NULL DEFAULT 0
);

ALTER TABLE order_number_seq ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_all_order_number_seq" ON order_number_seq;
CREATE POLICY "anon_all_order_number_seq" ON order_number_seq
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- SECURITY DEFINER function so the anon client can atomically get the next order number
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := CURRENT_DATE;
  v_next integer;
  v_result text;
BEGIN
  INSERT INTO order_number_seq (seq_date, last_seq)
  VALUES (v_today, 1)
  ON CONFLICT (seq_date)
  DO UPDATE SET last_seq = order_number_seq.last_seq + 1
  RETURNING last_seq INTO v_next;

  v_result := 'BJ-' || to_char(v_today, 'YYMMDD') || '-' || lpad(v_next::text, 4, '0');
  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION generate_order_number() TO anon, authenticated;

-- Trigger: auto-insert first status history row when an order is created
CREATE OR REPLACE FUNCTION insert_initial_order_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO order_status_history (order_id, status, note)
  VALUES (NEW.id, NEW.status, 'Orden creada');
  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION insert_initial_order_status() TO anon, authenticated;

DROP TRIGGER IF EXISTS trg_order_initial_status ON orders;
CREATE TRIGGER trg_order_initial_status
  AFTER INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION insert_initial_order_status();

-- Trigger: auto-insert a status history row when orders.status is updated
CREATE OR REPLACE FUNCTION log_order_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO order_status_history (order_id, status, note, changed_by)
    VALUES (NEW.id, NEW.status, NULL, NULL);
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION log_order_status_change() TO anon, authenticated;

DROP TRIGGER IF EXISTS trg_order_status_change ON orders;
CREATE TRIGGER trg_order_status_change
  BEFORE UPDATE ON orders
  FOR EACH ROW
  WHEN (NEW.status IS DISTINCT FROM OLD.status)
  EXECUTE FUNCTION log_order_status_change();