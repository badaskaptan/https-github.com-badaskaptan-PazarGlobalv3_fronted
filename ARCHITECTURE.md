# PazarGlobal v3 — Production Architecture

## Sistem Genel Bakış

PazarGlobal, üç ana mikroservis üzerine kurulu, WhatsApp ve WebChat üzerinden doğal dil ile ilan oluşturma/arama sistemidir.

```
┌─────────────────────────────────────────────────────────────────┐
│                        PazarGlobal v3                           │
└─────────────────────────────────────────────────────────────────┘
         │                    │                   │
    ┌────▼────┐         ┌─────▼─────┐       ┌─────▼──────┐
    │ Frontend│         │   Agent   │       │  WhatsApp  │
    │ (React) │         │  Backend  │       │   Bridge   │
    └────┬────┘         └─────┬─────┘       └─────┬──────┘
         │                    │                   │
         └────────────────────┼───────────────────┘
                              │
                      ┌───────▼────────┐
                      │   Supabase     │
                      │  (PostgreSQL)  │
                      └────────────────┘
```

---

## 1. Mimari Bileşenler

### 1.1 Frontend (React + TypeScript)

**Repository:** `Pazarglobal-v3-fronted`

**Sorumluluklar:**

- Kullanıcı kimlik doğrulama (Supabase Auth)
- WebChat arayüzü (realtime mesajlaşma)
- İlan oluşturma/düzenleme/arama UI
- Kategori seçimi, fiyat önerileri, görsel yükleme
- Profil/favoriler/yorumlar yönetimi

**Teknolojiler:**

- React 18 + TypeScript
- Vite (build tool)
- TailwindCSS (styling)
- i18next (Türkçe/İngilizce)
- Supabase Client (auth + realtime)

**Endpoint Bağlantıları:**

- `GET /webchat/categories` → kategori listesi
- `POST /webchat/message` → mesaj gönder (draft işlemleri)
- `POST /webchat/media/analyze` → görsel analizi

---

### 1.2 Agent Backend (FastAPI + Python)

**Repository:** `Pazarglobal-v3-Agents`

**Sorumluluklar:**

- WhatsApp Bridge ve Frontend'ten gelen mesajları işleme
- Niyet analizi (arama/yeni ilan/güncelleme)
- Draft yönetimi (taslak oluşturma, alan tamamlama)
- Deterministik kategori eşleme ve keyword üretimi
- İlan yayınlama (keyword metadata injection)
- Arama sorguları (title/description + metadata filtresi)

**Modüler Yapı:**

```
agent/
├── main.py (45 satır entrypoint)
├── app/
│   ├── config.py (ENV variables)
│   ├── clients/
│   │   ├── supabase.py (DB client singleton)
│   │   └── openai.py (LLM wrapper)
│   ├── core/
│   │   └── helpers.py (uuid, time, phone, intent utils)
│   ├── schemas.py (Pydantic models)
│   ├── services/
│   │   ├── drafts.py (taslak CRUD)
│   │   ├── search.py (listing search)
│   │   ├── publish.py (listing insert + keywords)
│   │   ├── parsing.py (mesajdan alan çıkarımı)
│   │   ├── audit.py (logging)
│   │   ├── category_library.py (deterministik kategori)
│   │   └── metadata_keywords.py (keyword generation)
│   └── routers/
│       ├── webchat.py (frontend endpoints)
│       └── agent_run.py (whatsapp bridge endpoint)
```

**Endpoint'ler:**

- `GET /healthz` → health check
- `GET /webchat/categories` → kategori listesi (deterministik)
- `POST /webchat/message` → WebChat mesaj işleme
- `POST /webchat/media/analyze` → görsel upload + draft ilişkilendirme
- `POST /agent/run` → WhatsApp Bridge orchestration

**Deterministik Kategori Sistemi:**

- Frontend ile **tam uyumlu** kategori ID'leri
- Heuristic-based matching (lowercase, keyword triggers)
- Fallback: `Diğer` kategorisi
- Çıktı: normalized category_id

**Keyword Metadata Sistemi:**

