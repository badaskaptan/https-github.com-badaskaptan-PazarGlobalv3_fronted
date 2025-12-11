import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface VoiceSelectorProps {
  selectedVoice: SpeechSynthesisVoice | null;
  onVoiceSelect: (voice: SpeechSynthesisVoice) => void;
}

export default function VoiceSelector({ selectedVoice, onVoiceSelect }: VoiceSelectorProps) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = window.speechSynthesis?.getVoices() || [];
      console.log('🎤 Available voices:', availableVoices.length, 'voices loaded');
      
      // Filter Turkish voices or fallback to all voices
      const turkishVoices = availableVoices.filter(v => v.lang.startsWith('tr'));
      const voicesToUse = turkishVoices.length > 0 ? turkishVoices : availableVoices;
      
      console.log('🎤 Using', voicesToUse.length, 'voices for selection');
      setVoices(voicesToUse);
    };

    // Voices might not be loaded immediately - try multiple times
    loadVoices();
    setTimeout(loadVoices, 100);
    setTimeout(loadVoices, 500);
    
    if (window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        title={voices.length > 0 ? "Ses Seçimi" : "Sesler yükleniyor..."}
        className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
      >
        <i className="ri-user-voice-line text-xl text-white/80" />
      </button>

      {/* Voice Selection Menu */}
      {showMenu && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="absolute top-12 right-0 bg-gray-800 rounded-lg shadow-xl p-2 min-w-[250px] max-h-[300px] overflow-y-auto z-[9999]"
        >
          <div className="text-xs text-gray-400 px-2 py-1 font-semibold border-b border-gray-700 mb-1">
            Ses Seçin: {voices.length > 0 ? `(${voices.length} ses)` : 'Yükleniyor...'}
          </div>
          {voices.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-400">
              Sesler yükleniyor...
            </div>
          ) : (
            voices.map((voice, index) => {
              const isFemale = voice.name.toLowerCase().includes('female') || 
                              voice.name.toLowerCase().includes('kadın') ||
                              voice.name.toLowerCase().includes('woman') ||
                              voice.name.toLowerCase().includes('emel');
              const icon = isFemale ? '♀️' : '♂️';
              
              return (
                <button
                  key={index}
                  onClick={() => {
                    onVoiceSelect(voice);
                    setShowMenu(false);
                    console.log('🎤 Voice selected:', voice.name);
                  }}
                  className={`w-full text-left px-3 py-2 rounded hover:bg-white/10 transition-all text-sm ${
                    selectedVoice?.name === voice.name ? 'bg-purple-500/30 text-white' : 'text-gray-300'
                  }`}
                >
                  <span className="mr-2">{icon}</span>
                  <span className="truncate">{voice.name}</span>
                </button>
              );
            })
          )}
        </motion.div>
      )}
    </div>
  );
}
