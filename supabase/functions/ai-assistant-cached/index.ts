import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// 🔑 Product Key Normalizasyon (inline)
function normalizeProductKey(title: string, category: string): string {
  const turkishMap: { [key: string]: string } = {
    'ç': 'c', 'Ç': 'C', 'ğ': 'g', 'Ğ': 'G',
    'ı': 'i', 'I': 'I', 'İ': 'I', 'i': 'i',
    'ö': 'o', 'Ö': 'O', 'ş': 's', 'Ş': 'S',
    'ü': 'u', 'Ü': 'U'
  };

  let normalized = title;
  for (const [turkish, english] of Object.entries(turkishMap)) {
    normalized = normalized.replace(new RegExp(turkish, 'g'), english);
  }

  normalized = normalized.toLowerCase();

  const stopWords = [
    'satilik', 'temiz', 'bakimli', 'orjinal', 'orijinal',
    'az', 'kullanilmis', 'sifir', 'ayarinda', 'gibi',
    'hatasiz', 'boyasiz', 'degisensiz', 'garantili',
    'acil', 'ucuz', 'uygun', 'firsat', 'son', 'model',
    'yeni', 'ikinci', 'el', '2.el', 'ikinciel'
  ];

  stopWords.forEach(word => {
    normalized = normalized.replace(new RegExp(`\\b${word}\\b`, 'gi'), '');
  });

  normalized = normalized
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const categoryKey = category.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_');
  const words = normalized.split(' ').filter(w => w.length > 0);
  const productKey = words.join('_');

  return `${categoryKey}_${productKey}`;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { action, category, title, description, condition } = await req.json();

    console.log('📦 Request:', { action, category, title, description, condition });

    if (action !== 'suggest_price') {
      return new Response(
        JSON.stringify({ success: false, error: 'Only suggest_price action supported in cache mode' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1️⃣ Product key oluştur
    const productKey = normalizeProductKey(title, category);
    console.log('🔑 Product Key:', productKey);

    // 2️⃣ Cache'te var mı kontrol et
    const { data: cachedData, error: cacheError } = await supabase
      .from('market_price_snapshots')
      .select('*')
      .eq('product_key', productKey)
      .single();

    console.log('💾 Cache lookup:', { found: !!cachedData, expired: cachedData?.expires_at < new Date().toISOString() });

    // 3️⃣ CACHE HIT - Taze veri varsa
    if (cachedData && !cacheError && new Date(cachedData.expires_at) > new Date()) {
      console.log('✅ CACHE HIT - Önbellekten dönüyor');

      // Sorgu sayısını artır
      await supabase.rpc('increment_query_count', { p_product_key: productKey });

      // Log query
      await supabase.from('market_data_query_log').insert({
        product_key: productKey,
        category: category,
        hit_type: 'cache_hit',
        response_time_ms: 50,
        cost: 0.0
      });

      // Durum katsayısı uygula
      const conditionMultipliers: { [key: string]: number } = {
        'Sıfır': 1.0,
        'Az Kullanılmış': 0.85,
        'İyi Durumda': 0.70,
        'Orta Durumda': 0.55
      };
      const multiplier = conditionMultipliers[condition || 'İyi Durumda'] || 0.70;
      const finalPrice = Math.round(cachedData.avg_price * multiplier);

      const explanation = `🌐 GÜNCEL PİYASA VERİSİ (Önbellek):\n\n` +
        `📊 Fiyat Aralığı: ${cachedData.min_price.toLocaleString('tr-TR')} - ${cachedData.max_price.toLocaleString('tr-TR')} ₺\n` +
        `📈 Piyasa Ortalaması: ${cachedData.avg_price.toLocaleString('tr-TR')} ₺\n` +
        `⚙️ Durum Katsayısı: ${condition || 'İyi Durumda'} (×${multiplier})\n` +
        `🎯 Güven Skoru: ${(cachedData.confidence * 100).toFixed(0)}%\n\n` +
        `💰 ÖNERİLEN SATIŞ FİYATI: ${finalPrice.toLocaleString('tr-TR')} ₺\n\n` +
        `📅 Son Güncelleme: ${new Date(cachedData.last_updated_at).toLocaleDateString('tr-TR')}\n` +
        `✅ Veriler ${cachedData.sources.length} farklı kaynaktan toplanmıştır.`;

      return new Response(
        JSON.stringify({ 
          success: true, 
          result: explanation,
          price: finalPrice,
          cached: true,
          confidence: cachedData.confidence
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4️⃣ CACHE MISS - Perplexity çağır
    console.log('❌ CACHE MISS - Perplexity çağrılıyor');

    const startTime = Date.now();
    const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY');

    if (!PERPLEXITY_API_KEY) {
      throw new Error('PERPLEXITY_API_KEY bulunamadı');
    }

    const perplexityResponse = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          {
            role: 'system',
            content: 'Sen bir fiyat araştırma uzmanısın. Türkiye\'deki e-ticaret sitelerinden GERÇEK GÜNCEL fiyat verilerini topluyorsun. SADECE sayısal fiyat aralığı ver.'
          },
          {
            role: 'user',
            content: `"${title}" için Türkiye'deki e-ticaret sitelerindeki GÜNCEL satış fiyatları nedir?

Kategori: ${category}
Durum: ${condition || 'Az Kullanılmış'}${description ? `\n\nÜrün Detayları: ${description}` : ''}

KURALLAR:
- Format: XXXXXX-YYYYYY
- Sadece rakam ve tire
- Gerçek sitelerden güncel veri
- Ürün detaylarını dikkate al

Örnek: 25000-35000`
          }
        ],
        temperature: 0.1,
        max_tokens: 150,
        search_mode: 'web',
        web_search_options: {
          search_context_size: 'high'
        },
        search_domain_filter: [
          'sahibinden.com',
          'arabam.com', 
          'letgo.com',
          'hepsiburada.com',
          'trendyol.com'
        ],
        search_recency_filter: 'week'
      }),
    });

    if (!perplexityResponse.ok) {
      throw new Error(`Perplexity API error: ${perplexityResponse.status}`);
    }

    const perplexityData = await perplexityResponse.json();
    const responseTime = Date.now() - startTime;
    const priceText = perplexityData.choices[0]?.message?.content?.trim() || '';
    const searchResults = perplexityData.search_results || [];

    console.log('🌐 Perplexity yanıt:', priceText);
    console.log('🔗 Kaynaklar:', searchResults.length);

    // Parse fiyat (robust): accept either a range (X-Y) or a single price.
    const cleanText = priceText
      .replace(/TL|₺|lira|try/gi, '')
      .replace(/[.,]/g, '')
      .trim();

    const numbers = cleanText.match(/\d{4,}/g) || [];
    let minPrice = 0;
    let maxPrice = 0;

    if (numbers.length >= 2) {
      minPrice = parseInt(numbers[0], 10);
      maxPrice = parseInt(numbers[1], 10);
    } else if (numbers.length === 1) {
      const single = parseInt(numbers[0], 10);
      minPrice = Math.round(single * 0.85);
      maxPrice = Math.round(single * 1.15);
    } else {
      throw new Error('Fiyat parse edilemedi');
    }

    if (minPrice > maxPrice) {
      const tmp = minPrice;
      minPrice = maxPrice;
      maxPrice = tmp;
    }

    const avgPrice = (minPrice + maxPrice) / 2;

    // Kaynakları parse et
    interface SearchResult {
      url?: string;
      date?: string;
    }
    const sources = searchResults.map((r: SearchResult) => ({
      name: r.url?.includes('sahibinden') ? 'Sahibinden' :
            r.url?.includes('hepsiburada') ? 'Hepsiburada' :
            r.url?.includes('trendyol') ? 'Trendyol' :
            r.url?.includes('arabam') ? 'Arabam' : 'Web',
      url: r.url,
      date: r.date
    }));

    // Confidence hesapla
    const priceRange = maxPrice - minPrice;
    const priceRangeRatio = priceRange / avgPrice;
    
    const sourceScore = Math.min(searchResults.length / 10, 1.0) * 0.4;
    const freshnessScore = 1.0 * 0.3; // Yeni veri
    const consistencyScore = Math.max(0, 1 - priceRangeRatio) * 0.3;
    const confidence = sourceScore + freshnessScore + consistencyScore;

    // TTL hesapla
    const ttlMap: Record<string, number> = {
      'Elektronik': 7,
      'Otomotiv': 14,
      'Emlak': 30,
      'Moda & Aksesuar': 7,
      'Ev & Yaşam': 14,
      'Spor & Outdoor': 14,
      'Kitap & Hobi': 30,
      'Mobilya': 21,
      'Diğer': 14
    };
    const ttlDays = ttlMap[category] || 14;

    const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

    // 5️⃣ Cache'e kaydet
    const { error: insertError } = await supabase
      .from('market_price_snapshots')
      .upsert({
        product_key: productKey,
        original_title: title,
        category: category,
        condition: condition,
        min_price: minPrice,
        max_price: maxPrice,
        avg_price: avgPrice,
        sources: sources,
        confidence: confidence,
        query_count: 1,
        last_query_at: new Date().toISOString(),
        last_updated_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
        raw_data: perplexityData
      }, {
        onConflict: 'product_key'
      });

    if (insertError) {
      console.error('❌ Cache kayıt hatası:', insertError);
    } else {
      console.log('✅ Cache kaydedildi');
    }

    // Log query
    await supabase.from('market_data_query_log').insert({
      product_key: productKey,
      category: category,
      hit_type: 'api_call',
      response_time_ms: responseTime,
      cost: 0.012 // Perplexity maliyeti
    });

    // Durum katsayısı uygula
    const conditionMultipliers: { [key: string]: number } = {
      'Sıfır': 1.0,
      'Az Kullanılmış': 0.85,
      'İyi Durumda': 0.70,
      'Orta Durumda': 0.55
    };
    const multiplier = conditionMultipliers[condition || 'İyi Durumda'] || 0.70;
    const finalPrice = Math.round(avgPrice * multiplier);

    const explanation = `🌐 GERÇEK PİYASA VERİSİ:\n\n` +
      `📊 Güncel Fiyat Aralığı: ${minPrice.toLocaleString('tr-TR')} - ${maxPrice.toLocaleString('tr-TR')} ₺\n` +
      `📈 Piyasa Ortalaması: ${avgPrice.toLocaleString('tr-TR')} ₺\n` +
      `⚙️ Durum Katsayısı: ${condition || 'İyi Durumda'} (×${multiplier})\n` +
      `🎯 Güven Skoru: ${(confidence * 100).toFixed(0)}%\n\n` +
      `💰 ÖNERİLEN SATIŞ FİYATI: ${finalPrice.toLocaleString('tr-TR')} ₺\n\n` +
      `✅ Bu fiyat ${sources.length} farklı e-ticaret sitesinden alınan güncel verilere dayanmaktadır.`;

    return new Response(
      JSON.stringify({ 
        success: true, 
        result: explanation,
        price: finalPrice,
        cached: false,
        confidence: confidence
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
