/*
# Create order notification log

1. New Table
- `order_notifications` stores each notification event associated with an order.
- `id` (uuid, primary key)
- `order_id` (uuid, required foreign key to orders)
- `channel` (text, default `whatsapp`)
- `recipient` (text, nullable)
- `event_type` (text, required)
- `message` (text, required)
- `sent_at` (timestamptz, default now)
2. Security
- Row level security is enabled.
- No public policies are added; only the service-role notification function can write these internal records.
3. Important notes
- This log is independent from WhatsApp delivery. Order state remains authoritative in `orders` and `order_status_history`.
*/

CREATE TABLE IF NOT EXISTS order_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  channel text NOT NULL DEFAULT 'whatsapp',
  recipient text,
  event_type text NOT NULL,
  message text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE order_notifications ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_order_notifications_order_id ON order_notifications(order_id);
CREATE INDEX IF NOT EXISTS idx_order_notifications_sent_at ON order_notifications(sent_at DESC);