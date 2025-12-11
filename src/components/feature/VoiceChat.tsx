import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface VoiceChatProps {
  onTranscriptReady: (text: string) => void;
  onResponseReceived?: (text: string) => void;
  isEnabled?: boolean;
  selectedVoice?: SpeechSynthesisVoice | null;
}

export default function VoiceChat({
  onTranscriptReady,
  onResponseReceived,
  isEnabled = true,
  selectedVoice: externalSelectedVoice = null
}: VoiceChatProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [correctedText, setCorrectedText] = useState('');
  const [isCorrecting, setIsCorrecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [internalSelectedVoice, setInternalSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
  
  // Use external voice if provided, otherwise use internal
  const selectedVoice = externalSelectedVoice || internalSelectedVoice;

  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);

  useEffect(() => {
    // Initialize Speech Recognition
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.lang = 'tr-TR';
      recognitionRef.current.continuous = true;  // Keep listening for longer
      recognitionRef.current.interimResults = true;  // Show partial results

      recognitionRef.current.onresult = async (event: any) => {
        // Get final transcript (when user stops speaking)
        let finalTranscript = '';
        for (let i = 0; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        
        if (finalTranscript) {
          setTranscript(finalTranscript);
          // Quick brand correction (frontend only - no backend call)
          const corrected = correctBrandNames(finalTranscript);
          setCorrectedText(corrected);
          onTranscriptReady(corrected);
          // Auto-stop after getting final result
          stopListening();
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setError(`Ses tanıma hatası: ${event.error}`);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    } else {
      setError('Tarayıcınız ses tanımayı desteklemiyor. Chrome veya Edge kullanın.');
    }

    // Initialize Speech Synthesis
    synthRef.current = window.speechSynthesis;
    
    // Auto-select default voice if not provided externally
    if (!externalSelectedVoice) {
      const loadDefaultVoice = () => {
        const availableVoices = synthRef.current?.getVoices() || [];
        const turkishVoices = availableVoices.filter(v => v.lang.startsWith('tr'));
        if (turkishVoices.length > 0 && !internalSelectedVoice) {
          setInternalSelectedVoice(turkishVoices[0]);
          console.log('🎤 Default voice selected:', turkishVoices[0].name);
        }
      };
      loadDefaultVoice();
      setTimeout(loadDefaultVoice, 100);
      if (synthRef.current) {
        synthRef.current.onvoiceschanged = loadDefaultVoice;
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, [selectedVoice]);

  const startListening = () => {
    if (!isEnabled) return;
    
    setError(null);
    setTranscript('');
    setCorrectedText('');
    
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.error('Failed to start recognition:', err);
        setError('Mikrofon başlatılamadı. İzin verdiğinizden emin olun.');
      }
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  };

  const correctBrandNames = (text: string): string => {
    // Fast brand name correction (no backend call needed)
    const brandMap: Record<string, string> = {
      // Otomotiv
      'sitroen': 'Citroen', 'citron': 'Citroen', 'stroen': 'Citroen',
      'reno': 'Renault', 'porşe': 'Porsche', 'mersedes': 'Mercedes',
      'bımvı': 'BMW', 'foksvagen': 'Volkswagen', 'toyta': 'Toyota',
      'pejo': 'Peugeot', 'hundai': 'Hyundai',
      // Elektronik
      'ayfon': 'iPhone', 'aypad': 'iPad', 'samsıng': 'Samsung',
      'huavey': 'Huawei', 'şiyomi': 'Xiaomi',
      // Parfüm
      'kelvin klein': 'Calvin Klein', 'calvin klein': 'Calvin Klein',
      'selin dion': 'Celine Dion', 'selin diyor': 'Celine Dior',
      'poison': 'Poison', 'poyzın': 'Poison',
      'diyor': 'Dior', 'şanel': 'Chanel', 'lanköm': 'Lancôme',
      'gucci': 'Gucci', 'versaçe': 'Versace', 'hugo boss': 'Hugo Boss',
      'lakost': 'Lacoste', 'lakos': 'Lacoste', 'lagos': 'Lacoste'
    };

    let corrected = text;
    for (const [wrong, correct] of Object.entries(brandMap)) {
      const regex = new RegExp(`\\b${wrong}\\b`, 'gi');
      corrected = corrected.replace(regex, correct);
    }
    
    return corrected;
  };

  const speak = useCallback((text: string) => {
    if (!synthRef.current || !isEnabled) return;

    // Clean text for voice (remove emojis, URLs, and technical content)
    let cleanText = text;
    
    // Format Turkish phone numbers for voice (multiple formats)
    // +905412879705 → "sıfır beş dört bir, iki sekiz yedi, doksan yedi sıfır beş"
    cleanText = cleanText.replace(/\+90(\d{3})(\d{3})(\d{4})/g, (match, p1, p2, p3) => {
      const digits = ['sıfır', 'bir', 'iki', 'üç', 'dört', 'beş', 'altı', 'yedi', 'sekiz', 'dokuz'];
      const part1 = p1.split('').map(d => digits[parseInt(d)]).join(' ');
      const part2 = p2.split('').map(d => digits[parseInt(d)]).join(' ');
      const part3 = p3.split('').map(d => digits[parseInt(d)]).join(' ');
      return `${part1}, ${part2}, ${part3}`;
    });
    
    // Also format phone without +90
    cleanText = cleanText.replace(/\b0(\d{3})(\d{3})(\d{4})\b/g, (match, p1, p2, p3) => {
      const digits = ['sıfır', 'bir', 'iki', 'üç', 'dört', 'beş', 'altı', 'yedi', 'sekiz', 'dokuz'];
      const part1 = p1.split('').map(d => digits[parseInt(d)]).join(' ');
      const part2 = p2.split('').map(d => digits[parseInt(d)]).join(' ');
      const part3 = p3.split('').map(d => digits[parseInt(d)]).join(' ');
      return `${part1}, ${part2}, ${part3}`;
    });
    
    cleanText = cleanText
      // Remove only URL lines (not following text)
      .replace(/^https?:\/\/[^\s]+$/gm, '')
      // Remove "Fotoğraflar:" label only, keep following text
      .replace(/Fotoğraflar:\s*/g, '')
      // Remove remaining inline URLs
      .replace(/https?:\/\/[^\s]+/g, '')
      // Remove emojis
      .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
      .replace(/[\u{2600}-\u{27BF}]/gu, '')
      .replace(/[\u{FE0F}\u{200D}]/gu, '')
      // Remove number emojis (1️⃣, 2️⃣, etc.)
      .replace(/[\u{0030}-\u{0039}\u{FE0F}\u{20E3}]/gu, '')
      // Simplify repeated listing titles in cards
      .replace(/^"([^"]+)"\s*$/gm, '')
      // Clean up multiple spaces and newlines
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanText) return;

    // Cancel any ongoing speech immediately
    synthRef.current.cancel();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'tr-TR';
    utterance.rate = 1.1;  // Slightly faster for responsiveness
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    
    // Apply selected voice (pre-loaded)
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = (e) => {
      console.error('🔊 Speech error:', e);
      setIsSpeaking(false);
    };

    // Speak immediately without delay
    synthRef.current.speak(utterance);
  }, [isEnabled, selectedVoice]);

  const stopSpeaking = () => {
    if (synthRef.current) {
      synthRef.current.cancel();
      setIsSpeaking(false);
    }
  };

  // Expose speak function to parent (always expose when enabled)
  useEffect(() => {
    if (isEnabled) {
      console.log('✅ VoiceChat: Exposing speak function');
      (window as any).speakResponse = speak;
    }
    return () => {
      console.log('🗑️ VoiceChat: Cleaning up speak function');
      delete (window as any).speakResponse;
    };
  }, [isEnabled, speak]);

  return (
    <div className="voice-chat-container relative flex items-center gap-2">
      {/* Microphone Button */}
      <motion.button
        onClick={isListening ? stopListening : startListening}
        disabled={!isEnabled || isCorrecting}
        title={isListening ? "Dinlemeyi Durdur" : "Konuşmaya Başla"}
        className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-all ${
          isListening
            ? 'bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/50'
            : 'bg-gradient-to-r from-purple-500 to-cyan-500 hover:shadow-lg hover:shadow-purple-500/50'
        } ${!isEnabled || isCorrecting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        whileHover={{ scale: isEnabled && !isCorrecting ? 1.05 : 1 }}
        whileTap={{ scale: isEnabled && !isCorrecting ? 0.95 : 1 }}
        animate={isListening ? { scale: [1, 1.1, 1] } : {}}
        transition={isListening ? { repeat: Infinity, duration: 1.5 } : {}}
      >
        <i className={`${isListening ? 'ri-stop-circle-line' : 'ri-mic-line'} text-xl text-white`} />
        
        {isListening && (
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-red-300"
            animate={{ scale: [1, 1.5], opacity: [1, 0] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
          />
        )}
      </motion.button>

      {/* Status Indicators */}
      <AnimatePresence>
        {(transcript || correctedText || error || isCorrecting) && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute bottom-14 right-0 max-w-xs bg-white rounded-2xl shadow-2xl p-4 space-y-2 z-50"
          >
            {error && (
              <div className="text-sm text-red-600 flex items-start gap-2">
                <i className="ri-error-warning-line text-lg mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {isCorrecting && (
              <div className="text-sm text-gray-600 flex items-center gap-2">
                <i className="ri-loader-4-line text-lg animate-spin" />
                <span>Metin düzeltiliyor...</span>
              </div>
            )}

            {transcript && !isCorrecting && (
              <div className="space-y-1">
                <div className="text-xs text-gray-500 font-medium">Ham Metin:</div>
                <div className="text-sm text-gray-700 italic">{transcript}</div>
              </div>
            )}

            {correctedText && !isCorrecting && (
              <div className="space-y-1">
                <div className="text-xs text-green-600 font-medium flex items-center gap-1">
                  <i className="ri-check-line" />
                  Düzeltilmiş:
                </div>
                <div className="text-sm text-gray-900 font-medium">{correctedText}</div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Speaker Control (when AI is speaking) */}
      <AnimatePresence>
        {isSpeaking && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={stopSpeaking}
            title="Konuşmayı Durdur"
            className="absolute bottom-14 right-0 w-10 h-10 bg-orange-500 hover:bg-orange-600 rounded-full flex items-center justify-center shadow-lg cursor-pointer z-50"
          >
            <i className="ri-volume-up-line text-lg text-white animate-pulse" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
