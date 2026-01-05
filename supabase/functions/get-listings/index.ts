import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// 🚀 SIMPLE IN-MEMORY CACHE (Redis hazırlığı)
interface CacheEntry {
  data: any;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 30000; // 30 saniye (production'da 60-120 olabilir)

function getCacheKey(filters: any): string {
  // Filter parametrelerinden unique key oluştur
  return JSON.stringify({
    categories: filters.categories?.sort() || [],
    priceRange: filters.priceRange || [0, 1000000],
    location: filters.location || '',
    condition: filters.condition?.sort() || [],
    isPremium: filters.isPremium || false,
    dateRange: filters.dateRange || 'all',
    search: filters.search || '',
  });
}

function getFromCache(key: string): any | null {
  const entry = cache.get(key);
  if (!entry) return null;
  
  const age = Date.now() - entry.timestamp;
  if (age > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  
  return entry.data;
}

function setCache(key: string, data: any): void {
  cache.set(key, {
    data,
    timestamp: Date.now(),
  });
  
  // Cleanup: cache 100'den fazla item varsa eski itemleri temizle
  if (cache.size > 100) {
    const oldestKeys = Array.from(cache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp)
      .slice(0, 20)
      .map(([key]) => key);
    oldestKeys.forEach(k => cache.delete(k));
  }
}

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const {
      categories,
      priceRange,
      location,
      condition,
      isPremium,
      dateRange,
      search,
      limit = 30 // 100 → 30 (daha hızlı initial load)
    } = await req.json();

    // 🚀 Cache check
    const cacheKey = getCacheKey({ categories, priceRange, location, condition, isPremium, dateRange, search, limit });
    const cached = getFromCache(cacheKey);
    
    if (cached) {
      console.log('✅ Cache HIT:', cacheKey.substring(0, 50));
      return new Response(
        JSON.stringify({ 
          success: true, 
          listings: cached.listings,
          count: cached.count,
          cached: true,
          cache_age_ms: Date.now() - cache.get(cacheKey)!.timestamp
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('❌ Cache MISS, fetching from DB...');

    console.log('Get Listings Request:', { categories, priceRange, location, condition, isPremium, dateRange, search, limit });

    // Supabase client oluştur
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Query oluştur
    let query = supabase
      .from('listings')
      .select('*')
      // Some environments have legacy rows with NULL or 'published' status.
      // Keep them visible so the UI doesn't silently drop listings.
      .or('status.eq.active,status.eq.published,status.is.null');

    // Kategori filtresi (array support)
    if (categories && Array.isArray(categories) && categories.length > 0) {
      query = query.in('category', categories);
    }

    // Fiyat aralığı filtresi
    if (priceRange && Array.isArray(priceRange) && priceRange.length === 2) {
      query = query.gte('price', priceRange[0]).lte('price', priceRange[1]);
    }

    // Konum filtresi
    if (location && location.trim()) {
      query = query.ilike('location', `%${location}%`);
    }

    // Durum filtresi (array support)
    if (condition && Array.isArray(condition) && condition.length > 0) {
      query = query.in('condition', condition);
    }

    // Premium filtresi
    if (isPremium === true) {
      query = query.eq('is_premium', true);
    }

    // Tarih aralığı filtresi
    if (dateRange && dateRange !== 'all') {
      const now = new Date();
      let dateThreshold: Date;

      switch (dateRange) {
        case 'today':
          dateThreshold = new Date(now.setHours(0, 0, 0, 0));
          break;
        case 'week':
          dateThreshold = new Date(now.setDate(now.getDate() - 7));
          break;
        case 'month':
          dateThreshold = new Date(now.setMonth(now.getMonth() - 1));
          break;
        default:
          dateThreshold = new Date(0);
      }

      query = query.gte('created_at', dateThreshold.toISOString());
    }

    // Arama filtresi (text search)
    if (search && search.trim()) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    }

    // Sort ve limit
    query = query.order('created_at', { ascending: false }).limit(limit);

    const { data: listings, error } = await query;

    if (error) {
      console.error('Database error:', error);
      throw error;
    }

    // ✅ Resim URL'lerini BULK olarak oluştur (her listing için ayrı ayrı değil)
    const listingsWithImages = listings?.map((listing: any) => {
      let imageUrls: string[] = [];
      
      if (listing.images && Array.isArray(listing.images) && listing.images.length > 0) {
        // Bulk URL generation (tek template ile hepsi)
        imageUrls = listing.images.map((path: string) => 
          `${supabaseUrl}/storage/v1/object/public/product-images/${path}`
        );
      } else if (listing.image_url) {
        imageUrls = [listing.image_url];
      }

      return {
        ...listing,
        image_urls: imageUrls,
        primary_image: imageUrls[0] || listing.image_url
      };
    }) || [];

    console.log(`✅ ${listingsWithImages.length} ilan bulundu (${Date.now() - performance.now()}ms)`);

    const result = {
      success: true, 
      listings: listingsWithImages,
      count: listingsWithImages.length,
      cached: false
    };

    // 🚀 Cache'e kaydet
    setCache(cacheKey, result);

    return new Response(
      JSON.stringify(result),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=30' // Browser cache
        } 
      }
    );

  } catch (error: any) {
    console.error('Get Listings Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'İlanlar alınırken bir hata oluştu',
        listings: []
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
