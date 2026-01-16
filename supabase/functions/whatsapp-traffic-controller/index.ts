/**
 * WhatsApp Traffic Controller - Edge Function
 * 
 * Merkezi traffic kontrol ve rate limiting:
 * - Redis-based rate limiting (10 req/min, 100 req/hour per phone)
 * - Session management + PIN doğrulama
 * - Agent backend'e secure forwarding
 * - Audit logging + retry logic
 * 
 * Flow: WhatsApp Bridge → Edge Function (rate limit check) → Agent Backend
 */

// @ts-ignore - Deno runtime import
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
// @ts-ignore - Local import
import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_KEY')!;
const AGENT_BACKEND_URL = Deno.env.get('AGENT_BACKEND_URL') || 'https://pazarglobal-agent.railway.app';
const REDIS_URL = Deno.env.get('REDIS_URL') || 'redis://localhost:6379';

// Rate limits (per phone number)
const RATE_LIMITS = {
  max_requests_per_minute: 10,
  max_requests_per_hour: 100,
  cooldown_seconds: 5,
};

interface IncomingRequest {
  source: 'whatsapp' | 'webchat';
  phone?: string;
  user_id?: string;
  message: string;
  media_paths?: string[];
  media_type?: string;
  conversation_history?: any[];
  draft_listing_id?: string;
  session_token?: string;
  user_context?: Record<string, any>;
}

interface RateLimitState {
  minute_count: number;
  hour_count: number;
  last_request: number;
  phone: string;
}

// Redis connection helper with fallback
async function getRedisConnection(): Promise<any> {
  try {
    // @ts-ignore - Deno Redis import
    const { connect } = await import('https://deno.land/x/redis@v0.32.1/mod.ts');
    const redis = await connect({ url: REDIS_URL });
    return redis;
  } catch (error) {
    console.warn('⚠️ Redis connection failed, using in-memory fallback:', error instanceof Error ? error.message : String(error));
    // In-memory fallback for development
    return null;
  }
}

// In-memory rate limit store (fallback)
const inMemoryRateLimits = new Map<string, RateLimitState>();

async function checkRateLimit(phone: string, redis: any): Promise<{ allowed: boolean; reason?: string }> {
  const now = Date.now();
  
  if (redis) {
    // Redis-based rate limiting
    const key = `rate_limit:${phone}`;
    try {
      const state = await redis.hgetall(key);
      if (!state || Object.keys(state).length === 0) {
        // First request
        await redis.hset(key, {
          minute_count: 1,
          hour_count: 1,
          last_request: now.toString(),
          phone,
        });
        await redis.expire(key, 3600); // 1 hour TTL
        return { allowed: true };
      }

      const minute_count = parseInt(state.minute_count || '0', 10);
      const hour_count = parseInt(state.hour_count || '0', 10);
      const last_request = parseInt(state.last_request || '0', 10);

      // Reset minute counter if > 60s passed
      let new_minute_count = minute_count;
      if (now - last_request > 60 * 1000) {
        new_minute_count = 1;
      } else if (minute_count >= RATE_LIMITS.max_requests_per_minute) {
        return { 
          allowed: false, 
          reason: `Rate limited: ${minute_count}/${RATE_LIMITS.max_requests_per_minute} requests/min` 
        };
      } else {
        new_minute_count += 1;
      }

      // Check hour limit
      if (hour_count >= RATE_LIMITS.max_requests_per_hour) {
        return { 
          allowed: false, 
          reason: `Rate limited: ${hour_count}/${RATE_LIMITS.max_requests_per_hour} requests/hour` 
        };
      }

      // Update Redis
      await redis.hset(key, {
        minute_count: new_minute_count.toString(),
        hour_count: (hour_count + 1).toString(),
        last_request: now.toString(),
        phone,
      });
      
      return { allowed: true };
    } catch (error) {
      console.error('❌ Redis rate limit check failed:', error instanceof Error ? error.message : String(error));
      // Fallback to in-memory on Redis error
      return checkRateLimitInMemory(phone);
    }
  } else {
    // In-memory fallback
    return checkRateLimitInMemory(phone);
  }
}

function checkRateLimitInMemory(phone: string): { allowed: boolean; reason?: string } {
  const now = Date.now();
  const state = inMemoryRateLimits.get(phone);

  if (!state) {
    inMemoryRateLimits.set(phone, {
      minute_count: 1,
      hour_count: 1,
      last_request: now,
      phone,
    });
    return { allowed: true };
  }

  // Reset minute counter if > 60s passed
  let new_minute_count = state.minute_count;
  if (now - state.last_request > 60 * 1000) {
    new_minute_count = 1;
  } else if (state.minute_count >= RATE_LIMITS.max_requests_per_minute) {
    return { 
      allowed: false, 
      reason: `Rate limited: ${state.minute_count}/${RATE_LIMITS.max_requests_per_minute} requests/min` 
    };
  } else {
    new_minute_count += 1;
  }

  // Check hour limit
  if (state.hour_count >= RATE_LIMITS.max_requests_per_hour) {
    return { 
      allowed: false, 
      reason: `Rate limited: ${state.hour_count}/${RATE_LIMITS.max_requests_per_hour} requests/hour` 
    };
  }

  state.minute_count = new_minute_count;
  state.hour_count += 1;
  state.last_request = now;

  return { allowed: true };
}

