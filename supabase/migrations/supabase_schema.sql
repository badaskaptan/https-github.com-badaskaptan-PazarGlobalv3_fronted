-- Supabase marketplace schema (inferred from production data)
-- Tables: profiles, user_sessions, listings

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid PRIMARY KEY,
    phone text UNIQUE NOT NULL,
    full_name text,
    pin_code text,
    status text DEFAULT 'active',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    phone text NOT NULL,
    session_token uuid NOT NULL UNIQUE,
    is_active boolean NOT NULL DEFAULT true,
    session_type text NOT NULL DEFAULT 'timed',
    created_at timestamptz NOT NULL DEFAULT now(),
    last_activity timestamptz,
    expires_at timestamptz,
    ended_at timestamptz,
    end_reason text,
    ip_address text,
    CONSTRAINT user_sessions_phone_active_unique UNIQUE (phone, is_active)
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_phone ON public.user_sessions (phone);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON public.user_sessions (user_id);

CREATE TABLE IF NOT EXISTS public.listings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    user_name text,
    user_phone text,
    title text NOT NULL,
    description text NOT NULL,
    category text NOT NULL,
    price numeric(12,2) NOT NULL,
    stock integer NOT NULL DEFAULT 1,
    condition text NOT NULL DEFAULT 'used',
    location text NOT NULL,
    status text NOT NULL DEFAULT 'draft',
    image_url text,
    images text[] DEFAULT ARRAY[]::text[],
    metadata jsonb DEFAULT '{}'::jsonb,
    is_premium boolean NOT NULL DEFAULT false,
    premium_until timestamptz,
    premium_badge text,
    market_price_at_publish numeric(12,2),
    last_price_check_at timestamptz,
    view_count integer NOT NULL DEFAULT 0,
    expires_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_listings_status ON public.listings (status);
CREATE INDEX IF NOT EXISTS idx_listings_category ON public.listings (lower(category));
CREATE INDEX IF NOT EXISTS idx_listings_title_trgm ON public.listings USING gin (title gin_trgm_ops);

CREATE OR REPLACE FUNCTION public.verify_pin(p_phone text, p_pin text)
RETURNS TABLE(success boolean, user_id uuid, message text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_profile public.profiles%ROWTYPE;
BEGIN
    SELECT * INTO v_profile
    FROM public.profiles
    WHERE phone = p_phone;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, NULL::uuid, 'Telefon kayıtlı değil'::text;
        RETURN;
    END IF;

    IF v_profile.pin_code <> p_pin THEN
        RETURN QUERY SELECT false, NULL::uuid, 'PIN yanlış'::text;
        RETURN;
    END IF;

    RETURN QUERY SELECT true, v_profile.id, 'PIN onaylandı'::text;
END;
$$;
