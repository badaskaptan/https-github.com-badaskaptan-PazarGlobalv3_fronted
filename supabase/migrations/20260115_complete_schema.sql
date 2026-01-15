/**
 * PazarGlobal v3 - Complete Database Schema
 * 
 * This migration creates all required tables for:
 * - User management (profiles, security, sessions, wallets)
 * - Listing management (listings, product_images)
 * - Market data (price snapshots, query logs)
 * - Safety & audit (image safety flags, audit logs)
 * 
 * Date: 2026-01-15
 * Version: v3.0.0
 */

-- ============================================================
-- 1. USER MANAGEMENT TABLES
-- ============================================================

-- Profiles: Base user information
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL,
  phone text NULL UNIQUE,
  email text NULL UNIQUE,
  full_name text NULL,
  display_name text NULL,
  avatar_url text NULL,
  location text NULL,
  is_verified boolean DEFAULT false,
  is_active boolean DEFAULT true,
  bio text NULL,
  preferences jsonb DEFAULT '{}'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  rating numeric(3, 2) DEFAULT 0.0,
  credits integer DEFAULT 1000,
  role text DEFAULT 'user'::text,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_email_key UNIQUE (email),
  CONSTRAINT profiles_phone_key UNIQUE (phone),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users (id) ON DELETE CASCADE,
  CONSTRAINT profiles_role_check CHECK (
    role = ANY (ARRAY['user'::text, 'admin'::text, 'moderator'::text])
  )
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_profiles_phone ON public.profiles USING btree (phone);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles USING btree (email);
CREATE INDEX IF NOT EXISTS idx_profiles_location ON public.profiles USING btree (location);
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON public.profiles USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles USING btree (role) WHERE (role <> 'user'::text);
CREATE UNIQUE INDEX IF NOT EXISTS profiles_phone_unique_idx ON public.profiles USING btree (phone)
  WHERE (phone IS NOT NULL AND phone <> ''::text);

