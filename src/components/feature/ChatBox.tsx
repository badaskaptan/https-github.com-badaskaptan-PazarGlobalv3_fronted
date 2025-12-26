import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import { useAuthStore } from '../../stores/authStore';
import VoiceChat from './VoiceChat';
import VoiceSelector from './VoiceSelector';
import ReactMarkdown from 'react-markdown';
import { format, formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Pagination, Navigation } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';
import 'swiper/css/navigation';
import './ChatBox.css';

type Message = {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
  listings?: any[]; // İlan bilgileri için
};

type Tab = 'general' | 'listing' | 'support';

// Supabase client (public anon key for uploads to public bucket)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);
const PUBLIC_BUCKET = 'product-images';
const AGENT_API_BASE =
  (import.meta.env as any).VITE_AGENT_API_BASE?.trim() ||
  (import.meta.env as any).NEXT_PUBLIC_AGENT_API_BASE?.trim() ||
  '';

// Generate or retrieve unique user ID
const getUserId = (): string => {
  let userId = localStorage.getItem('web_user_id');
  if (!userId) {
    userId = `web_user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('web_user_id', userId);
  }
  return userId;
};

// Parse listing data from message
const parseListings = (content: string): { cleanContent: string; listings: any[] } => {
  const searchCacheMatch = content.match(/\[SEARCH_CACHE\]({.*})/s);
  if (searchCacheMatch) {
    try {
      const cacheData = JSON.parse(searchCacheMatch[1]);
      const cleanContent = content.replace(/\[SEARCH_CACHE\].*$/s, '').trim();
      return { cleanContent, listings: cacheData.results || [] };
    } catch (e) {
      console.error('Failed to parse listings:', e);
    }
  }
  return { cleanContent: content, listings: [] };
};

// Deduplicate path list (keeps order of first occurrence)
const dedupePaths = (paths: string[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const p of paths) {
    if (p && !seen.has(p)) {
      seen.add(p);
      result.push(p);
    }
  }
  return result;
};

// Resim sıkıştırma fonksiyonu
const compressImage = async (file: File, maxSizeMB: number = 0.9): Promise<File> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Maksimum boyut kontrolü (uzun kenar max 1920px)
        const maxDimension = 1920;
        if (width > height && width > maxDimension) {
          height = (height * maxDimension) / width;
          width = maxDimension;
        } else if (height > maxDimension) {
          width = (width * maxDimension) / height;
          height = maxDimension;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        // Kalite ayarı ile sıkıştırma
        let quality = 0.9;
        const maxSizeBytes = maxSizeMB * 1024 * 1024;

        const tryCompress = (q: number) => {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Resim sıkıştırılamadı'));
                return;
              }

              // Eğer boyut hala büyükse, kaliteyi düşür
              if (blob.size > maxSizeBytes && q > 0.1) {
                tryCompress(q - 0.1);
              } else {
                const compressedFile = new File([blob], file.name, {
                  type: 'image/jpeg',
                  lastModified: Date.now(),
                });
                resolve(compressedFile);
              }
            },
            'image/jpeg',
            q
          );
        };

        tryCompress(quality);
      };
      img.onerror = () => reject(new Error('Resim yüklenemedi'));
    };
    reader.onerror = () => reject(new Error('Dosya okunamadı'));
  });
};

// Supabase'e resim yükleme fonksiyonu
const uploadImageToSupabase = async (file: File, userId: string): Promise<{ storagePath: string; publicUrl: string }> => {
  const fileExt = file.name.split('.').pop() || 'jpg';
  const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
  
  // Kullanıcı telefon numarasını almaya çalış
  let userPhone = userId;
  try {
    const { data: profileData } = await supabase
      .from('profiles')
      .select('phone')
      .eq('id', userId)
      .single();
    
    if (profileData?.phone) {
      userPhone = profileData.phone.replace(/\D/g, '');
    }
  } catch (err) {
    console.error('Telefon numarası alınamadı, userId kullanılacak:', err);
  }

  // Geçici listing ID (gerçek ID agent tarafından oluşturulacak)
  const tempListingId = `webchat_${Date.now()}`;
  
  // Path: userPhone/listing_id/image.jpg
  const storagePath = `${userPhone}/${tempListingId}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from(PUBLIC_BUCKET)
    .upload(storagePath, file);

  if (uploadError) {
    console.error('Supabase upload error:', uploadError);
    throw new Error(`Resim yüklenemedi: ${uploadError.message}`);
  }

  // Public URL oluştur
  const { data: publicUrlData } = supabase.storage
    .from(PUBLIC_BUCKET)
    .getPublicUrl(storagePath);

  return {
    storagePath,
    publicUrl: publicUrlData.publicUrl
  };
};

export default function ChatBox() {
  const navigate = useNavigate();
  const { user, customUser, profile, checkAuth } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('listing');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'ai',
      content: 'Merhaba! Ben PazarAI. Size nasıl yardımcı olabilirim? İlan vermek için fotoğraf gönderebilir veya ürününüzü anlatabilirsiniz.',
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [displayCount, setDisplayCount] = useState(3);
  const [detailListing, setDetailListing] = useState<any>(null);
  const [voiceMode, setVoiceMode] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentMessageRef = useRef<string>('');
  const conversationHistory = useRef<Array<{ role: string; content: string }>>([]);
  const pendingMediaPathsRef = useRef<string[]>([]);

  const ensureWebhookUrl = () => {
    if (!WEBCHAT_WEBHOOK_URL) {
      throw new Error('VITE_WEBCHAT_WEBHOOK_URL tanımlı değil. n8n webchat webhook adresini .env dosyanıza ekleyin.');
    }

    // Basic validation: must contain "/webhook/" and at least one path segment
    try {
      const u = new URL(WEBCHAT_WEBHOOK_URL);
      if (!u.pathname.includes('/webhook/') && !u.pathname.includes('/webhook')) {
        console.warn('VITE_WEBCHAT_WEBHOOK_URL görünümü beklenen formatta değil:', WEBCHAT_WEBHOOK_URL);
      }
      return WEBCHAT_WEBHOOK_URL;
    } catch (e) {
      throw new Error('VITE_WEBCHAT_WEBHOOK_URL geçersiz bir URL olarak görünüyor: ' + WEBCHAT_WEBHOOK_URL);
    }
  };

  const handleMediaMetaUpdate = (payload: any) => {
    const safe = Array.isArray(payload?.safe_media_paths) ? (payload.safe_media_paths as string[]) : [];
    const blocked = Array.isArray(payload?.blocked_media_paths) ? payload.blocked_media_paths : [];
    const blockedPaths = blocked
      .map((entry: any) => (entry && typeof entry === 'object' ? entry.path : null))
      .filter(Boolean) as string[];

    const nextPending = dedupePaths([
      ...(pendingMediaPathsRef.current || []),
      ...safe,
    ]).filter((p) => !blockedPaths.includes(p));

    pendingMediaPathsRef.current = nextPending;

    if (blocked.length > 0) {
      const blockedMessage: Message = {
        id: `${Date.now()}_blocked`,
        type: 'ai',
        content: `⚠️ ${blocked.length} fotoğraf güvenlik kontrolünden geçemedi ve elendi. ${safe.length} fotoğraf güvenli olarak kaydedildi.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, blockedMessage]);
    }

    const mediaNote = `[SYSTEM_MEDIA_NOTE] MEDIA_PATHS=${JSON.stringify(nextPending)}`;
    const last = conversationHistory.current[conversationHistory.current.length - 1];
    if (!last || last.role !== 'assistant' || last.content !== mediaNote) {
      conversationHistory.current.push({ role: 'assistant', content: mediaNote });
    }
  };

  const commitAssistantResponse = (rawContent: string, aiMessageId?: string, forcedListings?: any[]) => {
    const { cleanContent, listings } = parseListings(rawContent || '');
    const resolvedListings = forcedListings && forcedListings.length > 0 ? forcedListings : listings;

    if (!cleanContent && (!resolvedListings || resolvedListings.length === 0)) {
      return;
    }

    if (cleanContent) {
      conversationHistory.current.push({
        role: 'assistant',
        content: cleanContent,
      });

      const lc = cleanContent.toLowerCase();
      if (lc.includes('ilan yayınlandı') || lc.includes('✅ ilan yayınlandı')) {
        pendingMediaPathsRef.current = [];
      }
      if (lc.includes('iptal edildi') || lc.startsWith('iptal') || lc.includes('işlemi iptal')) {
        pendingMediaPathsRef.current = [];
      }
    }

    setMessages((prev) => {
      const updated = [...prev];
      if (aiMessageId) {
        const existingIndex = updated.findIndex((m) => m.id === aiMessageId);
        if (existingIndex >= 0) {
          updated[existingIndex] = {
            ...updated[existingIndex],
            content: cleanContent,
            listings: resolvedListings && resolvedListings.length > 0 ? resolvedListings : undefined,
          };
          return updated;
        }
      }

      return [
        ...updated,
        {
          id: aiMessageId || `${Date.now()}`,
          type: 'ai',
          content: cleanContent,
          timestamp: new Date(),
          listings: resolvedListings && resolvedListings.length > 0 ? resolvedListings : undefined,
        },
      ];
    });

    if (voiceMode && (window as any).speakResponse && cleanContent) {
      setTimeout(() => (window as any).speakResponse(cleanContent), 150);
    }
  };

  const WEBCHAT_WEBHOOK_URL = import.meta.env.VITE_WEBCHAT_WEBHOOK_URL?.trim();

  // Direct agent API sender (preferred when AGENT_API_BASE is set)
  const sendMessageToAgentDirect = async (message: string, mediaPaths: string[], resolvedUserId: string) => {
    if (!AGENT_API_BASE) return false;
    const endpoint = `${AGENT_API_BASE.replace(/\/$/, '')}/webchat/message`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session_id: resolvedUserId,
        message,
        user_id: resolvedUserId,
        media_url: mediaPaths[0],
        media_urls: mediaPaths.length > 0 ? mediaPaths : undefined,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '<failed to read response body>');
      throw new Error(`Agent hatası (${response.status}): ${errorText || response.statusText || 'Bilinmeyen hata'}`);
    }

    const json = await response.json();
    const assistantText = json.message || json.response || '';
    const listings = json.data?.listings || json.listings;
    if (assistantText) {
      commitAssistantResponse(assistantText, undefined, listings);
    }
    if (mediaPaths.length > 0) {
      pendingMediaPathsRef.current = [];
    }
    return true;
  };

  const sendMessageToAgent = async (message: string, options?: { mediaPaths?: string[]; mediaType?: string }) => {
    setIsTyping(true);
    setIsConnecting(true);
    setError(null);
    currentMessageRef.current = '';

    const sessionToken = localStorage.getItem('session_token');
    const storedUserId = localStorage.getItem('user_id');
    const resolvedUserId = customUser?.id || user?.id || storedUserId || getUserId();
    const userContext = {
      user_id: resolvedUserId,
      session_token: sessionToken || undefined,
      email: user?.email || customUser?.email || undefined,
      phone: customUser?.phone || undefined,
      name: profile?.full_name || customUser?.full_name || user?.user_metadata?.full_name || undefined,
      source: 'web-chat',
    };

    conversationHistory.current.push({
      role: 'user',
      content: message,
    });

    const mediaPaths = dedupePaths(options?.mediaPaths || []);

    if (AGENT_API_BASE) {
      try {
        await sendMessageToAgentDirect(message, mediaPaths, resolvedUserId);
        setIsTyping(false);
        setIsConnecting(false);
        return;
      } catch (apiErr) {
        console.warn('Agent API call failed, falling back to webhook flow:', apiErr);
      }
    }

    if (mediaPaths.length > 0) {
      console.log('🖼️  Sending media_paths to n8n webhook:', mediaPaths);
      console.log('🖼️  Sending media_type to n8n webhook:', options?.mediaType);
    }

    const payload = {
      sessionId: resolvedUserId,
      message,
      source: 'pazarglobal-webchat',
      mediaPaths: mediaPaths.length > 0 ? mediaPaths : undefined,
      media_paths: mediaPaths.length > 0 ? mediaPaths : undefined,
      media_urls: mediaPaths.length > 0 ? mediaPaths : undefined,
      mediaType: options?.mediaType,
      media_type: options?.mediaType,
      metadata: {
        userContext,
        mediaPaths: mediaPaths.length > 0 ? mediaPaths : undefined,
        mediaType: options?.mediaType,
        conversationHistory: conversationHistory.current,
        pendingMedia: pendingMediaPathsRef.current,
      },
    };

    const upsertStreamingMessage = (aiMessageId: string) => {
      setMessages((prev) => {
        const existingIndex = prev.findIndex((m) => m.id === aiMessageId);
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = {
            ...updated[existingIndex],
            content: currentMessageRef.current,
          };
          return updated;
        }
        return [
          ...prev,
          {
            id: aiMessageId,
            type: 'ai',
            content: currentMessageRef.current,
            timestamp: new Date(),
          },
        ];
      });
    };

    const extractAssistantFromJson = (data: any) => {
      if (!data) {
        return { text: '', listings: undefined as any[] | undefined };
      }
      if (typeof data.message === 'string') {
        return { text: data.message, listings: data.listings };
      }
      if (typeof data.response === 'string') {
        return { text: data.response, listings: data.listings };
      }
      if (typeof data.text === 'string') {
        return { text: data.text, listings: data.listings };
      }
      if (Array.isArray(data.messages)) {
        const assistant = data.messages.find((m: any) => m.role === 'assistant');
        if (assistant?.content) {
          return { text: assistant.content, listings: assistant.listings || data.listings };
        }
      }
      if (data.data?.message) {
        return { text: data.data.message, listings: data.data.listings };
      }
      return { text: '', listings: undefined };
    };

    try {
      const webhookUrl = ensureWebhookUrl();
      console.debug('Posting to n8n webhook:', webhookUrl, 'payload:', { sessionId: resolvedUserId, message, mediaPaths });
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let errorText = '';
        try {
          errorText = await response.text();
        } catch (e) {
          errorText = '<failed to read response body>';
        }
        console.error('n8n webhook non-OK response', { status: response.status, statusText: response.statusText, headers: Object.fromEntries(response.headers.entries()), body: errorText });
        throw new Error(`n8n webhook hatası (${response.status}): ${errorText || response.statusText || 'Bilinmeyen hata'}`);
      }

      setIsConnecting(false);

      const contentType = response.headers.get('content-type') || '';

      if (contentType.includes('text/event-stream')) {
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('n8n SSE yanıtı okunamadı.');
        }

        const decoder = new TextDecoder();
        const aiMessageId = Date.now().toString();
        let buffer = '';
        let streamClosed = false;

        const finalizeStream = (listingsFromPayload?: any[]) => {
          if (streamClosed) return;
          streamClosed = true;
          commitAssistantResponse(currentMessageRef.current, aiMessageId, listingsFromPayload);
          setIsTyping(false);
          if (mediaPaths.length > 0) {
            pendingMediaPathsRef.current = [];
          }
        };

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            finalizeStream();
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line || !line.startsWith('data:')) {
              continue;
            }

            const payloadLine = line.slice(5).trim();
            if (!payloadLine) {
              continue;
            }

            if (payloadLine === '[DONE]') {
              finalizeStream();
              continue;
            }

            try {
              const data = JSON.parse(payloadLine);

              if (data.type === 'meta' || data.event === 'meta') {
                handleMediaMetaUpdate(data);
                continue;
              }

              if (data.type === 'error' || data.event === 'error') {
                throw new Error(data.content || data.message || 'n8n workflow hata döndürdü.');
              }

              const chunk = data.token ?? data.content ?? data.text ?? data.delta;
              if (typeof chunk === 'string' && chunk.length > 0) {
                currentMessageRef.current += chunk;
                upsertStreamingMessage(aiMessageId);
                continue;
              }

              if (data.type === 'done' || data.done === true || data.event === 'end') {
                if (typeof data.message === 'string') {
                  currentMessageRef.current = data.message;
                } else if (typeof data.answer === 'string') {
                  currentMessageRef.current = data.answer;
                } else if (data.message?.content) {
                  currentMessageRef.current = data.message.content;
                }
                finalizeStream(data.listings || data.metadata?.listings);
                continue;
              }

              if (Array.isArray(data.messages)) {
                const assistant = data.messages.find((m: any) => m.role === 'assistant');
                if (assistant?.content) {
                  currentMessageRef.current = assistant.content;
                  finalizeStream(data.listings || assistant.listings);
                  continue;
                }
              }
            } catch (parseError) {
              console.error('SSE parse hatası:', parseError, 'Line:', payloadLine);
              currentMessageRef.current += payloadLine;
              upsertStreamingMessage(aiMessageId);
            }
          }
        }

        return;
      }

      if (contentType.includes('application/json')) {
        const json = await response.json();
        const assistant = extractAssistantFromJson(json);
        if (assistant.text) {
          commitAssistantResponse(assistant.text, undefined, assistant.listings);
        }
        setIsTyping(false);
        if (mediaPaths.length > 0) {
          pendingMediaPathsRef.current = [];
        }
        return;
      }

      const fallbackText = await response.text();
      if (fallbackText) {
        commitAssistantResponse(fallbackText);
      }
      setIsTyping(false);
      if (mediaPaths.length > 0) {
        pendingMediaPathsRef.current = [];
      }
    } catch (err: any) {
      console.error('Agent bağlantı hatası:', err);

      let errorMessage = 'Bağlantı hatası. Lütfen tekrar deneyin.';

      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        errorMessage = 'n8n webhook adresine ulaşılamıyor. CORS veya network hatası olabilir.';
      } else if (err.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);
      setIsTyping(false);
      setIsConnecting(false);

      const errorAiMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: '⚠️ Üzgünüm, şu anda n8n webchat akışına bağlanamıyorum. Workflow\'un aktif olduğundan emin olduktan sonra tekrar deneyin.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorAiMessage]);
    }
  };

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: inputValue,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, newMessage]);
    const messageToSend = inputValue;
    setInputValue('');

    if (messageToSend.toLowerCase().trim().startsWith('iptal')) {
      pendingMediaPathsRef.current = [];
    }
    
    // Include any pending media from image uploads
    const mediaPaths = pendingMediaPathsRef.current || [];
    const resolvedUserId = customUser?.id || user?.id || localStorage.getItem('user_id') || getUserId();
    
    // Send to agent backend
    const options = mediaPaths.length > 0 ? { mediaPaths, mediaType: 'image' } : undefined;
    sendMessageToAgent(messageToSend, options);
  };

  const handleQuickAction = (action: string) => {
    const quickMessages: Record<string, string> = {
      'create': 'Yeni bir ilan oluşturmak istiyorum',
      'price': 'Ürünüm için fiyat önerisi alabilir miyim?',
      'improve': 'İlan metnini iyileştirmek istiyorum',
      'search': 'Tüm ilanları göster',
      'seller': 'Satıcı bulmak istiyorum',
      'help': 'Yardım almak istiyorum',
    };

    const message = quickMessages[action];
    if (message) {
      const newMessage: Message = {
        id: Date.now().toString(),
        type: 'user',
        content: message,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, newMessage]);
      sendMessageToAgent(message);
    }
  };

  const handleFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    // allow selecting the same file again
    e.target.value = '';

    if (files.length === 0) return;

    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    if (imageFiles.length === 0) {
      const errorMessage: Message = {
        id: Date.now().toString(),
        type: 'ai',
        content: '⚠️ Lütfen sadece fotoğraf yükleyin.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      return;
    }

    // LIMIT: Maximum 5 photos per upload (user-friendly limit)
    if (imageFiles.length > 5) {
      const errorMessage: Message = {
        id: Date.now().toString(),
        type: 'ai',
        content: `⚠️ Tek seferde en fazla 5 fotoğraf yükleyebilirsiniz. İlk 5 tanesi yüklenecek.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    }
    const limitedFiles = imageFiles.slice(0, 5);

    const run = async () => {
      const resolvedUserId = customUser?.id || user?.id || localStorage.getItem('user_id') || getUserId();
      const uploadedPaths: string[] = [];

      setIsTyping(true);
      try {
        for (const file of limitedFiles) {
          try {
            const fileSizeMB = file.size / (1024 * 1024);
            let uploadFile = file;
            if (fileSizeMB > 0.9) {
              uploadFile = await compressImage(file, 0.9);
            }

            const { storagePath, publicUrl } = await uploadImageToSupabase(uploadFile, resolvedUserId);
            uploadedPaths.push(storagePath);

            const uploadedMessage: Message = {
              id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
              type: 'user',
              content: `📷 ${file.name} yüklendi (${(uploadFile.size / (1024 * 1024)).toFixed(2)} MB)`,
              timestamp: new Date(),
            };
            setMessages((prev) => [...prev, uploadedMessage]);

            console.log('📸 Uploading image - storagePath:', storagePath, 'publicUrl:', publicUrl);
          } catch (uploadErr: any) {
            console.error('Upload error:', uploadErr);
            const errorMessage: Message = {
              id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
              type: 'ai',
              content: `⚠️ Görsel yüklenemedi: ${uploadErr?.message || 'Bilinmeyen hata'}`,
              timestamp: new Date(),
            };
            setMessages((prev) => [...prev, errorMessage]);
          }
        }
      } finally {
        setIsTyping(false);
      }

      const uniquePaths = dedupePaths(uploadedPaths);
      if (uniquePaths.length > 0) {
        // Show intent clarification instead of auto-processing
        const intentQuestion: Message = {
          id: `${Date.now()}_intent_q`,
          type: 'ai',
          content: `📸 ${uniquePaths.length} fotoğraf başarıyla yüklendi!\n\nBu ürün için ne yapmak istiyorsunuz?\n• 📝 İlan oluşturmak (satmak)\n• 🔍 Benzer ürünleri aramak`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, intentQuestion]);

        // Store image paths in pending for next user message
        pendingMediaPathsRef.current = uniquePaths;
      }
    };

    run();

    // Note: video support removed here; this input only accepts images
  };

  const toggleVoiceMode = () => {
    setVoiceMode(!voiceMode);
  };

  const handleVoiceTranscript = (text: string) => {
    // Add corrected voice text as user message
    const newMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: text,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, newMessage]);
    
    // Send to agent
    sendMessageToAgent(text);
  };

  // Removed: Speech is now triggered immediately in sendMessageToAgent

  const toggleRecording = () => {
    setIsRecording(!isRecording);
    if (!isRecording) {
      setTimeout(() => {
        setIsRecording(false);
        const newMessage: Message = {
          id: Date.now().toString(),
          type: 'user',
          content: '🎤 Sesli mesaj kaydedildi',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, newMessage]);
        
        // TODO: Implement voice message to agent backend
        setIsTyping(true);
        setTimeout(() => {
          const aiResponse: Message = {
            id: (Date.now() + 1).toString(),
            type: 'ai',
            content: 'Sesli mesaj özelliği yakında aktif olacak!',
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, aiResponse]);
          setIsTyping(false);
        }, 1500);
      }, 3000);
    }
  };

  const quickActions = [
    { id: 'create', icon: 'ri-add-circle-line', label: 'İlan Oluştur', color: 'from-purple-500 to-blue-500' },
    { id: 'search', icon: 'ri-search-line', label: 'İlan Ara', color: 'from-cyan-500 to-green-500' },
    { id: 'improve', icon: 'ri-edit-line', label: 'Metni İyileştir', color: 'from-orange-500 to-pink-500' },
  ];

  // Message grouping (WhatsApp style)
  const groupMessages = (messages: Message[]) => {
    const grouped: Message[][] = [];
    let currentGroup: Message[] = [];
    let lastType: 'user' | 'ai' | null = null;

    messages.forEach((msg, idx) => {
      const timeDiff = idx > 0 
        ? (new Date(msg.timestamp).getTime() - new Date(messages[idx - 1].timestamp).getTime()) / 1000 
        : 0;

      // Group if same type and within 60 seconds
      if (msg.type === lastType && timeDiff < 60) {
        currentGroup.push(msg);
      } else {
        if (currentGroup.length > 0) {
          grouped.push(currentGroup);
        }
        currentGroup = [msg];
        lastType = msg.type;
      }
    });

    if (currentGroup.length > 0) {
      grouped.push(currentGroup);
    }

    return grouped;
  };

  const renderListingCard = (listing: any) => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const imageUrls = listing.signed_images?.map((imagePath: string) => {
      if (imagePath.startsWith('http')) {
        return imagePath;
      }
      return `${supabaseUrl}/storage/v1/object/public/product-images/${imagePath}`;
    }) || [];

    const mainImage = imageUrls[0] || 'https://readdy.ai/api/search-image?query=product%20placeholder%20simple%20clean%20background&width=400&height=300&seq=placeholder&orientation=landscape';

    return (
      <motion.div
        key={listing.id}
        whileHover={{ scale: 1.02 }}
        onClick={() => setDetailListing(listing)}
        className={`listing-card ${listing.is_premium ? 'listing-card-premium' : ''}`}
      >
        <div className="flex items-start space-x-4">
          {/* Thumbnail with badges */}
          <div className="listing-card-image">
            <img
              src={mainImage}
              alt={listing.title}
              className="w-full h-full object-cover"
            />
            {/* Premium Badge */}
            {listing.is_premium && (
              <div className="listing-card-badge">
                <i className="ri-vip-crown-fill" />
                <span>PREMIUM</span>
              </div>
            )}
            {/* Photo count */}
            {imageUrls.length > 1 && (
              <div className="listing-card-photo-count">
                <i className="ri-image-line text-xs" />
                <span>{imageUrls.length}</span>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Title */}
            <h4 className="text-base font-bold text-gray-900 mb-1 line-clamp-2">
              {listing.title}
            </h4>
            
            {/* Price */}
            <div className="flex items-baseline space-x-2 mb-2">
              <span className="text-2xl font-extrabold text-purple-600">
                {listing.price?.toLocaleString('tr-TR')} ₺
              </span>
            </div>

            {/* Meta tags */}
            <div className="flex flex-wrap gap-2 mb-2">
              {listing.category && (
                <span className="inline-flex items-center px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
                  <i className="ri-price-tag-3-fill mr-1 text-xs" />
                  {listing.category}
                </span>
              )}
              
              {listing.condition && (
                <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${
                  listing.condition === 'new' 
                    ? 'bg-green-100 text-green-700'
                    : listing.condition === 'used'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-700'
                }`}>
                  {listing.condition === 'new' ? 'Sıfır' : listing.condition === 'used' ? '2. El' : 'Yenilenmiş'}
                </span>
              )}

              {listing.location && (
                <span className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-full">
                  <i className="ri-map-pin-line mr-1 text-xs" />
                  {listing.location}
                </span>
              )}
            </div>

            {/* View count & timestamp */}
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span className="flex items-center space-x-1">
                <i className="ri-eye-line" />
                <span>{listing.view_count || 0} görüntülenme</span>
              </span>
              {listing.created_at && (
                <span>{formatDistanceToNow(new Date(listing.created_at), { locale: tr, addSuffix: true })}</span>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  // Inline detail modal
  const renderListingDetailModal = () => {
    if (!detailListing) return null;

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const imageUrls = detailListing.signed_images?.map((imagePath: string) => {
      if (imagePath.startsWith('http')) {
        return imagePath;
      }
      return `${supabaseUrl}/storage/v1/object/public/product-images/${imagePath}`;
    }) || [];

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="modal-overlay"
        onClick={() => setDetailListing(null)}
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          className="modal-content"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Image Carousel */}
          {imageUrls.length > 0 && (
            <div className="relative h-80 bg-gray-900">
              <Swiper
                pagination={{ clickable: true }}
                navigation
                modules={[Pagination, Navigation]}
                className="h-full"
              >
                {imageUrls.map((img: string, idx: number) => (
                  <SwiperSlide key={idx}>
                    <img src={img} alt={`${detailListing.title} - ${idx + 1}`} className="w-full h-80 object-contain" />
                  </SwiperSlide>
                ))}
              </Swiper>
              
              <button
                onClick={() => setDetailListing(null)}
                className="absolute top-4 right-4 z-10 w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-white/30 transition-colors"
                aria-label="Modal'ı kapat"
                title="Kapat"
              >
                <i className="ri-close-line text-2xl" />
              </button>
            </div>
          )}

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Title & Price */}
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {detailListing.title}
              </h2>
              <div className="flex items-baseline space-x-2">
                <span className="text-4xl font-extrabold text-purple-600">
                  {detailListing.price?.toLocaleString('tr-TR')} ₺
                </span>
              </div>
            </div>

            {/* Description */}
            {detailListing.description && (
              <div className="bg-gray-50 rounded-xl p-4">
                <h3 className="font-semibold text-gray-900 mb-2">Açıklama</h3>
                <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {detailListing.description}
                </p>
              </div>
            )}

            {/* Metadata */}
            {detailListing.metadata && Object.keys(detailListing.metadata).length > 0 && (
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(detailListing.metadata).map(([key, value]) => (
                  <div key={key} className="bg-purple-50 rounded-lg p-3">
                    <span className="text-xs text-purple-600 font-medium uppercase">{key}</span>
                    <p className="text-gray-900 font-semibold mt-1">{String(value)}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="flex space-x-3">
              <button 
                onClick={() => {
                  navigate(`/listing/${detailListing.id}`);
                  setDetailListing(null);
                  setIsOpen(false);
                }}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 rounded-xl flex items-center justify-center space-x-2 transition-colors"
              >
                <i className="ri-external-link-line text-xl" />
                <span>Detayları Gör</span>
              </button>
              <button 
                className="w-12 h-12 bg-pink-100 hover:bg-pink-200 text-pink-600 rounded-xl flex items-center justify-center transition-colors"
                aria-label="Favorilere ekle"
                title="Favorilere Ekle"
              >
                <i className="ri-heart-line text-xl" />
              </button>
              <button 
                className="w-12 h-12 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-xl flex items-center justify-center transition-colors"
                aria-label="İlanı paylaş"
                title="Paylaş"
              >
                <i className="ri-share-line text-xl" />
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    );
  };

  const renderListingCards = (listings: any[]) => {
    return (
      <div className="space-y-3 mt-2">
        {listings.slice(0, displayCount).map((listing) => renderListingCard(listing))}

        {/* Daha Fazla Göster Butonu */}
        {listings.length > displayCount && (
          <button
            onClick={() => setDisplayCount(prev => prev + 3)}
            className="w-full py-2 text-sm text-purple-600 hover:text-purple-700 font-medium transition-colors"
          >
            Daha fazla göster ({listings.length - displayCount} ilan daha)
          </button>
        )}
      </div>
    );
  };

  const renderMessage = (msg: Message) => {
    const isUser = msg.role === 'user';
    
    // Parse listings from message
    let listings: any[] = [];
    let cleanContent = msg.content;
    
    const cacheMatch = msg.content.match(/\[SEARCH_CACHE\]({.*})/s);
    if (cacheMatch) {
      try {
        const cacheData = JSON.parse(cacheMatch[1]);
        listings = cacheData.results || [];
        cleanContent = msg.content.replace(/\[SEARCH_CACHE\]({.*})/s, '').trim();
      } catch (e) {
        console.error('Failed to parse listings:', e);
      }
    }

    return (
      <div
        key={msg.id}
        className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}
      >
        <div className={`flex items-start space-x-2 max-w-[85%] ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
            isUser ? 'bg-purple-600' : 'bg-gray-200'
          }`}>
            <i className={`${isUser ? 'ri-user-line text-white' : 'ri-robot-line text-gray-600'}`}></i>
          </div>
          <div className="flex flex-col space-y-2 flex-1 min-w-0">
            <div
              className={`px-4 py-3 rounded-2xl break-words whitespace-pre-wrap ${
                isUser
                  ? 'bg-purple-600 text-white rounded-tr-none'
                  : 'bg-gray-100 text-gray-900 rounded-tl-none'
              }`}
            >
              {cleanContent}
            </div>
            
            {/* Render Listings */}
            {listings.length > 0 && (
              <div className="space-y-2">
                {listings.slice(0, 3).map((listing) => renderListingCard(listing))}
                {listings.length > 3 && (
                  <button
                    onClick={() => navigate('/listings')}
                    className="w-full py-2 text-sm text-purple-600 hover:text-purple-700 font-medium transition-colors"
                  >
                    Tüm İlanları Gör ({listings.length} ilan)
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* FAB Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 w-16 h-16 bg-gradient-primary rounded-full shadow-2xl flex items-center justify-center z-50 hover:scale-110 transition-transform animate-pulse-slow cursor-pointer"
          >
            <i className="ri-chat-ai-line text-3xl text-white" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Modal */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 w-[440px] h-[700px] bg-white rounded-3xl shadow-2xl z-50 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="bg-gradient-primary p-4 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                  <i className="ri-robot-2-fill text-2xl text-white" />
                </div>
                <div>
                  <div className="text-white font-semibold">PazarAI Asistan</div>
                  <div className="flex items-center space-x-1 text-white/80 text-xs">
                    <div className={`w-2 h-2 rounded-full ${isConnecting ? 'bg-yellow-400' : 'bg-green-400'} animate-pulse`} />
                    <span>{isConnecting ? 'Bağlanıyor...' : 'Çevrimiçi'}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {/* Voice Selector - Shows when voice mode is enabled */}
                {voiceMode && (
                  <VoiceSelector
                    selectedVoice={selectedVoice}
                    onVoiceSelect={setSelectedVoice}
                  />
                )}
                
                <button
                  onClick={toggleVoiceMode}
                  title={voiceMode ? "Sesli Modu Kapat" : "Sesli Modu Aç"}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                    voiceMode ? 'bg-white/30 text-white' : 'hover:bg-white/20 text-white/80'
                  }`}
                >
                  <i className={`${voiceMode ? 'ri-volume-up-fill' : 'ri-volume-mute-line'} text-xl`} />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  title="Küçült"
                  className="w-8 h-8 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors cursor-pointer"
                >
                  <i className="ri-subtract-line text-white text-xl" />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  title="Kapat"
                  className="w-8 h-8 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors cursor-pointer"
                >
                  <i className="ri-close-line text-white text-xl" />
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 bg-gray-50">
              {[
                { id: 'general', label: 'Genel Sohbet' },
                { id: 'listing', label: 'İlan Asistanı' },
                { id: 'support', label: 'Destek' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as Tab)}
                  className={`flex-1 py-3 text-sm font-medium transition-colors relative whitespace-nowrap cursor-pointer ${
                    activeTab === tab.id ? 'text-purple-600' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {tab.label}
                  {activeTab === tab.id && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-primary"
                    />
                  )}
                </button>
              ))}
            </div>

            {/* Error Banner */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-50 border-b border-red-200 px-4 py-2 flex items-center justify-between"
              >
                <div className="flex items-center space-x-2">
                  <i className="ri-error-warning-line text-red-500" />
                  <span className="text-sm text-red-700">{error}</span>
                </div>
                <button
                  onClick={() => setError(null)}
                  className="text-red-500 hover:text-red-700 cursor-pointer"
                  aria-label="Hatayı kapat"
                >
                  <i className="ri-close-line" />
                </button>
              </motion.div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
              {groupMessages(messages).map((group, groupIdx) => {
                const isUser = group[0].type === 'user';
                return (
                  <motion.div
                    key={`group-${groupIdx}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className="flex space-x-2 max-w-[85%]">
                      {/* Avatar - Show only for first message in group */}
                      {!isUser && (
                        <div className="w-8 h-8 rounded-full bg-gradient-primary flex items-center justify-center flex-shrink-0 self-start">
                          <i className="ri-robot-2-fill text-white text-lg" />
                        </div>
                      )}
                      
                      <div className="space-y-1 flex-1">
                        {group.map((message, msgIdx) => {
                          // Parse listings from message content
                          let listings: any[] = [];
                          let cleanContent = message.content;
                          
                          const cacheMatch = message.content.match(/\[SEARCH_CACHE\]({.*})/s);
                          if (cacheMatch) {
                            try {
                              const cacheData = JSON.parse(cacheMatch[1]);
                              listings = cacheData.results || [];
                              cleanContent = message.content.replace(/\[SEARCH_CACHE\]({.*})/s, '').trim();
                            } catch (e) {
                              console.error('Failed to parse listings:', e);
                            }
                          }

                          return (
                            <div key={message.id} className="space-y-2">
                              <div
                                className={`message-bubble rounded-2xl px-4 py-3 ${
                                  isUser
                                    ? 'message-user bg-gradient-primary text-white'
                                    : 'message-ai bg-white text-gray-800 shadow-md'
                                }`}
                              >
                                {isUser ? (
                                  <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                                    {cleanContent.replace(/\n{3,}/g, '\n\n').trim()}
                                  </p>
                                ) : (
                                  <ReactMarkdown
                                    className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5"
                                    components={{
                                      code({ node, inline, className, children, ...props }) {
                                        return inline ? (
                                          <code className="bg-purple-50 text-purple-700 px-1 py-0.5 rounded text-xs font-mono" {...props}>
                                            {children}
                                          </code>
                                        ) : (
                                          <code className="block bg-gray-900 text-gray-100 p-3 rounded-lg text-xs font-mono overflow-x-auto" {...props}>
                                            {children}
                                          </code>
                                        );
                                      },
                                      a({ node, href, children, ...props }) {
                                        return (
                                          <a href={href} target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline" {...props}>
                                            {children}
                                          </a>
                                        );
                                      },
                                      img({ node, src, alt, ...props }) {
                                        return (
                                          <div className="my-2">
                                            <img src={src || ''} alt={alt || ''} className="rounded-lg max-h-64 w-full object-cover" {...props} />
                                          </div>
                                        );
                                      },
                                    }}
                                  >
                                    {cleanContent.replace(/\n{3,}/g, '\n\n').trim()}
                                  </ReactMarkdown>
                                )}
                              </div>

                              {/* Listing Cards */}
                              {listings.length > 0 && renderListingCards(listings)}
                            
                              {/* Timestamp - Show only on last message of group */}
                              {msgIdx === group.length - 1 && (
                                <div className={`text-xs text-gray-400 px-2 ${isUser ? 'text-right' : 'text-left'}`}>
                                  {formatDistanceToNow(new Date(message.timestamp), { locale: tr, addSuffix: true })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Avatar for user - Show on right */}
                      {isUser && (
                        <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0 self-start">
                          <i className="ri-user-line text-white text-lg" />
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}

              {isTyping && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex justify-start"
                >
                  <div className="bg-white rounded-2xl px-4 py-3 shadow-md">
                    <div className="flex space-x-2">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:200ms]" />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:400ms]" />
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Quick Actions */}
              {activeTab === 'listing' && messages.length <= 2 && !isTyping && (
                <div className="space-y-2 pt-4">
                  <p className="text-xs text-gray-500 text-center mb-3">Hızlı İşlemler</p>
                  {quickActions.map((action, index) => (
                    <motion.button
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      onClick={() => handleQuickAction(action.id)}
                      className={`w-full py-3 px-4 bg-gradient-to-r ${action.color} text-white rounded-xl hover:shadow-lg transition-all flex items-center space-x-3 whitespace-nowrap cursor-pointer`}
                    >
                      <i className={`${action.icon} text-xl`} />
                      <span className="text-sm font-medium">{action.label}</span>
                    </motion.button>
                  ))}
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white border-t border-gray-200">
              {isRecording && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-3 flex items-center justify-center space-x-3 py-2"
                >
                  <div className="flex space-x-1">
                    {[...Array(5)].map((_, i) => (
                      <motion.div
                        key={i}
                        className="w-1 bg-red-500 rounded-full"
                        animate={{ height: [8, 24, 8] }}
                        transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.1 }}
                      />
                    ))}
                  </div>
                  <span className="text-sm text-red-500 font-medium">Kaydediliyor...</span>
                </motion.div>
              )}

              <div className="flex items-center space-x-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  multiple
                  className="hidden"
                  aria-label="Fotoğraf seç"
                />
                <button
                  onClick={handleFileUpload}
                  disabled={isTyping}
                  className="w-10 h-10 flex items-center justify-center text-gray-600 hover:bg-gray-100 rounded-full transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Fotoğraf yükle"
                >
                  <i className="ri-attachment-line text-xl" />
                </button>

                <textarea
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder={voiceMode ? "🎤 Sesli mod aktif - Mikrofona konuşun veya yazın" : "Mesajınızı yazın..."}
                  disabled={isTyping}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-full resize-none focus:outline-none focus:border-purple-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  rows={1}
                />

                {/* Voice Chat Button (when voice mode active) */}
                {voiceMode && (
                  <div className="relative">
                    <VoiceChat
                      onTranscriptReady={handleVoiceTranscript}
                      isEnabled={voiceMode}
                      selectedVoice={selectedVoice}
                    />
                  </div>
                )}
                
                <button
                  onClick={handleSendMessage}
                  disabled={!inputValue.trim() || isTyping}
                  title="Gönder"
                  className="w-10 h-10 bg-gradient-primary text-white rounded-full flex items-center justify-center hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <i className="ri-send-plane-fill text-lg" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Inline Detail Modal */}
      <AnimatePresence>
        {detailListing && renderListingDetailModal()}
      </AnimatePresence>
    </>
  );
}


