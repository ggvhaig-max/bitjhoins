import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  // BitJhoins vive en su propio schema dentro del servidor consolidado "todo"
  db: { schema: 'bitjhoins' },
});

export type UserRole = 'superadmin' | 'admin' | 'user';

export type UserProfile = {
  user_id: string;
  email: string;
  display_name: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
};

export type SiteSettings = {
  id: string;
  whatsapp_number: string;
  published_date: string;
  updated_at: string;
  /** Logo real del negocio, subido desde el panel (bucket `bj-brand`). */
  logo_url: string | null;
  /** Diseño guardado de la imagen para compartir (ver ShareStory). */
  share_design: Record<string, unknown> | null;
};

export type ExchangeRate = {
  id: string;
  currency_code: string;
  country: string;
  display_name: string;
  rate: number;
  calculation_type: 'MULTIPLY' | 'DIVIDE';
  calculation_mode: 'MANUAL' | 'AUTOMATIC';
  usdt_base_price: number | null;
  currency_reference_price: number | null;
  margin_percentage: number | null;
  auto_base_currency: string | null;
  auto_quote_currency: string | null;
  decimals: number;
  active: boolean;
  display_order: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type UsdtReferencePrice = {
  currency_code: string;
  display_name: string;
  usdt_price: number;
  auto_update: boolean;
  updated_at: string;
};

export type Sponsor = {
  id: string;
  title: string;
  image_url: string;
  link_url: string;
  button_label: string;
  active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
};

export type Customer = {
  id: string;
  first_name: string;
  last_name: string;
  whatsapp: string;
  email: string | null;
  created_at: string;
};

export type Beneficiary = {
  id: string;
  customer_id: string;
  full_name: string;
  document_id: string;
  bank: string;
  account_type: string;
  account_number: string;
  currency: string;
  country: string;
  alias: string;
  created_at: string;
};

export type OrderStatus =
  | 'CREATED'
  | 'WAITING_PAYMENT'
  | 'PAYMENT_REPORTED'
  | 'PAYMENT_CONFIRMED'
  | 'EXCHANGE_PROCESSING'
  | 'SENDING_TO_BENEFICIARY'
  | 'SENT'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'EXPIRED';

export type Order = {
  id: string;
  order_number: string;
  customer_id: string;
  beneficiary_id: string | null;
  source_currency: string;
  destination_currency: string;
  source_amount: number;
  destination_amount: number;
  exchange_rate_snapshot: Record<string, unknown>;
  exchange_rate_value: number;
  exchange_rate_calc_type: string;
  payment_proof_url: string | null;
  admin_proof_url: string | null;
  confirmed_by_customer_at: string | null;
  admin_confirmed_at: string | null;
  status: OrderStatus;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

export type OrderStatusHistoryEntry = {
  id: string;
  order_id: string;
  status: OrderStatus;
  note: string | null;
  changed_by: string | null;
  created_at: string;
};

export type OrderRating = {
  id: string;
  order_id: string;
  rating: number;
  review: string | null;
  review_date: string;
};

export type PaymentAccount = {
  id: string;
  currency: string;
  bank_name: string;
  account_holder: string;
  account_number: string;
  account_type: string;
  document_id: string;
  phone: string | null;
  payment_method: string;
  active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
};

export type OrderMessage = {
  id: string;
  order_id: string;
  sender: 'admin' | 'customer';
  message: string;
  created_at: string;
};

export type RateHistoryEntry = {
  id: string;
  publish_id: string;
  currency_code: string;
  display_name: string;
  rate: number;
  calculation_type: string;
  published_at: string;
  published_by: string | null;
  snapshot: Record<string, unknown> | null;
};
