import { motion } from 'framer-motion';
import { useState } from 'react';

export default function VideoSection() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoUrl] = useState('https://www.youtube.com/embed/Iu0a3H8nAT0?autoplay=1&rel=0');

  // Video URL'i buraya eklenecek (YouTube, Vimeo, vb.)
  const embedUrl = videoUrl || '';

  const handlePlayClick = () => {
    setIsPlaying(true);
  };

  const handleReplayClick = () => {
    setIsPlaying(false);
    setTimeout(() => {
      setIsPlaying(true);
    }, 100);
  };

  return (
    <section className="py-24 bg-gradient-to-br from-gray-50 via-white to-gray-50 relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-20 left-20 w-72 h-72 bg-purple-400 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-cyan-400 rounded-full blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        {/* Header */}
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <div className="inline-flex items-center space-x-3 bg-gradient-primary/10 backdrop-blur-sm px-6 py-3 rounded-full mb-6">
            <div className="w-10 h-10 bg-gradient-primary rounded-full flex items-center justify-center">
              <i className="ri-play-circle-fill text-white text-xl" />
            </div>
            <span className="text-sm font-semibold text-gray-700">Tanıtım Videosu</span>
          </div>

          <h2 className="text-5xl lg:text-6xl font-display font-bold text-gray-900 mb-6 leading-tight">
            <span className="bg-gradient-primary bg-clip-text text-transparent">
              10 Saniyede İlan Ver
            </span>
          </h2>

          <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
            WhatsApp'tan mesaj at, yapay zeka ilanını hazırlasın, hemen satışa çıkar!
          </p>
        </motion.div>

        {/* Video Container */}
        <motion.div
          className="max-w-5xl mx-auto"
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <div className="relative rounded-3xl overflow-hidden shadow-2xl bg-gradient-to-br from-purple-900 to-blue-900">
            {/* Video Placeholder / Embed */}
            {!isPlaying && !embedUrl ? (
              // Placeholder - Video henüz eklenmemiş
              <div className="relative aspect-video bg-gradient-to-br from-purple-600 via-blue-600 to-cyan-600 flex items-center justify-center">
                {/* Animated Background */}
                <div className="absolute inset-0 opacity-20">
                  <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-white rounded-full blur-3xl animate-float" />
                  <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-white rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }} />
                </div>

                {/* Content */}
                <div className="relative z-10 text-center px-6">
                  {/* Logo */}
                  <motion.div
                    className="mb-8"
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <img 
                      src="/logo.svg" 
                      alt="PazarGlobal Logo" 
                      className="w-32 h-32 mx-auto drop-shadow-2xl"
                    />
                  </motion.div>

                  {/* Play Button */}
                  <motion.button
                    onClick={handlePlayClick}
                    className="w-24 h-24 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/30 transition-all group cursor-pointer mb-6"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <i className="ri-play-fill text-white text-5xl group-hover:scale-110 transition-transform" />
                  </motion.button>

                  {/* Text */}
                  <h3 className="text-3xl font-bold text-white mb-4">
                    PazarGlobal ile Tanışın
                  </h3>
                  <p className="text-lg text-white/90 mb-6">
                    WhatsApp'tan 10 saniyede ilan ver!
                  </p>

                  {/* Features */}
                  <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-white/80">
                    <div className="flex items-center space-x-2">
                      <i className="ri-whatsapp-line text-xl" />
                      <span>WhatsApp Entegrasyonu</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <i className="ri-robot-2-line text-xl" />
                      <span>Yapay Zeka Asistan</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <i className="ri-time-line text-xl" />
                      <span>10 Saniyede İlan</span>
                    </div>
                  </div>
                </div>

                {/* Floating Elements */}
                <motion.div
                  className="absolute top-8 left-8 bg-white/10 backdrop-blur-sm rounded-2xl p-4"
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 3, repeat: Infinity }}
                >
                  <div className="flex items-center space-x-2 text-white">
                    <i className="ri-smartphone-line text-2xl" />
                    <div className="text-left">
                      <div className="text-xs opacity-80">Adım 1</div>
                      <div className="text-sm font-semibold">Mesaj At</div>
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  className="absolute top-8 right-8 bg-white/10 backdrop-blur-sm rounded-2xl p-4"
                  animate={{ y: [0, 10, 0] }}
                  transition={{ duration: 3, repeat: Infinity, delay: 1 }}
                >
                  <div className="flex items-center space-x-2 text-white">
                    <i className="ri-robot-2-line text-2xl" />
                    <div className="text-left">
                      <div className="text-xs opacity-80">Adım 2</div>
                      <div className="text-sm font-semibold">AI Hazırlasın</div>
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  className="absolute bottom-8 left-1/2 transform -translate-x-1/2 bg-white/10 backdrop-blur-sm rounded-2xl p-4"
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 3, repeat: Infinity, delay: 2 }}
                >
                  <div className="flex items-center space-x-2 text-white">
                    <i className="ri-check-double-line text-2xl" />
                    <div className="text-left">
                      <div className="text-xs opacity-80">Adım 3</div>
                      <div className="text-sm font-semibold">Satışa Çıkar</div>
                    </div>
                  </div>
                </motion.div>
              </div>
            ) : (
              // Video Embed - URL eklendiğinde gösterilecek
              <div className="relative aspect-video">
                {isPlaying && (
                  <iframe
                    key={Date.now()}
                    src={embedUrl}
                    title="PazarGlobal Tanıtım Videosu"
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                )}
                
                {!isPlaying && (
                  <div className="relative aspect-video bg-gradient-to-br from-purple-600 via-blue-600 to-cyan-600 flex items-center justify-center">
                    {/* Animated Background */}
                    <div className="absolute inset-0 opacity-20">
                      <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-white rounded-full blur-3xl animate-float" />
                      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-white rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }} />
                    </div>

                    {/* Content */}
                    <div className="relative z-10 text-center px-6">
                      {/* Logo */}
                      <motion.div
                        className="mb-8"
                        animate={{ scale: [1, 1.05, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      >
                        <img 
                          src="/logo.svg" 
                          alt="PazarGlobal Logo" 
                          className="w-32 h-32 mx-auto drop-shadow-2xl"
                        />
                      </motion.div>

                      {/* Play Button */}
                      <motion.button
                        onClick={handlePlayClick}
                        className="w-24 h-24 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/30 transition-all group cursor-pointer mb-6"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <i className="ri-play-fill text-white text-5xl group-hover:scale-110 transition-transform" />
                      </motion.button>

                      {/* Text */}
                      <h3 className="text-3xl font-bold text-white mb-4">
                        PazarGlobal ile Tanışın
                      </h3>
                      <p className="text-lg text-white/90 mb-6">
                        WhatsApp'tan 10 saniyede ilan ver!
                      </p>

                      {/* Features */}
                      <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-white/80">
                        <div className="flex items-center space-x-2">
                          <i className="ri-whatsapp-line text-xl" />
                          <span>WhatsApp Entegrasyonu</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <i className="ri-robot-2-line text-xl" />
                          <span>Yapay Zeka Asistan</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <i className="ri-time-line text-xl" />
                          <span>10 Saniyede İlan</span>
                        </div>
                      </div>
                    </div>

                    {/* Floating Elements */}
                    <motion.div
                      className="absolute top-8 left-8 bg-white/10 backdrop-blur-sm rounded-2xl p-4"
                      animate={{ y: [0, -10, 0] }}
                      transition={{ duration: 3, repeat: Infinity }}
                    >
                      <div className="flex items-center space-x-2 text-white">
                        <i className="ri-smartphone-line text-2xl" />
                        <div className="text-left">
                          <div className="text-xs opacity-80">Adım 1</div>
                          <div className="text-sm font-semibold">Mesaj At</div>
                        </div>
                      </div>
                    </motion.div>

                    <motion.div
                      className="absolute top-8 right-8 bg-white/10 backdrop-blur-sm rounded-2xl p-4"
                      animate={{ y: [0, 10, 0] }}
                      transition={{ duration: 3, repeat: Infinity, delay: 1 }}
                    >
                      <div className="flex items-center space-x-2 text-white">
                        <i className="ri-robot-2-line text-2xl" />
                        <div className="text-left">
                          <div className="text-xs opacity-80">Adım 2</div>
                          <div className="text-sm font-semibold">AI Hazırlasın</div>
                        </div>
                      </div>
                    </motion.div>

                    <motion.div
                      className="absolute bottom-8 left-1/2 transform -translate-x-1/2 bg-white/10 backdrop-blur-sm rounded-2xl p-4"
                      animate={{ y: [0, -10, 0] }}
                      transition={{ duration: 3, repeat: Infinity, delay: 2 }}
                    >
                      <div className="flex items-center space-x-2 text-white">
                        <i className="ri-check-double-line text-2xl" />
                        <div className="text-left">
                          <div className="text-xs opacity-80">Adım 3</div>
                          <div className="text-sm font-semibold">Satışa Çıkar</div>
                        </div>
                      </div>
                    </motion.div>
                  </div>
                )}

                {/* Replay Button - Video oynatılıyorsa göster */}
                {isPlaying && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.5 }}
                    onClick={handleReplayClick}
                    className="absolute top-4 right-4 px-4 py-2 bg-white/90 backdrop-blur-sm text-gray-900 rounded-full hover:bg-white transition-all flex items-center space-x-2 shadow-lg cursor-pointer whitespace-nowrap z-20"
                  >
                    <i className="ri-restart-line text-lg" />
                    <span className="text-sm font-semibold">Tekrar Oynat</span>
                  </motion.button>
                )}
              </div>
            )}

            {/* Video Info Overlay */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-6">
              <div className="flex items-center justify-between">
                <div className="text-white">
                  <div className="text-sm opacity-80 mb-1">Tanıtım Videosu</div>
                  <div className="text-lg font-semibold">PazarGlobal.com</div>
                </div>
                <div className="flex items-center space-x-2 text-white/80 text-sm">
                  <i className="ri-time-line" />
                  <span>~30 saniye</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div
          className="grid md:grid-cols-3 gap-8 mt-16 max-w-4xl mx-auto"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.4 }}
        >
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
              <i className="ri-time-line text-white text-3xl" />
            </div>
            <div className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent mb-2">
              10 Saniye
            </div>
            <p className="text-sm text-gray-600">İlan Verme Süresi</p>
          </div>

          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
              <i className="ri-whatsapp-line text-white text-3xl" />
            </div>
            <div className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent mb-2">
              WhatsApp
            </div>
            <p className="text-sm text-gray-600">Kolay Entegrasyon</p>
          </div>

          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
              <i className="ri-robot-2-line text-white text-3xl" />
            </div>
            <div className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent mb-2">
              AI Asistan
            </div>
            <p className="text-sm text-gray-600">7/24 Aktif</p>
          </div>
        </motion.div>

        {/* CTA */}
        <motion.div
          className="text-center mt-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.6 }}
        >
          <button
            onClick={() => {
              if (window.REACT_APP_NAVIGATE) {
                window.REACT_APP_NAVIGATE('/auth/register');
              }
            }}
            className="px-8 py-4 bg-gradient-primary text-white font-semibold rounded-full hover:shadow-2xl hover:scale-105 transition-all flex items-center space-x-2 mx-auto whitespace-nowrap cursor-pointer"
          >
            <span>Ücretsiz Dene</span>
            <i className="ri-arrow-right-line text-xl" />
          </button>
          <p className="text-sm text-gray-500 mt-4">
            Kredi kartı gerekmez • Anında başla
          </p>
        </motion.div>
      </div>
    </section>
  );
}
