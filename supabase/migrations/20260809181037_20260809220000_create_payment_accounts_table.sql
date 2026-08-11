/*
# Create payment_accounts table

Stores the bank accounts where customers must send their payment, grouped by currency.
The admin can configure multiple accounts per currency (e.g. several Colombian peso accounts,
several Peruvian sol accounts, etc.). The payment screen displays all active accounts for the
order's source currency so the customer can choose where to transfer.

1. New Table
- `payment_accounts`
  - id (uuid, primary key)
  - currency (text, not null) — e.g. COP, PEN, CLP, VES, USD
  - bank_name (text, not null)
  - account_holder (text, not null)
  - account_number (text, not null)
  - account_type (text, not null) — Ahorros, Corriente, etc.
  - document_id (text, not null) — CI/RIF
  - phone (text, nullable) — for mobile payment (Pago Móvil / Nequi / etc.)
  - payment_method (text, not null) — Transferencia, Pago Móvil, Nequi, Daviplata, etc.
  - active (boolean, default true)
  - display_order (integer, default 0)
  - created_at (timestamptz, default now)
  - updated_at (timestamptz, default now)
2. Security
- RLS enabled.
- SELECT: public (anon + authenticated) — customers need to see where to pay.
- INSERT/UPDATE/DELETE: authenticated only — only logged-in admins can manage accounts.
3. Indexes
- idx_payment_accounts_currency on currency
- idx_payment_accounts_active on active
*/

CREATE TABLE IF NOT EXISTS payment_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  currency text NOT NULL,
  bank_name text NOT NULL,
  account_holder text NOT NULL,
  account_number text NOT NULL,
  account_type text NOT NULL,
  document_id text NOT NULL,
  phone text,
  payment_method text NOT NULL DEFAULT 'Transferencia',
  active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE payment_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_payment_accounts" ON payment_accounts;
CREATE POLICY "anon_select_payment_accounts" ON payment_accounts FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_payment_accounts" ON payment_accounts;
CREATE POLICY "auth_insert_payment_accounts" ON payment_accounts FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_payment_accounts" ON payment_accounts;
CREATE POLICY "auth_update_payment_accounts" ON payment_accounts FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_payment_accounts" ON payment_accounts;
CREATE POLICY "auth_delete_payment_accounts" ON payment_accounts FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_payment_accounts_currency ON payment_accounts(currency);
CREATE INDEX IF NOT EXISTS idx_payment_accounts_active ON payment_accounts(active);