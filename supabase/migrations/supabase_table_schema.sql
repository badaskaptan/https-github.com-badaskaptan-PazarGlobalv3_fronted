-- Supabase table schema generated from provided table list
-- Types chosen as reasonable defaults; adjust types/constraints as needed before applying.

-- Extension helper (use pgcrypto for gen_random_uuid if available)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- public.active_drafts
CREATE TABLE IF NOT EXISTS public.active_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  state text,
  listing_data jsonb,
  images jsonb,
  vision_product jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
-- RLS: intended policies: service role insert; users read their own drafts; enforce draft_id usage in agents
-- ALTER TABLE public.active_drafts ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "service_insert" ON public.active_drafts FOR INSERT TO service_role USING (true);
-- CREATE POLICY "user_select_own" ON public.active_drafts FOR SELECT USING (user_id = auth.uid());

-- public.admin_actions
CREATE TABLE IF NOT EXISTS public.admin_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid,
  action text,
  target_user uuid,
  target_listing uuid,
  details jsonb,
  created_at timestamptz DEFAULT now()
);

-- public.audit_logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  phone text,
  action text,
  resource_type text,
  resource_id uuid,
  source text,
  ip_address inet,
  user_agent text,
  request_data jsonb,
  response_status int,
  error_message text,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);
-- RLS: service role can INSERT; users can SELECT own logs
-- ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "service_insert_audit" ON public.audit_logs FOR INSERT TO service_role USING (true);
-- CREATE POLICY "user_select_own_audit" ON public.audit_logs FOR SELECT USING (user_id = auth.uid());

-- public.backup_profiles_full
CREATE TABLE IF NOT EXISTS public.backup_profiles_full (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text,
  email text,
  full_name text,
  display_name text,
  avatar_url text,
  location text,
  user_role text,
  is_verified boolean,
  is_active boolean,
  bio text,
  preferences jsonb,
  metadata jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  rating numeric
);

-- public.backup_user_with_security_jsonb
CREATE TABLE IF NOT EXISTS public.backup_user_with_security_jsonb (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payload jsonb
);

-- public.conversations
CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  platform text,
  messages jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
-- RLS notes: service role full access; users can manage their own conversations

-- public.favorites
CREATE TABLE IF NOT EXISTS public.favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  listing_id uuid,
  created_at timestamptz DEFAULT now()
);
-- RLS: users can INSERT/DELETE own favorites; SELECT own

-- public.illegal_reports
CREATE TABLE IF NOT EXISTS public.illegal_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_user uuid,
  listing_id uuid,
  reason text,
  evidence jsonb,
  reviewed boolean DEFAULT false,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- public.image_safety_flags
CREATE TABLE IF NOT EXISTS public.image_safety_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  image_url text,
  flag_type text,
  confidence numeric,
  message text,
  status text,
  created_at timestamptz DEFAULT now(),
  reviewed_at timestamptz,
  reviewer uuid,
  notes text
);

-- public.listings
CREATE TABLE IF NOT EXISTS public.listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  title text,
  description text,
  category text,
  price numeric,
  stock int,
  location jsonb,
  status text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  view_count int DEFAULT 0,
  market_price_at_publish numeric,
  last_price_check_at timestamptz,
  condition text,
  image_url text,
  metadata jsonb,
  images jsonb,
  is_premium boolean DEFAULT false,
  user_name text,
  user_phone text,
  premium_until timestamptz,
  premium_badge text,
  expires_at timestamptz
);
-- RLS: typical policies - owner can modify own listings; public can select active listings
-- ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "owner_modify" ON public.listings FOR UPDATE, DELETE USING (user_id = auth.uid());
-- CREATE POLICY "owner_insert" ON public.listings FOR INSERT WITH CHECK (user_id = auth.uid());
-- CREATE POLICY "public_select_active" ON public.listings FOR SELECT USING (status = 'active');