- **Deterministik baseline:** title + category + description tokenization
- **Opsiyonel LLM enhancement:** OpenAI ile ek keyword önerisi
- Çıktı:

  ```json
  {
    "keywords": ["iphone", "13", "128gb", "mor"],
    "keywords_text": "iphone 13 128gb mor"
  }
  ```

- **Arama entegrasyonu:** `metadata->>keywords_text` PostgreSQL JSONB query

---

### 1.3 WhatsApp Bridge (Node.js)

**Repository:** `Pazarglobal-v3-whatsapp-bridge`

**Sorumluluklar:**

- WhatsApp Business API entegrasyonu
- Gelen mesajları Agent Backend'e forward
- Agent'tan gelen yanıtları WhatsApp'a gönderme
- Media URL'leri handling (görsel/video)
- Rate limiting ve retry logic

**Teknolojiler:**

- Node.js
- whatsapp-web.js veya Official WhatsApp Business API
- Railway deployment

**İletişim:**

- Supabase Edge Function: `whatsapp-traffic-controller`
- Agent Backend: `POST /agent/run`

---

## 2. Veri Modeli (Supabase PostgreSQL)

### 2.1 Temel Tablolar

#### `profiles` (Kullanıcı Profilleri)

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  display_name TEXT,
  phone TEXT UNIQUE,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `listings` (Yayınlanmış İlanlar)

```sql
CREATE TABLE listings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  price NUMERIC(12,2),
  location TEXT,
  condition TEXT DEFAULT '2.el',
  images JSONB DEFAULT '{"urls": []}',
  metadata JSONB DEFAULT '{}',
  status TEXT DEFAULT 'active',
  view_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_listings_metadata_keywords ON listings 
USING GIN ((metadata->'keywords_text'));
```

**metadata JSONB Şeması:**

```json
{
  "source": "agent",
  "draft_id": "uuid",
  "published_at": "2026-01-15T10:30:00Z",
  "keywords": ["iphone", "13", "128gb", "mor"],
  "keywords_text": "iphone 13 128gb mor"
}
```

#### `active_drafts` (Kullanıcı Taslakları)

```sql
CREATE TABLE active_drafts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id),
  listing_data JSONB DEFAULT '{}',
  images JSONB DEFAULT '{"urls": []}',
  state TEXT DEFAULT 'PENDING',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**listing_data JSONB Şeması:**

```json
{
  "title": "iPhone 13 128GB Mor",
  "category": "elektronik-telefon",
  "price": "15000",
  "location": "İstanbul, Kadıköy",
  "condition": "2.el",
  "description": "Az kullanılmış, kutusuyla birlikte..."
}
```

#### `audit_logs` (İşlem Logları)

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID,
  event_type TEXT,
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 3. İş Akışları

### 3.1 WebChat İlan Oluşturma (Frontend → Agent)

```
1. Kullanıcı: "iPhone 13 satıyorum"
   ↓
2. POST /webchat/message
   ↓
3. Agent: detect_intent("CREATE_LISTING")
   ↓
4. get_or_create_draft(user_id)
   ↓
5. extract_simple_fields("iPhone 13 satıyorum")
   → title: "iPhone 13", category: "Elektronik"
   ↓
6. patch_draft_fields(draft_id, {...})
   ↓
7. draft_missing_fields(draft) → ["price", "location"]
   ↓
8. Response: "✅ Taslak başlatıldı. Fiyat ve konum?"
   ↓
9. Kullanıcı: "15000 TL, Kadıköy"
   ↓
10. patch_draft_fields(draft_id, {price: "15000", location: "Kadıköy"})
    ↓
11. format_preview(draft) → Önizleme göster
    ↓
12. Kullanıcı: "onaylıyorum"
    ↓
13. publish_listing_from_draft(draft_id)
    ├─ normalize_category_id("Elektronik") → "elektronik-telefon"
    ├─ generate_listing_keywords(...) → keywords + keywords_text
    └─ INSERT INTO listings (..., metadata: {keywords, keywords_text})
    ↓