-- User Security: PIN hash, session tracking
CREATE TABLE IF NOT EXISTS public.user_security (
  id uuid NOT NULL DEFAULT gen_random_uuid (),
  user_id uuid NOT NULL,
  phone text NOT NULL UNIQUE,
  pin_hash text NOT NULL,
  session_token text NULL,
  session_expires_at timestamp with time zone NULL,
  failed_attempts integer DEFAULT 0,
  blocked_until timestamp with time zone NULL,
  last_login_at timestamp with time zone NULL,
  last_login_ip text NULL,
  device_fingerprint text NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  is_locked boolean DEFAULT false,
  CONSTRAINT user_security_pkey PRIMARY KEY (id),
  CONSTRAINT user_security_phone_key UNIQUE (phone),
  CONSTRAINT user_security_user_id_key UNIQUE (user_id),
  CONSTRAINT user_security_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles (id) ON DELETE CASCADE
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_user_security_user_id ON public.user_security USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_user_security_phone ON public.user_security USING btree (phone);
CREATE INDEX IF NOT EXISTS idx_user_security_session_token ON public.user_security USING btree (session_token);
CREATE INDEX IF NOT EXISTS idx_user_security_session_expires_at ON public.user_security USING btree (session_expires_at);
CREATE INDEX IF NOT EXISTS idx_user_security_session ON public.user_security USING btree (session_token) WHERE (session_token IS NOT NULL);

-- User Sessions: WhatsApp session tracking
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid (),
  user_id uuid NOT NULL,
  phone text NOT NULL,
  session_token uuid NOT NULL DEFAULT gen_random_uuid (),
  is_active boolean DEFAULT true,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  ended_at timestamp with time zone NULL,
  session_type text DEFAULT 'timed'::text,
  last_activity timestamp with time zone DEFAULT now(),
  end_reason text NULL,
  ip_address text NULL,
  user_agent text NULL,
  CONSTRAINT user_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT user_sessions_session_token_key UNIQUE (session_token),
  CONSTRAINT user_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles (id) ON DELETE CASCADE,
  CONSTRAINT user_sessions_end_reason_check CHECK (
    end_reason = ANY (ARRAY['timeout'::text, 'user_cancelled'::text, 'operation_completed'::text, 'manual'::text])
  ),
  CONSTRAINT user_sessions_session_type_check CHECK (
    session_type = ANY (ARRAY['timed'::text, 'event-based'::text])
  )
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_user_sessions_phone_active ON public.user_sessions USING btree (phone, is_active)
  WHERE (is_active = true);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON public.user_sessions USING btree (expires_at)
  WHERE (is_active = true);
CREATE INDEX IF NOT EXISTS idx_user_sessions_last_activity ON public.user_sessions USING btree (last_activity);

-- User Wallets: Credit system
CREATE TABLE IF NOT EXISTS public.user_wallets (
  user_id uuid NOT NULL,
  balance_bigint bigint NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'TRY'::text,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT wallets_pkey PRIMARY KEY (user_id),
  CONSTRAINT wallets_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles (id) ON DELETE CASCADE
) TABLESPACE pg_default;

-- Credit Transactions: Audit trail for credits
CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid (),
  user_id uuid NOT NULL,
  listing_id uuid NULL,
  amount integer NOT NULL,
  reason text NULL,
  balance_after integer NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT credit_transactions_pkey PRIMARY KEY (id),
  CONSTRAINT credit_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles (id) ON DELETE CASCADE
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_credit_transactions_user ON public.credit_transactions USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON public.credit_transactions USING btree (created_at DESC);

-- ============================================================
-- 2. LISTING & PRODUCT TABLES
-- ============================================================

-- Listings: Main product/service listings
CREATE TABLE IF NOT EXISTS public.listings (
  id uuid NOT NULL DEFAULT gen_random_uuid (),
  user_id uuid NULL,
  title text NOT NULL,
  description text NULL,
  category character varying(50) NULL,
  price numeric(12, 2) NULL,
  stock integer DEFAULT 1,
  location text NULL,
  status character varying(20) DEFAULT 'active'::character varying,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  view_count integer DEFAULT 0,
  market_price_at_publish numeric(10, 2) NULL,
  last_price_check_at timestamp without time zone NULL,
  condition character varying(20) DEFAULT 'new'::character varying,
  image_url text NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  images jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_premium boolean DEFAULT false,
  user_name text NULL,
  user_phone text NULL,
  premium_until timestamp with time zone NULL,
  premium_badge text NULL,
  expires_at timestamp with time zone DEFAULT (now() + '30 days'::interval),
  CONSTRAINT listings_pkey PRIMARY KEY (id),
  CONSTRAINT listings_condition_check CHECK (
    condition::text = ANY (
      ARRAY['Sıfır'::character varying, 'Az Kullanılmış'::character varying, '2. El'::character varying,
            'new'::character varying, 'used'::character varying, 'like-new'::character varying]::text[]
    )
  ),
  CONSTRAINT listings_premium_badge_check CHECK (
    premium_badge = ANY (ARRAY['gold'::text, 'platinum'::text, 'diamond'::text])
  )
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_listings_user_id ON public.listings USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_listings_category ON public.listings USING btree (category);
CREATE INDEX IF NOT EXISTS idx_listings_status ON public.listings USING btree (status);
CREATE INDEX IF NOT EXISTS idx_listings_created_at ON public.listings USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_listings_premium ON public.listings USING btree (is_premium, premium_until) WHERE (is_premium = true);
CREATE INDEX IF NOT EXISTS idx_listings_expires_at ON public.listings USING btree (expires_at);
CREATE INDEX IF NOT EXISTS idx_listings_metadata_keywords_text_trgm ON public.listings USING gin (
  COALESCE((metadata ->> 'keywords_text'::text), ''::text) gin_trgm_ops
);
CREATE INDEX IF NOT EXISTS idx_listings_images_gin ON public.listings USING gin (images);
CREATE INDEX IF NOT EXISTS idx_listings_price ON public.listings USING btree (price);
CREATE INDEX IF NOT EXISTS idx_listings_location ON public.listings USING btree (location);
CREATE INDEX IF NOT EXISTS idx_listings_condition ON public.listings USING btree (condition);
CREATE INDEX IF NOT EXISTS idx_listings_search_composite ON public.listings USING btree (status, category, location)
  WHERE (status::text = 'active'::text);
CREATE INDEX IF NOT EXISTS idx_listings_title_fts ON public.listings USING gin (to_tsvector('turkish'::regconfig, title));
CREATE INDEX IF NOT EXISTS idx_listings_description_fts ON public.listings USING gin (to_tsvector('turkish'::regconfig, description));
CREATE INDEX IF NOT EXISTS idx_listings_updated_at ON public.listings USING btree (updated_at DESC);

-- Product Images: Listing images
CREATE TABLE IF NOT EXISTS public.product_images (
  id uuid NOT NULL DEFAULT gen_random_uuid (),
  listing_id uuid NULL,
  storage_path text NOT NULL,
  public_url text NOT NULL,
  is_primary boolean DEFAULT false,
  display_order integer DEFAULT 0,
  file_size integer NULL,
  mime_type character varying(50) NULL,
  width integer NULL,
  height integer NULL,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT product_images_pkey PRIMARY KEY (id),
  CONSTRAINT product_images_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES listings (id) ON DELETE CASCADE
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_product_images_listing ON public.product_images USING btree (listing_id);
CREATE INDEX IF NOT EXISTS idx_product_images_primary ON public.product_images USING btree (listing_id, is_primary) WHERE (is_primary = true);
CREATE INDEX IF NOT EXISTS idx_product_images_order ON public.product_images USING btree (listing_id, display_order);

-- ============================================================
-- 3. MARKET DATA TABLES
-- ============================================================

-- Market Price Snapshots: Cached price data
CREATE TABLE IF NOT EXISTS public.market_price_snapshots (
  id uuid NOT NULL DEFAULT gen_random_uuid (),
  product_key text NOT NULL UNIQUE,
  original_title text NOT NULL,
  category text NOT NULL,
  condition text DEFAULT 'İyi Durumda'::text,
  min_price numeric NOT NULL,
  max_price numeric NOT NULL,
  avg_price numeric NOT NULL,
  currency text DEFAULT 'TRY'::text,
  sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  confidence numeric DEFAULT 0.0,
  query_count integer DEFAULT 0,
  last_query_at timestamp with time zone NULL,
  created_at timestamp with time zone DEFAULT now(),
  last_updated_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone NOT NULL,
  raw_data jsonb NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT market_price_snapshots_pkey PRIMARY KEY (id),
  CONSTRAINT market_price_snapshots_product_key_key UNIQUE (product_key),
  CONSTRAINT market_price_snapshots_confidence_check CHECK (
    (confidence >= 0::numeric) AND (confidence <= 1.0)
  )
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_market_price_product_key ON public.market_price_snapshots USING btree (product_key);
CREATE INDEX IF NOT EXISTS idx_market_price_category ON public.market_price_snapshots USING btree (category);
CREATE INDEX IF NOT EXISTS idx_market_price_expires_at ON public.market_price_snapshots USING btree (expires_at);
CREATE INDEX IF NOT EXISTS idx_market_price_last_updated ON public.market_price_snapshots USING btree (last_updated_at);
CREATE INDEX IF NOT EXISTS idx_market_price_query_count ON public.market_price_snapshots USING btree (query_count DESC);
CREATE INDEX IF NOT EXISTS idx_market_price_sources ON public.market_price_snapshots USING gin (sources);

-- Market Data TTL Config: Category-based cache TTL
CREATE TABLE IF NOT EXISTS public.market_data_ttl_config (
  id uuid NOT NULL DEFAULT gen_random_uuid (),
  category text NOT NULL UNIQUE,
  ttl_days integer NOT NULL,
  description text NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT market_data_ttl_config_pkey PRIMARY KEY (id),
  CONSTRAINT market_data_ttl_config_category_key UNIQUE (category)
) TABLESPACE pg_default;

-- Market Data Query Log: Audit trail for price queries
CREATE TABLE IF NOT EXISTS public.market_data_query_log (
  id uuid NOT NULL DEFAULT gen_random_uuid (),
  product_key text NOT NULL,
  category text NULL,
  hit_type text NULL,
  response_time_ms integer NULL,
  cost numeric DEFAULT 0.0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT market_data_query_log_pkey PRIMARY KEY (id),
  CONSTRAINT market_data_query_log_product_key_fkey FOREIGN KEY (product_key) REFERENCES market_price_snapshots (product_key) ON DELETE CASCADE,
  CONSTRAINT market_data_query_log_hit_type_check CHECK (
    hit_type = ANY (ARRAY['cache_hit'::text, 'cache_miss'::text, 'api_call'::text])
  )
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_query_log_product_key ON public.market_data_query_log USING btree (product_key);
CREATE INDEX IF NOT EXISTS idx_query_log_created_at ON public.market_data_query_log USING btree (created_at);
CREATE INDEX IF NOT EXISTS idx_query_log_hit_type ON public.market_data_query_log USING btree (hit_type);

-- ============================================================
-- 4. SAFETY & AUDIT TABLES
-- ============================================================

-- Image Safety Flags: Content moderation
CREATE TABLE IF NOT EXISTS public.image_safety_flags (
  id uuid NOT NULL DEFAULT gen_random_uuid (),
  user_id uuid NULL,
  image_url text NULL,
  flag_type text NOT NULL,
  confidence text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  reviewed_at timestamp with time zone NULL,
  reviewer text NULL,
  notes text NULL,
  CONSTRAINT image_safety_flags_pkey PRIMARY KEY (id)
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_image_safety_flags_user_id ON public.image_safety_flags USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_image_safety_flags_status ON public.image_safety_flags USING btree (status);
CREATE INDEX IF NOT EXISTS idx_image_safety_flags_created_at ON public.image_safety_flags USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_image_safety_flags_flag_status ON public.image_safety_flags USING btree (flag_type, status);

-- Audit Logs: Request/action logging
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid (),
  phone text NULL,
  user_id uuid NULL,
  source text NULL,
  action text NULL,
  message text NULL,
  response_status integer NULL,
  timestamp timestamp with time zone DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT audit_logs_pkey PRIMARY KEY (id)
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_audit_logs_phone ON public.audit_logs USING btree (phone);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_source ON public.audit_logs USING btree (source);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON public.audit_logs USING btree (timestamp DESC);

-- ============================================================
-- 5. TRIGGERS & FUNCTIONS
-- ============================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on profiles
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger on listings
CREATE TRIGGER update_listings_updated_at
  BEFORE UPDATE ON listings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 6. RLS (Row-Level Security) POLICIES
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_security ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

-- Policies for profiles: Users see all profiles (public data)
CREATE POLICY profiles_read_policy ON public.profiles
  FOR SELECT USING (true);

-- Policies for listings: Everyone can read active listings
CREATE POLICY listings_read_policy ON public.listings
  FOR SELECT USING (status = 'active');

-- Policies for listings: Users can update/delete own listings
CREATE POLICY listings_user_policy ON public.listings
  FOR UPDATE USING (auth.uid() = user_id);

-- Policies for user_wallets: Users can only see own wallet
CREATE POLICY user_wallets_policy ON public.user_wallets
  FOR SELECT USING (auth.uid() = user_id);

-- Policies for credit_transactions: Users can only see own transactions
CREATE POLICY credit_transactions_user_policy ON public.credit_transactions
  FOR SELECT USING (auth.uid() = user_id);

-- ============================================================
-- END OF MIGRATION
-- ============================================================
