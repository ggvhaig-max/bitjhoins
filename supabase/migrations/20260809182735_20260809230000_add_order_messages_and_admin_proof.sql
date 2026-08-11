/*
# Order messages + admin proof of transfer

1. `order_messages` — chat between admin and customer within an order
2. `orders.admin_proof_url` — receipt/proof uploaded by admin when sending to beneficiary
3. `orders.confirmed_by_customer_at` — timestamp when customer confirms receipt of transfer
4. `orders.admin_confirmed_at` — timestamp when admin closes the order
*/

CREATE TABLE IF NOT EXISTS order_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  sender text NOT NULL CHECK (sender IN ('admin', 'customer')),
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE order_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_rw_order_messages" ON order_messages;
CREATE POLICY "anon_rw_order_messages" ON order_messages FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_order_messages" ON order_messages;
CREATE POLICY "anon_insert_order_messages" ON order_messages FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_order_messages" ON order_messages;
CREATE POLICY "auth_update_order_messages" ON order_messages FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_order_messages" ON order_messages;
CREATE POLICY "auth_delete_order_messages" ON order_messages FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_order_messages_order ON order_messages(order_id, created_at);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS admin_proof_url text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS confirmed_by_customer_at timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS admin_confirmed_at timestamptz;