14. Response: "🎉 İlanınız yayınlandı!"
```

### 3.2 Arama Akışı

```
1. Kullanıcı: "mor iphone 13"
   ↓
2. search_listings(query: "mor iphone 13")
   ↓
3. SQL Query:
   SELECT * FROM listings
   WHERE (
     title ILIKE '%mor%' OR title ILIKE '%iphone%' OR title ILIKE '%13%'
     OR description ILIKE '%mor%' OR ...
     OR metadata->>'keywords_text' ILIKE '%mor%'
     OR metadata->>'keywords_text' ILIKE '%iphone%'
     OR metadata->>'keywords_text' ILIKE '%13%'
   )
   AND status = 'active'
   ORDER BY created_at DESC
   LIMIT 10
   ↓
4. Response: [listing1, listing2, ...]
```

### 3.3 WhatsApp İlan Oluşturma (WhatsApp → Bridge → Agent)

```
1. WhatsApp mesaj gelir
   ↓
2. WhatsApp Bridge: Supabase Edge Function (traffic-controller)
   ↓
3. POST /agent/run
   {
     "user_id": "uuid",
     "phone": "+905551234567",
     "message": "araba satıyorum",
     "media_paths": []
   }
   ↓
4. handle_agent_run(payload)
   ├─ detect_intent("araba satıyorum") → "CREATE_LISTING"
   ├─ get_or_create_draft(user_id)
   ├─ extract_simple_fields(...) → {category: "Otomotiv"}
   ├─ patch_draft_fields(...)
   └─ draft_missing_fields(...) → ["title", "price", ...]
   ↓
5. Response: "🚗 Araç ilanı başlattım. Marka/model?"
   ↓
6. WhatsApp Bridge: Forward response to user
```

---

## 4. Kategori & Keyword Sistemi

### 4.1 Kategori Kütüphanesi (`category_library.py`)

**Amaç:** Frontend ile **backend'in aynı kategori ID'lerini kullanması**.

**Frontend Kategorileri:**

```typescript
export const CATEGORIES = [
  { id: 'emlak', label: 'Emlak', icon: '🏠' },
  { id: 'vasita', label: 'Vasıta', icon: '🚗' },
  { id: 'elektronik', label: 'Elektronik', icon: '💻' },
  // ...
]
```

**Backend Normalize:**

```python
def normalize_category_id(user_input: str) -> str | None:
    """Frontend category_id'sine map et."""
    lower = user_input.lower().strip()
    
    # Exact match
    if lower in CATEGORY_MAP:
        return CATEGORY_MAP[lower]
    
    # Keyword triggers
    if any(k in lower for k in ["ev", "daire", "konut"]):
        return "emlak"
    if any(k in lower for k in ["araba", "otomobil", "vasıta"]):
        return "vasita"
    # ...
    
    return None  # Fallback: "Diğer" kategorisi
```

### 4.2 Keyword Metadata Sistemi (`metadata_keywords.py`)

**Deterministik Baseline:**

```python
def generate_listing_keywords_deterministic(
    title: str,
    category: str,
    description: str,
    ...
) -> Dict[str, Any]:
    # Tokenize + normalize
    tokens = re.findall(r"[0-9a-zçğıöşü+]{2,}", blob.lower())
    
    # Category boosters
    if "otomotiv" in category.lower():
        boosters = ["araba", "otomobil", "araç"]
    
    # Merge + dedupe
    merged = dedupe([*boosters, *tokens])[:max_keywords]
    
    return {
        "keywords": merged,
        "keywords_text": " ".join(merged)
    }
```

**LLM Enhancement (Opsiyonel):**

```python
async def generate_listing_keywords(
    ...
    llm_generate: Optional[Callable] = None
) -> Dict[str, Any]:
    base = generate_listing_keywords_deterministic(...)
    
    if llm_generate is None:
        return base
    
    # OpenAI'dan ek keyword önerisi
    extra = await llm_generate(system, user)
    
    # Base + Extra merge
    merged = dedupe([*base["keywords"], *extra])
    
    return {
        "keywords": merged,
        "keywords_text": " ".join(merged)
    }
