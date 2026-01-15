-- Add credits system to profiles table
-- Executed after: supabase_schema.sql

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS credits INT DEFAULT 1000;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS credits_spent INT DEFAULT 0;

-- Index for credit-based queries
CREATE INDEX IF NOT EXISTS idx_profiles_credits ON profiles(credits DESC);

-- Create credit_transactions table for audit trail
CREATE TABLE IF NOT EXISTS credit_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  listing_id UUID REFERENCES listings(id) ON DELETE SET NULL,
  amount INT NOT NULL, -- Negative = deducted, Positive = refunded
  reason TEXT, -- 'listing_publish', 'refund', 'admin_credit', etc.
  balance_after INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_user ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created ON credit_transactions(created_at DESC);

-- RLS Policy: Users can view their own credit history
CREATE POLICY credit_transactions_user_policy ON credit_transactions
  FOR SELECT USING (auth.uid() = user_id);
