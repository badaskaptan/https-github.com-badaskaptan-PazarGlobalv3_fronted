-- 🏪 MARKET DATA LIBRARY (MDL) - Akıllı Fiyat Önbellek Sistemi
-- Tarih: 15 Aralık 2025
-- Amaç: Perplexity API maliyetini %90 düşürmek

-- =====================================================
-- 1️⃣ MARKET PRICE SNAPSHOTS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS market_price_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 🔑 Ürün Anahtarı (Normalize edilmiş)
  product_key TEXT NOT NULL UNIQUE,
  
  -- 📦 Ürün Bilgileri
  original_title TEXT NOT NULL,
  category TEXT NOT NULL,
  condition TEXT DEFAULT 'İyi Durumda',
  
  -- 💰 Fiyat Verileri
  min_price NUMERIC NOT NULL,
  max_price NUMERIC NOT NULL,
  avg_price NUMERIC NOT NULL,
  currency TEXT DEFAULT 'TRY',
  
  -- 🔗 Kaynaklar (JSON)
  sources JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Örnek: [{"name": "Sahibinden", "url": "...", "date": "2025-12-15"}]
  
  -- 📊 Güvenilirlik Skoru
  confidence NUMERIC DEFAULT 0.0 CHECK (confidence >= 0 AND confidence <= 1.0),
  -- 0.0 = düşük, 1.0 = yüksek
  
  -- 📈 İstatistikler
  query_count INTEGER DEFAULT 0,
  last_query_at TIMESTAMP WITH TIME ZONE,
  
  -- ⏱️ Zaman Bilgileri
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- 🐛 Debug için ham veri
  raw_data JSONB,
  
  -- 📝 Metadata
  metadata JSONB DEFAULT '{}'::jsonb
);

-- =====================================================
-- 2️⃣ INDEXES (Performans için)
-- =====================================================

-- Hızlı arama için
CREATE INDEX idx_market_price_product_key ON market_price_snapshots(product_key);
CREATE INDEX idx_market_price_category ON market_price_snapshots(category);
CREATE INDEX idx_market_price_expires_at ON market_price_snapshots(expires_at);
CREATE INDEX idx_market_price_last_updated ON market_price_snapshots(last_updated_at);

-- En çok sorgulanan ürünler için
CREATE INDEX idx_market_price_query_count ON market_price_snapshots(query_count DESC);

-- GIN index for JSONB
CREATE INDEX idx_market_price_sources ON market_price_snapshots USING GIN(sources);

-- =====================================================
-- 3️⃣ TTL CONFIGURATION TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS market_data_ttl_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL UNIQUE,
  ttl_days INTEGER NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Varsayılan TTL değerleri
INSERT INTO market_data_ttl_config (category, ttl_days, description) VALUES
  ('Elektronik', 7, 'Fiyatlar hızlı değişir'),
  ('Otomotiv', 14, 'Orta hızda değişim'),
  ('Emlak', 30, 'Yavaş değişim'),
  ('Moda & Aksesuar', 7, 'Sezonluk, hızlı değişim'),
  ('Ev & Yaşam', 14, 'Orta hızda değişim'),
  ('Spor & Outdoor', 14, 'Orta hızda değişim'),
  ('Kitap & Hobi', 30, 'Yavaş değişim'),
  ('Mobilya', 21, 'Yavaş değişim'),
  ('Diğer', 14, 'Varsayılan')
ON CONFLICT (category) DO NOTHING;

-- =====================================================
-- 4️⃣ QUERY ANALYTICS TABLE (İsteğe bağlı)
-- =====================================================

CREATE TABLE IF NOT EXISTS market_data_query_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_key TEXT NOT NULL,
  category TEXT,
  hit_type TEXT CHECK (hit_type IN ('cache_hit', 'cache_miss', 'api_call')),
  response_time_ms INTEGER,
  cost NUMERIC DEFAULT 0.0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Foreign key
  FOREIGN KEY (product_key) REFERENCES market_price_snapshots(product_key) ON DELETE CASCADE
);