```

**Publish'ta Injection:**

```python
keywords = await generate_listing_keywords(
    title=title,
    category=normalized_category,
    description=description,
    ...
)

payload = {
    "title": title,
    "category": normalized_category,
    "metadata": {
        "keywords": keywords["keywords"],
        "keywords_text": keywords["keywords_text"]
    }
}

supabase.table("listings").insert(payload).execute()
```

**Arama'da Kullanım:**

```python
def search_listings(query: str):
    tokens = query.lower().split()
    
    or_conditions = []
    for token in tokens:
        or_conditions.extend([
            f"title ILIKE '%{token}%'",
            f"description ILIKE '%{token}%'",
            f"metadata->>'keywords_text' ILIKE '%{token}%'"
        ])
    
    sql = f"""
        SELECT * FROM listings
        WHERE ({' OR '.join(or_conditions)})
        AND status = 'active'
        ORDER BY created_at DESC
        LIMIT 10
    """
```

---

## 5. Deployment

### 5.1 Frontend (Vercel/Netlify)

```bash
cd pazarglobal-frontend
npm install
npm run build
# Deploy to Vercel/Netlify
```

**ENV Variables:**

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_AGENT_URL` (Agent Backend URL)

### 5.2 Agent Backend (Railway)

```bash
cd agent
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port $PORT
```

**ENV Variables:**

- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `OPENAI_API_KEY` (optional)
- `CORS_ALLOW_ORIGINS`

### 5.3 WhatsApp Bridge (Railway)

```bash
cd whatsapp-bridge
npm install
npm start
```

**ENV Variables:**

- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `AGENT_BACKEND_URL`
- `WHATSAPP_API_KEY`

---

## 6. Güvenlik & Best Practices

### 6.1 Row Level Security (RLS)

```sql
-- Kullanıcı sadece kendi taslağını görebilir/düzenleyebilir
CREATE POLICY active_drafts_user_policy ON active_drafts
  USING (auth.uid() = user_id);

-- Herkes aktif ilanları görebilir
CREATE POLICY listings_read_policy ON listings
  FOR SELECT USING (status = 'active');

-- Kullanıcı sadece kendi ilanını düzenleyebilir
CREATE POLICY listings_update_policy ON listings
  FOR UPDATE USING (auth.uid() = user_id);
```

### 6.2 Rate Limiting

- Agent Backend: FastAPI middleware (10 req/sec per user)
- WhatsApp Bridge: Redis-based throttling

### 6.3 Error Handling

- Agent Backend: HTTP exceptions → structured JSON errors
- Frontend: Toast notifications + retry logic
- WhatsApp Bridge: Fallback messages ("Geçici sorun, tekrar deneyin")

### 6.4 Monitoring

- Agent Backend: `/healthz` endpoint
- Supabase: Audit logs tablosu (`audit_logs`)
- Railway: Logs + metrics dashboard

---

## 7. Geliştirme Roadmap

### ✅ Tamamlanan

- [x] Modüler agent backend (15+ dosya)
- [x] Deterministik kategori sistemi
- [x] Keyword metadata + arama entegrasyonu
- [x] Draft yönetimi (CRUD)
- [x] WebChat endpoint'leri
- [x] WhatsApp Bridge orchestration endpoint
- [x] Frontend kategori UI
- [x] Type-safe codebase (Pylance clean)

### 🚧 Devam Eden

- [ ] Görsel analizi (OpenAI Vision API)
- [ ] Fiyat önerisi (market data library)
- [ ] Gerçek WhatsApp Business API entegrasyonu
- [ ] Payment gateway (Stripe/İyzico)

### 📋 Planlanan

- [ ] Push notifications (Supabase Realtime)
- [ ] Favori/beğeni sistemi
- [ ] İlan paylaşım (deep links)
- [ ] Multi-language support (i18next)
- [ ] Admin panel (ilan moderasyonu)

---

## 7. WhatsApp Bridge & Edge Function (Traffic Controller)