-- public.market_data_query_log
CREATE TABLE IF NOT EXISTS public.market_data_query_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_key text,
  category text,
  hit_type text,
  response_time_ms int,
  cost numeric,
  created_at timestamptz DEFAULT now()
);

-- public.market_data_ttl_config
CREATE TABLE IF NOT EXISTS public.market_data_ttl_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text,
  ttl_days int,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- public.market_price_snapshots
CREATE TABLE IF NOT EXISTS public.market_price_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_key text,
  original_title text,
  category text,
  condition text,
  min_price numeric,
  max_price numeric,
  avg_price numeric,
  currency text,
  sources jsonb,
  confidence numeric,
  query_count int,
  last_query_at timestamptz,
  created_at timestamptz DEFAULT now(),
  last_updated_at timestamptz,
  expires_at timestamptz,
  raw_data jsonb,
  metadata jsonb
);
-- RLS: market data read by public; writes restricted to service role

-- public.notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  listing_id uuid,
  type text,
  title text,
  message text,
  metadata jsonb,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  read_at timestamptz
);
-- RLS: service role insert; users can update/view own

-- public.orders
CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid,
  buyer_id uuid,
  seller_id uuid,
  price numeric,
  commission numeric,
  status text,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  quantity int,
  seller_receives numeric
);

-- public.payments
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  gateway text,
  gateway_payment_id text,
  amount_bigint bigint,
  currency text,
  status text,
  metadata jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- public.pin_verification_attempts
CREATE TABLE IF NOT EXISTS public.pin_verification_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text,
  attempt_time timestamptz DEFAULT now(),
  success boolean,
  ip_address inet,
  user_agent text
);

-- public.product_embeddings
CREATE TABLE IF NOT EXISTS public.product_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid,
  embedding jsonb,
  created_at timestamptz DEFAULT now()
);
-- Note: use appropriate vector/embedding extension if available (pgvector)

-- public.product_images
CREATE TABLE IF NOT EXISTS public.product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid,
  storage_path text,
  public_url text,
  is_primary boolean DEFAULT false,
  display_order int,
  file_size bigint,
  mime_type text,
  width int,
  height int,
  created_at timestamptz DEFAULT now()
);

-- public.profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text,
  email text,
  full_name text,
  display_name text,
  avatar_url text,
  location jsonb,
  is_verified boolean DEFAULT false,
  is_active boolean DEFAULT true,
  bio text,
  preferences jsonb,
  metadata jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  rating numeric,
  role text
);

-- public.rate_limits
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  phone text,
  action text,
  count int,
  window_start timestamptz,
  window_end timestamptz,
  max_allowed int,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- public.user_security
CREATE TABLE IF NOT EXISTS public.user_security (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  phone text,
  pin_hash text,
  session_token text,
  session_expires_at timestamptz,
  failed_attempts int,
  blocked_until timestamptz,
  last_login_at timestamptz,
  last_login_ip inet,
  device_fingerprint text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  is_locked boolean DEFAULT false
);

-- public.user_sessions
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  phone text,
  session_token text,
  is_active boolean DEFAULT true,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  ended_at timestamptz,
  session_type text,
  last_activity timestamptz,
  end_reason text,
  ip_address inet,
  user_agent text
);

-- public.wallet_transactions
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  amount_bigint bigint,
  kind text,
  reference text,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

-- public.wallets
CREATE TABLE IF NOT EXISTS public.wallets (
  user_id uuid PRIMARY KEY,
  balance_bigint bigint DEFAULT 0,
  currency text DEFAULT 'USD',
  updated_at timestamptz DEFAULT now()
);

-- End of schema

-- Notes:
-- 1) Adjust types (uuid vs bigint vs serial) according to your existing DB conventions.
-- 2) Add indexes for frequent queries (e.g., listings(status), active_drafts(user_id), product_images(listing_id)).
-- 3) Apply RLS policies with `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` and `CREATE POLICY ...` using `auth.uid()` or equivalent.
-- 4) If using pgvector for embeddings, change `embedding jsonb` to `vector` type and install the extension.
