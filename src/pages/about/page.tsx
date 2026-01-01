import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import TopNavigation from '../../components/feature/TopNavigation';

export default function AboutPage() {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const stats = [
    { icon: 'ri-user-line', value: '500K+', label: 'Aktif Kullanıcı' },
    { icon: 'ri-file-list-3-line', value: '2M+', label: 'Yayınlanan İlan' },
    { icon: 'ri-global-line', value: '150+', label: 'Şehir' },
    { icon: 'ri-star-line', value: '4.8/5', label: 'Kullanıcı Memnuniyeti' },
  ];

  const values = [
    {
      icon: 'ri-lightbulb-flash-line',
      title: 'İnovasyon',
      description: 'Yapay zeka teknolojileri ile ilan verme deneyimini yeniden tanımlıyoruz.',
      gradient: 'from-purple-500 to-blue-500',
    },
    {
      icon: 'ri-shield-check-line',
      title: 'Güvenilirlik',
      description: 'Kullanıcılarımızın güvenliği ve gizliliği bizim için her şeyden önemli.',
      gradient: 'from-cyan-500 to-green-500',
    },
    {
      icon: 'ri-speed-line',
      title: 'Hız',
      description: 'Saniyeler içinde profesyonel ilanlar oluşturun, zamanınızı değerli işlere ayırın.',
      gradient: 'from-orange-500 to-pink-500',
    },
    {
      icon: 'ri-customer-service-2-line',
      title: 'Destek',
      description: '7/24 AI destekli müşteri hizmetleri ile her zaman yanınızdayız.',
      gradient: 'from-indigo-500 to-purple-500',
    },
  ];

  const team = [
    {
      name: 'Ayşe Yılmaz',
      role: 'Kurucu & CEO',
      image: 'https://readdy.ai/api/search-image?query=professional%20turkish%20businesswoman%20ceo%20in%20modern%20office%20wearing%20elegant%20business%20suit%20confident%20smile%20natural%20lighting%20corporate%20portrait%20style%20simple%20clean%20background&width=400&height=400&seq=team1&orientation=squarish',
      bio: '15 yıllık teknoloji ve e-ticaret deneyimi',
    },
    {
      name: 'Mehmet Kaya',
      role: 'CTO',
      image: 'https://readdy.ai/api/search-image?query=professional%20turkish%20male%20technology%20executive%20cto%20in%20modern%20tech%20office%20wearing%20smart%20casual%20attire%20friendly%20expression%20natural%20lighting%20corporate%20portrait%20simple%20background&width=400&height=400&seq=team2&orientation=squarish',
      bio: 'AI ve makine öğrenmesi uzmanı',
    },
    {
      name: 'Zeynep Demir',
      role: 'Ürün Direktörü',
      image: 'https://readdy.ai/api/search-image?query=professional%20turkish%20businesswoman%20product%20director%20in%20creative%20workspace%20wearing%20modern%20business%20casual%20warm%20smile%20natural%20lighting%20corporate%20portrait%20clean%20background&width=400&height=400&seq=team3&orientation=squarish',
      bio: 'Kullanıcı deneyimi ve ürün geliştirme lideri',
    },
    {
      name: 'Can Özkan',
      role: 'Pazarlama Direktörü',
      image: 'https://readdy.ai/api/search-image?query=professional%20turkish%20male%20marketing%20director%20in%20modern%20creative%20office%20wearing%20stylish%20business%20casual%20confident%20look%20natural%20lighting%20corporate%20portrait%20simple%20background&width=400&height=400&seq=team4&orientation=squarish',
      bio: 'Dijital pazarlama ve büyüme stratejisti',
    },
  ];

  const timeline = [
    { year: '2020', title: 'Kuruluş', description: 'PazarGlobal fikri doğdu ve ilk adımlar atıldı' },
    { year: '2021', title: 'Beta Lansmanı', description: '10.000 kullanıcı ile beta testleri başladı' },
    { year: '2022', title: 'AI Entegrasyonu', description: 'Yapay zeka destekli özellikler eklendi' },
    { year: '2023', title: 'Büyük Büyüme', description: '500K+ kullanıcıya ulaştık' },
    { year: '2024', title: 'Global Genişleme', description: 'Uluslararası pazarlara açıldık' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-cyan-50">
      <TopNavigation isScrolled={isScrolled} />
      
      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-16"
          >
            <h1 className="text-5xl lg:text-6xl font-display font-bold mb-6">
              <span className="bg-gradient-primary bg-clip-text text-transparent">
                Hakkımızda
              </span>
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
              PazarGlobal, yapay zeka teknolojisi ile ilan verme deneyimini yeniden tanımlayan, 
              Türkiye'nin en yenilikçi online pazar platformudur.
            </p>
          </motion.div>

          {/* Stats */}
          <div className="grid md:grid-cols-4 gap-8 mb-20">
            {stats.map((stat, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all text-center"
              >
                <div className="w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center mx-auto mb-4">
                  <i className={`${stat.icon} text-3xl text-white`} />
                </div>
                <div className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent mb-2">
                  {stat.value}
                </div>
                <div className="text-gray-600 font-medium">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Mission Section */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-4xl font-display font-bold mb-6">
                <span className="bg-gradient-primary bg-clip-text text-transparent">
                  Misyonumuz
                </span>
              </h2>
              <p className="text-lg text-gray-600 leading-relaxed mb-6">
                İnsanların alışveriş ve ticaret yapma şeklini yapay zeka ile dönüştürmek. 
                Her kullanıcının saniyeler içinde profesyonel ilanlar oluşturabilmesini, 
                doğru fiyatlandırma yapabilmesini ve hedef kitlesine ulaşabilmesini sağlamak.
              </p>
              <p className="text-lg text-gray-600 leading-relaxed">
                Teknoloji ile insanları buluşturarak, daha hızlı, güvenli ve verimli bir 
                ticaret ekosistemi yaratıyoruz. Amacımız, herkes için erişilebilir ve 
                kullanımı kolay bir platform sunmak.
              </p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="w-full h-96 rounded-2xl overflow-hidden shadow-2xl">
                <img
                  src="https://readdy.ai/api/search-image?query=modern%20technology%20office%20workspace%20with%20diverse%20team%20collaborating%20on%20artificial%20intelligence%20project%20bright%20natural%20lighting%20clean%20minimalist%20design%20professional%20atmosphere%20innovation%20and%20teamwork%20concept&width=800&height=600&seq=mission1&orientation=landscape"
                  alt="Misyonumuz"
                  className="w-full h-full object-cover object-top"
                />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-display font-bold mb-4">
              <span className="bg-gradient-primary bg-clip-text text-transparent">
                Değerlerimiz
              </span>
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Bizi biz yapan ve her gün ilerlememizi sağlayan temel değerlerimiz
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {values.map((value, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all group"
              >
                <div className={`w-16 h-16 bg-gradient-to-r ${value.gradient} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                  <i className={`${value.icon} text-3xl text-white`} />
                </div>
                <h3 className="text-xl font-bold mb-3">{value.title}</h3>
                <p className="text-gray-600 leading-relaxed">{value.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Timeline Section */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-display font-bold mb-4">
              <span className="bg-gradient-primary bg-clip-text text-transparent">
                Yolculuğumuz
              </span>
            </h2>
            <p className="text-lg text-gray-600">
              Başlangıçtan bugüne kadar olan hikayemiz
            </p>
          </motion.div>

          <div className="relative">
            <div className="absolute left-1/2 transform -translate-x-1/2 w-1 h-full bg-gradient-primary opacity-20" />
            
            {timeline.map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className={`relative flex items-center mb-12 ${
                  index % 2 === 0 ? 'flex-row' : 'flex-row-reverse'
                }`}
              >
                <div className={`w-5/12 ${index % 2 === 0 ? 'text-right pr-8' : 'text-left pl-8'}`}>
                  <div className="bg-white rounded-2xl p-6 shadow-lg">
                    <div className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent mb-2">
                      {item.year}
                    </div>
                    <h3 className="text-xl font-bold mb-2">{item.title}</h3>
                    <p className="text-gray-600">{item.description}</p>
                  </div>
                </div>
                
                <div className="w-2/12 flex justify-center">
                  <div className="w-6 h-6 bg-gradient-primary rounded-full border-4 border-white shadow-lg" />
                </div>
                
                <div className="w-5/12" />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-display font-bold mb-4">
              <span className="bg-gradient-primary bg-clip-text text-transparent">
                Ekibimiz
              </span>
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              PazarGlobal'i hayata geçiren tutkulu ve deneyimli ekibimiz
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {team.map((member, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-all group"
              >
                <div className="w-full h-64 overflow-hidden">
                  <img
                    src={member.image}
                    alt={member.name}
                    className="w-full h-full object-cover object-top group-hover:scale-110 transition-transform duration-500"
                  />
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-bold mb-1">{member.name}</h3>
                  <div className="text-sm font-semibold bg-gradient-primary bg-clip-text text-transparent mb-3">
                    {member.role}
                  </div>
                  <p className="text-sm text-gray-600">{member.bio}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 bg-gradient-primary">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl lg:text-5xl font-display font-bold text-white mb-6">
              Bize Katılın!
            </h2>
            <p className="text-xl text-white/90 mb-8 leading-relaxed">
              PazarGlobal ailesinin bir parçası olun ve yapay zeka destekli 
              ilan verme deneyimini keşfedin.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <a
                href="/listings"
                className="px-8 py-4 bg-white text-primary-600 rounded-full font-semibold hover:shadow-2xl hover:scale-105 transition-all whitespace-nowrap cursor-pointer"
              >
                İlanları İncele
              </a>
              <button className="px-8 py-4 bg-white/10 backdrop-blur-sm text-white border-2 border-white rounded-full font-semibold hover:bg-white/20 transition-all whitespace-nowrap cursor-pointer">
                İletişime Geç
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center space-x-3 mb-4">
                <img
                  src="https://public.readdy.ai/ai/img_res/bb84cc65-d624-4c41-b5c3-63c6967b79d3.png"
                  alt="PazarGlobal"
                  className="h-8 w-auto"
                />
                <span className="text-xl font-display font-bold">PazarGlobal</span>
              </div>
              <p className="text-gray-400 text-sm leading-relaxed">
                AI destekli yeni nesil ilan platformu
              </p>
            </div>
            
            <div>
              <h3 className="font-semibold mb-4">Hızlı Linkler</h3>
              <div className="space-y-2">
                <a href="/" className="block text-gray-400 hover:text-white transition-colors text-sm cursor-pointer">Ana Sayfa</a>
                <a href="/listings" className="block text-gray-400 hover:text-white transition-colors text-sm cursor-pointer">İlanlar</a>
                <a href="/about" className="block text-gray-400 hover:text-white transition-colors text-sm cursor-pointer">Hakkımızda</a>
              </div>
            </div>
            
            <div>
              <h3 className="font-semibold mb-4">Destek</h3>
              <div className="space-y-2">
                <a href="#" className="block text-gray-400 hover:text-white transition-colors text-sm cursor-pointer">Yardım Merkezi</a>
                <a href="#" className="block text-gray-400 hover:text-white transition-colors text-sm cursor-pointer">İletişim</a>
                <a href="#" className="block text-gray-400 hover:text-white transition-colors text-sm cursor-pointer">Gizlilik</a>
              </div>
            </div>
            
            <div>
              <h3 className="font-semibold mb-4">Bizi Takip Edin</h3>
              <div className="flex space-x-4">
                <a href="#" className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors cursor-pointer">
                  <i className="ri-facebook-fill text-lg" />
                </a>
                <a href="#" className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors cursor-pointer">
                  <i className="ri-twitter-fill text-lg" />
                </a>
                <a href="#" className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors cursor-pointer">
                  <i className="ri-instagram-fill text-lg" />
                </a>
              </div>
            </div>
          </div>
          
          <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-400 text-sm mb-4 md:mb-0">
              © 2024 PazarGlobal. Tüm hakları saklıdır.
            </p>
            <a 
              href="https://readdy.ai/?origin=logo" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-white text-sm transition-colors cursor-pointer"
            >
              Powered by Readdy
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