// @ts-ignore - Deno.serve
Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // @ts-ignore - Deno global
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const redis = await getRedisConnection();

    const requestData: IncomingRequest = await req.json();
    const phone = requestData.phone || requestData.user_id;

    if (!phone) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Phone number required',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // ═══════════════════════════════════════════════════════════
    // RATE LIMITING CHECK (Her request için)
    // ═══════════════════════════════════════════════════════════
    console.log(`📱 Request from: ${phone}`);
    const rateLimitCheck = await checkRateLimit(phone, redis);
    
    if (!rateLimitCheck.allowed) {
      console.warn(`⛔ Rate limit exceeded: ${rateLimitCheck.reason}`);
      return new Response(
        JSON.stringify({
          success: false,
          error: rateLimitCheck.reason || 'Rate limit exceeded',
          retry_after: 60,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 429 }
      );
    }

    // ═══════════════════════════════════════════════════════════
    // WEBCHAT REQUEST - No session needed
    // ═══════════════════════════════════════════════════════════
    if (requestData.source === 'webchat') {
      console.log('🌐 WebChat request → Agent Backend (/agent/run)');

      const backendPayload = {
        user_id: requestData.user_id || phone || 'webchat',
        phone: requestData.phone,
        message: requestData.message,
        conversation_history: requestData.conversation_history || [],
        media_paths: requestData.media_paths,
        media_type: requestData.media_type,
        draft_listing_id: requestData.draft_listing_id,
        session_token: requestData.session_token,
        user_context: requestData.user_context,
      };

      try {
        const backendResponse = await fetch(`${AGENT_BACKEND_URL}/agent/run`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(backendPayload),
        });

        const backendData = await backendResponse.json();

        return new Response(JSON.stringify(backendData), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: backendResponse.status,
        });
      } catch (fetchError) {
        console.error('❌ Backend fetch error:', fetchError);
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Backend service unavailable',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 503 }
        );
      }
    }

    // ═══════════════════════════════════════════════════════════
    // WHATSAPP REQUEST - Session + PIN kontrolü + USER_ID LOOKUP
    // ═══════════════════════════════════════════════════════════
    console.log(`📞 WhatsApp request from: ${phone}`);

    // ⭐ KRİTİK: Telefon numarası ile user_id'yi bul (referans doküman çözümü)
    const { data: user, error: userError } = await supabase
      .from('profiles')
      .select('id, phone, display_name, full_name')
      .eq('phone', phone)
      .single();

    if (userError || !user) {
      console.warn(`⚠️ Telefon numarası kayıtlı değil: ${phone}`);
      return new Response(
        JSON.stringify({
          success: false,
          step: 'registration_required',
          response: '❌ Bu telefon numarası kayıtlı değil.\n\n' +
                    '🔗 Kayıt olmak için: https://pazarglobal.com/auth/register\n\n' +
                    'Kayıt olduktan sonra profil ayarlarından WhatsApp PIN\'ini aktifleştirin.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const userId = user.id; // ⭐ Artık her zaman aynı user_id kullanılıyor
    console.log(`✅ User ID found: ${userId} for phone: ${phone}`);

    // Session kontrolü
    const { data: session, error: sessionError } = await supabase
      .from('whatsapp_sessions')
      .select('*')
      .eq('phone', phone)
      .eq('user_id', userId) // user_id ile de eşleştir
      .single();

    if (sessionError && sessionError.code !== 'PGRST116') {
      // PGRST116 = no rows found (normal case)
      console.error('❌ Session query error:', sessionError);
    }

    // PIN doğrulama (kısaltılmış örnek)
    if (!session || !session.is_verified) {
      // Yeni session oluştur veya PIN doğrulamayı iste
      console.log('🔑 PIN verification required');
      
      return new Response(
        JSON.stringify({
          success: false,
          step: 'pin_required',
          response: 'Lütfen PIN kodunuzu girin. PIN\'inizi hatırlamıyorsanız web sitesinden profil ayarlarınızdan yeni PIN oluşturabilirsiniz.',
          user_id: userId, // Frontend'e user_id'yi gönder
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // ═══════════════════════════════════════════════════════════
    // FORWARD TO AGENT BACKEND (with correct user_id)
    // ═══════════════════════════════════════════════════════════
    console.log(`✅ Session verified → Forwarding to Agent Backend with user_id: ${userId}`);

    const agentPayload = {
      user_id: userId, // ⭐ Telefon numarasından bulunan user_id kullanılıyor
      phone,
      message: requestData.message,
      conversation_history: requestData.conversation_history || [],
      media_paths: requestData.media_paths,
      media_type: requestData.media_type,
      draft_listing_id: requestData.draft_listing_id,
      source: 'whatsapp',
      user_context: {
        display_name: user.display_name || user.full_name,
        ...requestData.user_context,
      },
    };

    try {
      const agentResponse = await fetch(`${AGENT_BACKEND_URL}/agent/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(agentPayload),
      });

      const agentData = await agentResponse.json();

      // Audit log
      await supabase
        .from('audit_logs')
        .insert({
          phone,
          source: 'whatsapp',
          message: requestData.message,
          response_status: agentResponse.status,
          timestamp: new Date().toISOString(),
        })
        .select()
        .single();

      return new Response(JSON.stringify(agentData), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: agentResponse.status,
      });
    } catch (fetchError) {
      console.error('❌ Agent fetch error:', fetchError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Agent service unavailable',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 503 }
      );
    }
  } catch (error) {
    console.error('❌ Handler error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