### 7.1 WhatsApp Bridge (Node.js)

**Repository:** `Pazarglobal-v3-whatsapp-bridge`

**Sorumluluklar:**

- WhatsApp incoming messages (webhook)
- Message queueing + batch processing
- User registration (phone-based)
- Session token generation

**Flow:**

```
WhatsApp Message → Bridge (Node.js) → Edge Function (Rate Limit)
                                           ↓
                                    Agent Backend
```

### 7.2 Edge Function: whatsapp-traffic-controller

**Konum:** `supabase/functions/whatsapp-traffic-controller/index.ts`

**Sorumluluklar:**

1. **Rate Limiting** (Redis + In-Memory Fallback)
   - 10 requests/minute per phone
   - 100 requests/hour per phone
   - 429 response on limit exceeded

2. **Session Management**
   - WhatsApp users için 10-minute session timer
   - PIN doğrulama (4-6 digit)
   - Automatic session timeout
   - Session renewal on new PIN

3. **Traffic Routing**
   - WebChat requests: Bypass session (direct to backend)
   - WhatsApp requests: Require valid session + rate limit check
   - Secure forwarding to Agent Backend

**Architecture:**

```typescript
// Rate Limit Structure (per phone)
interface RateLimitState {
  minute_count: number;
  hour_count: number;
  last_request: number;
  phone: string;
}

// Storage: Redis (primary) or In-Memory Map (fallback)
// TTL: 1 hour (auto-reset)
```

**Request Flow:**

```
Incoming Request
    ↓
[1] Extract phone number
    ↓
[2] Check Rate Limit (Redis/In-Memory)
    ├─→ If limited → 429 Too Many Requests
    └─→ If allowed → Continue
    ↓
[3] Identify source (webchat/whatsapp)
    ├─→ If webchat → Skip session, forward directly
    └─→ If whatsapp → Check session (step 4)
    ↓
[4] WhatsApp Session Check
    ├─→ Has valid session? → Forward to backend
    ├─→ Session expired? → Request new PIN
    └─→ No session + PIN in message? → Verify PIN
    ↓
[5] Forward to Agent Backend
    ├─→ Inject user_id from session
    ├─→ Audit log request
    └─→ Return agent response
```