CREATE INDEX idx_query_log_product_key ON market_data_query_log(product_key);
CREATE INDEX idx_query_log_created_at ON market_data_query_log(created_at);
CREATE INDEX idx_query_log_hit_type ON market_data_query_log(hit_type);

-- =====================================================
-- 5️⃣ HELPER FUNCTIONS
-- =====================================================

-- Sorgu sayısını artır
CREATE OR REPLACE FUNCTION increment_query_count(p_product_key TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE market_price_snapshots
  SET 
    query_count = query_count + 1,
    last_query_at = NOW()
  WHERE product_key = p_product_key;
END;
$$ LANGUAGE plpgsql;

-- Bayat kayıtları temizle
CREATE OR REPLACE FUNCTION cleanup_expired_snapshots()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM market_price_snapshots
  WHERE expires_at < NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- TTL hesapla
CREATE OR REPLACE FUNCTION calculate_expiry_date(p_category TEXT)
RETURNS TIMESTAMP WITH TIME ZONE AS $$
DECLARE
  ttl_days INTEGER;
BEGIN
  SELECT ttl_days INTO ttl_days
  FROM market_data_ttl_config
  WHERE category = p_category;
  
  IF ttl_days IS NULL THEN
    ttl_days := 14; -- Varsayılan
  END IF;
  
  RETURN NOW() + (ttl_days || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 6️⃣ RLS (Row Level Security)
-- =====================================================

ALTER TABLE market_price_snapshots ENABLE ROW LEVEL SECURITY;

-- Public read (herkes okuyabilir)
CREATE POLICY "Market data is publicly readable"
  ON market_price_snapshots
  FOR SELECT
  TO public
  USING (true);

-- Service role write (sadece backend yazabilir)
CREATE POLICY "Only service role can write"
  ON market_price_snapshots
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- TTL config - sadece admin
ALTER TABLE market_data_ttl_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "TTL config is publicly readable"
  ON market_data_ttl_config
  FOR SELECT
  TO public
  USING (true);

-- Query log - analytics
ALTER TABLE market_data_query_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Query log readable by service"
  ON market_data_query_log
  FOR SELECT
  TO service_role
  USING (true);

-- =====================================================
-- 7️⃣ VIEWS (İstatistikler için)
-- =====================================================

-- En popüler ürünler
CREATE OR REPLACE VIEW v_popular_products AS
SELECT 
  product_key,
  original_title,
  category,
  query_count,
  avg_price,
  last_query_at,
  expires_at
FROM market_price_snapshots
WHERE query_count > 0
ORDER BY query_count DESC
LIMIT 100;

-- Cache istatistikleri
CREATE OR REPLACE VIEW v_cache_stats AS
SELECT 
  category,
  COUNT(*) as total_products,
  SUM(query_count) as total_queries,
  AVG(confidence) as avg_confidence,
  COUNT(CASE WHEN expires_at > NOW() THEN 1 END) as active_cache,
  COUNT(CASE WHEN expires_at <= NOW() THEN 1 END) as expired_cache
FROM market_price_snapshots
GROUP BY category;

-- Maliyet tasarrufu
CREATE OR REPLACE VIEW v_cost_savings AS
SELECT 
  DATE(created_at) as date,
  SUM(CASE WHEN hit_type = 'cache_hit' THEN 1 ELSE 0 END) as cache_hits,
  SUM(CASE WHEN hit_type = 'api_call' THEN 1 ELSE 0 END) as api_calls,
  SUM(CASE WHEN hit_type = 'cache_hit' THEN 1 ELSE 0 END)::FLOAT / 
    NULLIF(COUNT(*), 0) * 100 as cache_hit_rate,
  SUM(cost) as total_cost
FROM market_data_query_log
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- =====================================================
-- ✅ TAMAMLANDI
-- =====================================================

COMMENT ON TABLE market_price_snapshots IS 'Piyasa fiyat verileri önbelleği';
COMMENT ON TABLE market_data_ttl_config IS 'Kategori bazlı TTL yapılandırması';
COMMENT ON TABLE market_data_query_log IS 'Sorgu analitikleri ve maliyet takibi';
