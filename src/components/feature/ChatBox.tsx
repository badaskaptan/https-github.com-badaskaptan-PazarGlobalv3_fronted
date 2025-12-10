import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import VoiceChat from './VoiceChat';

type Message = {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
  listings?: any[]; // İlan bilgileri için
};

type Tab = 'general' | 'listing' | 'support';

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
  const [voiceMode, setVoiceMode] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentMessageRef = useRef<string>('');
  const conversationHistory = useRef<Array<{ role: string; content: string }>>([]);

  const AGENT_BACKEND_URL = 'https://pazarglobal-agent-backend-production-4ec8.up.railway.app';

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Try to hydrate auth context so agent backend can map the visitor to a real account
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const handleListingClick = (listingId: string) => {
    navigate(`/listing/${listingId}`);
    setIsOpen(false);
  };

  const sendMessageToAgent = async (message: string) => {
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

    // Add user message to conversation history
    conversationHistory.current.push({
      role: 'user',
      content: message
    });

    try {
      const response = await fetch(`${AGENT_BACKEND_URL}/web-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          user_id: resolvedUserId,
          conversation_history: conversationHistory.current,
          user_context: userContext,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Backend error response:', errorText);
        throw new Error(`Backend hatası (${response.status}): ${errorText || 'Bilinmeyen hata'}`);
      }

      setIsConnecting(false);

      // Check if response is SSE
      const contentType = response.headers.get('content-type');
      if (!contentType?.includes('text/event-stream')) {
        console.error('Invalid content type:', contentType);
        throw new Error('Backend yanlış format döndü. SSE bekleniyor.');
      }

      // Read SSE stream
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('Response body okunamıyor');
      }

      let aiMessageId = Date.now().toString();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          // Parse listings from final message
          const { cleanContent, listings } = parseListings(currentMessageRef.current);
          
          // Add AI response to conversation history
          if (cleanContent) {
            conversationHistory.current.push({
              role: 'assistant',
              content: cleanContent
            });
          }

          // Update message with parsed data
          setMessages((prev) => {
            const updated = [...prev];
            const index = updated.findIndex(m => m.id === aiMessageId);
            if (index >= 0) {
              updated[index] = {
                ...updated[index],
                content: cleanContent,
                listings: listings.length > 0 ? listings : undefined,
              };
            }
            return updated;
          });

          setIsTyping(false);
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'text' && data.content) {
                currentMessageRef.current += data.content;
                
                // Update or create AI message
                setMessages((prev) => {
                  const existingIndex = prev.findIndex(m => m.id === aiMessageId);
                  if (existingIndex >= 0) {
                    const updated = [...prev];
                    updated[existingIndex] = {
                      ...updated[existingIndex],
                      content: currentMessageRef.current,
                    };
                    return updated;
                  } else {
                    return [
                      ...prev,
                      {
                        id: aiMessageId,
                        type: 'ai',
                        content: currentMessageRef.current,
                        timestamp: new Date(),
                      },
                    ];
                  }
                });
              } else if (data.type === 'done') {
                // Streaming complete
                setIsTyping(false);
              } else if (data.type === 'error') {
                throw new Error(data.content || 'Backend hatası oluştu');
              }
            } catch (parseError) {
              console.error('SSE parse hatası:', parseError, 'Line:', line);
            }
          }
        }
      }
    } catch (err: any) {
      console.error('Agent bağlantı hatası:', err);
      
      // Determine error type and message
      let errorMessage = 'Bağlantı hatası. Lütfen tekrar deneyin.';
      
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        errorMessage = 'Backend\'e ulaşılamıyor. CORS veya network hatası olabilir.';
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      setIsTyping(false);
      setIsConnecting(false);
      
      // Add error message
      const errorAiMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: '⚠️ Üzgünüm, şu anda bağlantı kuramıyorum. Backend servisi çalışıyor mu kontrol edin. Lütfen daha sonra tekrar deneyin.',
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
    
    // Send to agent backend
    sendMessageToAgent(messageToSend);
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
    const file = e.target.files?.[0];
    if (file) {
      const fileSizeMB = file.size / (1024 * 1024);

      // Dosya tipi kontrolü
      if (file.type.startsWith('image/')) {
        // Resim sıkıştırma
        if (fileSizeMB > 0.9) {
          setIsTyping(true);
          const userMessage: Message = {
            id: Date.now().toString(),
            type: 'user',
            content: `📷 ${file.name} işleniyor...`,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, userMessage]);

          compressImage(file, 0.9)
            .then((compressedFile) => {
              const compressedSizeMB = (compressedFile.size / (1024 * 1024)).toFixed(2);
              const updatedMessage: Message = {
                id: Date.now().toString(),
                type: 'user',
                content: `📷 ${file.name} yüklendi (${compressedSizeMB} MB)`,
                timestamp: new Date(),
              };
              setMessages((prev) => {
                const filtered = prev.filter(m => m.id !== userMessage.id);
                return [...filtered, updatedMessage];
              });

              // TODO: Implement file upload to agent backend with compressed file
              setTimeout(() => {
                const aiResponse: Message = {
                  id: (Date.now() + 1).toString(),
                  type: 'ai',
                  content: 'Resim başarıyla sıkıştırıldı! Dosya yükleme özelliği yakında aktif olacak.',
                  timestamp: new Date(),
                };
                setMessages((prev) => [...prev, aiResponse]);
                setIsTyping(false);
              }, 1500);
            })
            .catch((error) => {
              console.error('Resim sıkıştırma hatası:', error);
              const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                type: 'ai',
                content: '⚠️ Resim işlenirken bir hata oluştu. Lütfen tekrar deneyin.',
                timestamp: new Date(),
              };
              setMessages((prev) => [...prev, errorMessage]);
              setIsTyping(false);
            });
        } else {
          const newMessage: Message = {
            id: Date.now().toString(),
            type: 'user',
            content: `📷 ${file.name} yüklendi (${fileSizeMB.toFixed(2)} MB)`,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, newMessage]);

          // TODO: Implement file upload to agent backend
          setIsTyping(true);
          setTimeout(() => {
            const aiResponse: Message = {
              id: (Date.now() + 1).toString(),
              type: 'ai',
              content: 'Dosya yükleme özelliği yakında aktif olacak!',
              timestamp: new Date(),
            };
            setMessages((prev) => [...prev, aiResponse]);
            setIsTyping(false);
          }, 1500);
        }
      } else if (file.type.startsWith('video/')) {
        // Video boyut kontrolü (max 5 MB)
        if (fileSizeMB > 5) {
          const errorMessage: Message = {
            id: Date.now().toString(),
            type: 'ai',
            content: `⚠️ ${file.name} çok büyük! Videolar maksimum 5 MB olmalıdır. (Mevcut: ${fileSizeMB.toFixed(2)} MB)`,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, errorMessage]);
          return;
        }

        const newMessage: Message = {
          id: Date.now().toString(),
          type: 'user',
          content: `🎥 ${file.name} yüklendi (${fileSizeMB.toFixed(2)} MB)`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, newMessage]);

        // TODO: Implement video upload to agent backend
        setIsTyping(true);
        setTimeout(() => {
          const aiResponse: Message = {
            id: (Date.now() + 1).toString(),
            type: 'ai',
            content: 'Video yükleme özelliği yakında aktif olacak!',
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, aiResponse]);
          setIsTyping(false);
        }, 1500);
      } else {
        const errorMessage: Message = {
          id: Date.now().toString(),
          type: 'ai',
          content: '⚠️ Sadece resim ve video dosyaları yükleyebilirsiniz.',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      }
    }
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

  const handleAgentResponse = (responseText: string) => {
    console.log('🎤 Voice mode:', voiceMode);
    console.log('🎤 speakResponse available:', !!(window as any).speakResponse);
    console.log('🎤 Response text:', responseText);
    
    // Speak agent response using VoiceChat component
    if (voiceMode && (window as any).speakResponse) {
      console.log('✅ Calling speakResponse...');
      (window as any).speakResponse(responseText);
    } else {
      console.log('❌ Cannot speak:', { voiceMode, hasFunction: !!(window as any).speakResponse });
    }
  };

  // Update when new AI message arrives in voice mode
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.type === 'ai' && voiceMode) {
        console.log('📨 New AI message in voice mode, triggering speech...');
        handleAgentResponse(lastMessage.content);
      }
    }
  }, [messages, voiceMode]);

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

  const renderListingCard = (listing: any) => {
    const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL;
    const imageUrls = listing.signed_images?.map((imagePath: string) => {
      if (imagePath.startsWith('http')) {
        return imagePath;
      }
      return `${supabaseUrl}/storage/v1/object/public/product-images/${imagePath}`;
    }) || [];

    const mainImage = imageUrls[0] || 'https://readdy.ai/api/search-image?query=product%20placeholder%20simple%20clean%20background&width=400&height=300&seq=placeholder&orientation=landscape';

    return (
      <div
        key={listing.id}
        onClick={() => handleListingClick(listing.id)}
        className="bg-white rounded-lg p-3 shadow-sm hover:shadow-md transition-all cursor-pointer border border-gray-100"
      >
        <div className="flex items-start space-x-3">
          {/* Ana Resim */}
          <div className="w-24 h-24 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
            <img
              src={mainImage}
              alt={listing.title}
              className="w-full h-full object-cover"
            />
          </div>

          {/* İlan Bilgileri */}
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-gray-900 mb-1 truncate">
              {listing.title}
            </h4>
            <div className="flex items-center justify-between mb-2">
              <span className="text-lg font-bold text-purple-600">
                {listing.price?.toLocaleString('tr-TR')} ₺
              </span>
            </div>
            <div className="flex items-center text-xs text-gray-500 mb-2">
              <i className="ri-map-pin-line mr-1" />
              {listing.location}
            </div>
            {listing.category && (
              <span className="inline-block px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">
                {listing.category}
              </span>
            )}
          </div>
        </div>

        {/* Resim Galerisi */}
        {imageUrls.length > 1 && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="flex space-x-2 overflow-x-auto">
              {imageUrls.slice(0, 3).map((img: string, idx: number) => (
                <a
                  key={idx}
                  href={img}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="w-16 h-16 flex-shrink-0 rounded-md overflow-hidden bg-gray-100 hover:ring-2 hover:ring-purple-500 transition-all"
                >
                  <img
                    src={img}
                    alt={`${listing.title} - ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                </a>
              ))}
              {imageUrls.length > 3 && (
                <div className="w-16 h-16 flex-shrink-0 rounded-md bg-gray-100 flex items-center justify-center text-xs text-gray-600 font-medium">
                  +{imageUrls.length - 3}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
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
                >
                  <i className="ri-close-line" />
                </button>
              </motion.div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className="max-w-[85%] space-y-2">
                    <div
                      className={`rounded-2xl px-4 py-3 ${
                        message.type === 'user'
                          ? 'bg-gradient-primary text-white'
                          : 'bg-white text-gray-800 shadow-md'
                      }`}
                    >
                      <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{message.content}</p>
                    </div>

                    {/* Listing Cards */}
                    {message.listings && message.listings.length > 0 && renderListingCards(message.listings)}
                  </div>
                </motion.div>
              ))}

              {isTyping && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex justify-start"
                >
                  <div className="bg-white rounded-2xl px-4 py-3 shadow-md">
                    <div className="flex space-x-2">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
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
                  className="hidden"
                />
                <button
                  onClick={handleFileUpload}
                  disabled={isTyping}
                  className="w-10 h-10 flex items-center justify-center text-gray-600 hover:bg-gray-100 rounded-full transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
    </>
  );
}