**Environment Variables:**

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
AGENT_BACKEND_URL=https://pazarglobal-agent.railway.app
REDIS_URL=redis://localhost:6379  # Optional, in-memory fallback if unavailable
```

**Error Handling:**

- Redis unavailable → Fallback to in-memory (development mode)
- Backend unreachable → 503 Service Unavailable
- Invalid request → 400 Bad Request
- Rate limited → 429 Too Many Requests
- Session invalid → 401 Unauthorized + request PIN

**Database Dependencies:**

- `whatsapp_sessions` table (user_id, phone, session_token, is_verified)
- `profiles` table (user lookup)
- `audit_logs` table (request logging)

---

## 8. Mimari Kararlar & Trade-offs

### 8.1 Neden Modüler Agent Backend?

**Karar:** Tek main.py yerine `app/services/`, `app/routers/` ayrımı.

**Sebep:**

- Production'da binlerce satır olacak
- Test edilebilirlik (unit tests)
- Birden fazla geliştirici paralel çalışabilir
- Bakım kolaylığı

### 8.2 Neden Deterministik Kategori?

**Karar:** LLM'e category seçtirmek yerine heuristic matching.

**Sebep:**

- Frontend'in category ID'leri sabit
- LLM halüsinasyon riski (yanlış kategori)
- Hız (LLM çağrısı yok)
- Maliyet (token save)

### 8.3 Neden Keyword Metadata?

**Karar:** Listing'lere keyword injection, arama'da metadata filtresi.

**Sebep:**

- PostgreSQL full-text search yetersiz (Türkçe stemming zayıf)
- Elasticsearch gibi external search engine gereksiz maliyet
- JSONB GIN index + ILIKE hızlı ve yeterli
- Basitlik (tek DB)

### 8.4 Neden 3 Ayrı Repo?

**Karar:** Monorepo yerine 3 mikroservis.

**Sebep:**

- Bağımsız deployment
- Farklı teknoloji stack'leri (React, Python, Node.js)
- Team segregation (frontend/backend/bridge ekipleri)
- Scaling flexibility (agent backend'i yatay scale, diğerleri değil)

---

## 9. Dokümantasyon & Kaynaklar

### 9.1 README Dosyaları

- `pazarglobal-frontend/README.md` → Frontend kurulum/geliştirme
- `agent/README.md` → Agent backend API dokümantasyonu
- `whatsapp-bridge/README.md` → WhatsApp entegrasyon rehberi

### 9.2 Database Schema

Supabase PostgreSQL'de 15+ table bulunmaktadır. Detaylar:

#### User Management Tables

| Table | Purpose | Key Fields |
|-------|---------|-----------|
| `profiles` | Kullanıcı profil bilgileri | id (UUID), phone, email, full_name, avatar_url, is_verified, role |
| `user_security` | PIN hash, session tokens, güvenlik | user_id, phone, pin_hash, session_token, failed_attempts, is_locked |
| `user_sessions` | WhatsApp/aktif session tracking | id, user_id, phone, session_token, is_active, expires_at |
| `user_wallets` | Kredi bakiyesi | user_id (PK), balance_bigint, currency (TRY) |

#### Listing & Market Data Tables

| Table | Purpose | Key Fields |
|-------|---------|-----------|
| `listings` | İlan verileri | id, user_id, title, category, price, status, metadata (JSONB) |
| `product_images` | İlan görselleri | id, listing_id, storage_path, is_primary, display_order |
| `market_price_snapshots` | Fiyat önerileri cache | product_key (unique), category, min_price, max_price, avg_price, confidence |
| `market_data_query_log` | Fiyat sorgu logu | product_key, hit_type (cache_hit/miss), response_time_ms, cost |
| `market_data_ttl_config` | Kategori bazlı cache TTL | category, ttl_days |

#### Safety & Audit Tables

| Table | Purpose | Key Fields |
|-------|---------|-----------|
| `image_safety_flags` | Uygunsuz görsel kontrol | image_url, flag_type, confidence, status, reviewed_at |
| `audit_logs` | İşlem logu | phone, source, message, response_status, timestamp |

#### Schema Relationships

```
auth.users (Supabase Auth)
    ↓
profiles (id FK to auth.users.id)
    ├→ user_security (user_id FK, phone unique)
    ├→ user_sessions (user_id FK)
    ├→ user_wallets (user_id PK)
    └→ listings (user_id FK)
            └→ product_images (listing_id FK)
                    
market_price_snapshots (product_key unique)
    └→ market_data_query_log (product_key FK)

market_data_ttl_config (category unique)
```

#### Key Features

**RLS (Row-Level Security):**
- Her user sadece kendi verilerine erişebilir
- Admin ve moderator rolleri için özel politikalar
- Supabase Auth integration

**Indexes:**
- Text search (Turkish FTS) on listings title/description
- Composite indexes on common filters (status, category, location)
- GIN indexes for JSONB metadata/keywords

**Triggers:**
- `update_updated_at_column()` - Otomatik timestamp güncelle
- `normalize_phone_on_insert()` - Phone numarası normalize et

### 9.3 Postman/OpenAPI

- Agent Backend: `/docs` → FastAPI otomatik Swagger UI
- WhatsApp Bridge: `POST /webhook` endpoint dokümantasyonu

---

## 10. İletişim & Katkı

**Proje Sahibi:** Emrah Badas  
**Email:** [GitHub profilinde]  
**GitHub Repositories:**

- Frontend: <https://github.com/emrahbadas/Pazarglobal-v3-fronted>
- Agent: <https://github.com/emrahbadas/Pazarglobal-v3-Agents>
- Bridge: <https://github.com/emrahbadas/Pazarglobal-v3-whatsapp-bridge>

**Katkıda Bulunma:**

1. Fork the repo
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

---

**Son Güncelleme:** 15 Ocak 2026  
**Versiyon:** v3.0.0-production
