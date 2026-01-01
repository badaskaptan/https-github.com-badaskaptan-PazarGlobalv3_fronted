import { motion } from 'framer-motion';
import { useState } from 'react';
import TopNavigation from '../../components/feature/TopNavigation';

interface Review {
  id: number;
  userName: string;
  userAvatar: string;
  rating: number;
  date: string;
  comment: string;
  productName: string;
  verified: boolean;
  helpful: number;
}

const reviews: Review[] = [
  {
    id: 1,
    userName: 'Ahmet Yılmaz',
    userAvatar: 'https://readdy.ai/api/search-image?query=professional%20turkish%20man%20portrait%20smiling%20friendly%20face%20business%20casual%20style%20clean%20background&width=100&height=100&seq=user-1&orientation=squarish',
    rating: 5,
    date: '2 gün önce',
    comment: 'AI ile ilan vermek gerçekten çok kolay! Sadece fotoğraf çektim, yapay zeka her şeyi otomatik doldurdu. 10 dakikada ilanım yayında. Kesinlikle tavsiye ederim.',
    productName: 'iPhone 13 Pro',
    verified: true,
    helpful: 24
  },
  {
    id: 2,
    userName: 'Zeynep Kaya',
    userAvatar: 'https://readdy.ai/api/search-image?query=professional%20turkish%20woman%20portrait%20smiling%20friendly%20face%20business%20casual%20style%20clean%20background&width=100&height=100&seq=user-2&orientation=squarish',
    rating: 5,
    date: '5 gün önce',
    comment: 'WhatsApp üzerinden ilan vermek harika bir özellik. İşten eve gelirken mesaj attım, eve geldiğimde ilanım hazırdı. Fiyat önerisi de çok yerindeydi.',
    productName: 'MacBook Air M2',
    verified: true,
    helpful: 18
  },
  {
    id: 3,
    userName: 'Mehmet Demir',
    userAvatar: 'https://readdy.ai/api/search-image?query=professional%20turkish%20man%20portrait%20smiling%20confident%20face%20business%20style%20clean%20background&width=100&height=100&seq=user-3&orientation=squarish',
    rating: 4,
    date: '1 hafta önce',
    comment: 'Platform çok kullanışlı. AI fotoğraf iyileştirme özelliği ürünlerimi çok daha profesyonel gösteriyor. Tek eksiği bazen yoğunlukta yanıt süresi uzayabiliyor.',
    productName: 'Samsung Galaxy S23',
    verified: true,
    helpful: 15
  },
  {
    id: 4,
    userName: 'Ayşe Şahin',
    userAvatar: 'https://readdy.ai/api/search-image?query=professional%20turkish%20woman%20portrait%20smiling%20happy%20face%20casual%20style%20clean%20background&width=100&height=100&seq=user-4&orientation=squarish',
    rating: 5,
    date: '1 hafta önce',
    comment: 'Piyasa araştırması özelliği sayesinde ürünümü doğru fiyata koydum ve 2 günde sattım. AI gerçekten çok akıllı, benzer ürünleri analiz edip en iyi fiyatı öneriyor.',
    productName: 'Dyson V11 Süpürge',
    verified: true,
    helpful: 31
  },
  {
    id: 5,
    userName: 'Can Öztürk',
    userAvatar: 'https://readdy.ai/api/search-image?query=professional%20turkish%20man%20portrait%20smiling%20friendly%20young%20face%20modern%20style%20clean%20background&width=100&height=100&seq=user-5&orientation=squarish',
    rating: 5,
    date: '2 hafta önce',
    comment: 'Premium üyelik aldım, çok memnunum. İlanlarım hep üstte çıkıyor ve çok daha fazla görüntülenme alıyorum. Yatırıma değdi.',
    productName: 'PlayStation 5',
    verified: true,
    helpful: 22
  },
  {
    id: 6,
    userName: 'Elif Yıldız',
    userAvatar: 'https://readdy.ai/api/search-image?query=professional%20turkish%20woman%20portrait%20smiling%20elegant%20face%20business%20style%20clean%20background&width=100&height=100&seq=user-6&orientation=squarish',
    rating: 4,
    date: '2 hafta önce',
    comment: 'Sesli komut ile ilan oluşturma çok pratik. Arabadayken bile ilan verebiliyorum. Arayüz de çok şık ve kullanımı kolay.',
    productName: 'Apple Watch Series 8',
    verified: true,
    helpful: 19
  },
  {
    id: 7,
    userName: 'Burak Arslan',
    userAvatar: 'https://readdy.ai/api/search-image?query=professional%20turkish%20man%20portrait%20smiling%20confident%20young%20face%20casual%20style%20clean%20background&width=100&height=100&seq=user-7&orientation=squarish',
    rating: 5,
    date: '3 hafta önce',
    comment: 'Dolandırıcılık tespiti özelliği sayesinde güvenle alışveriş yapabiliyorum. AI şüpheli ilanları işaretliyor, çok güvenli hissediyorum.',
    productName: 'Canon EOS R6',
    verified: true,
    helpful: 27
  },
  {
    id: 8,
    userName: 'Selin Aydın',
    userAvatar: 'https://readdy.ai/api/search-image?query=professional%20turkish%20woman%20portrait%20smiling%20cheerful%20face%20modern%20style%20clean%20background&width=100&height=100&seq=user-8&orientation=squarish',
    rating: 5,
    date: '3 hafta önce',
    comment: 'Fiyat değişikliği bildirimleri harika! Takip ettiğim ürünün fiyatı düşünce hemen WhatsApp\'tan bildirim aldım ve hemen aldım.',
    productName: 'iPad Pro 12.9',
    verified: true,
    helpful: 16
  },
  {
    id: 9,
    userName: 'Emre Çelik',
    userAvatar: 'https://readdy.ai/api/search-image?query=professional%20turkish%20man%20portrait%20smiling%20friendly%20mature%20face%20business%20style%20clean%20background&width=100&height=100&seq=user-9&orientation=squarish',
    rating: 4,
    date: '1 ay önce',
    comment: 'Analitik dashboard çok detaylı. İlanlarımın performansını takip edip stratejimi buna göre ayarlıyorum. Satışlarım %40 arttı.',
    productName: 'Dell XPS 15',
    verified: true,
    helpful: 20
  },
  {
    id: 10,
    userName: 'Deniz Koç',
    userAvatar: 'https://readdy.ai/api/search-image?query=professional%20turkish%20woman%20portrait%20smiling%20confident%20face%20elegant%20style%20clean%20background&width=100&height=100&seq=user-10&orientation=squarish',
    rating: 5,
    date: '1 ay önce',
    comment: 'Çoklu dil desteği sayesinde yabancı alıcılara da satış yapabiliyorum. AI otomatik çeviri yapıyor, çok pratik.',
    productName: 'Bose QuietComfort 45',
    verified: true,
    helpful: 14
  }
];

export default function ReviewsPage() {
  const [sortBy, setSortBy] = useState<'recent' | 'helpful' | 'rating'>('recent');
  const [filterRating, setFilterRating] = useState<number | null>(null);

  const sortedReviews = [...reviews].sort((a, b) => {
    if (sortBy === 'helpful') return b.helpful - a.helpful;
    if (sortBy === 'rating') return b.rating - a.rating;
    return 0;
  }).filter(review => filterRating ? review.rating === filterRating : true);

  const averageRating = (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1);
  const ratingDistribution = [5, 4, 3, 2, 1].map(rating => ({
    rating,
    count: reviews.filter(r => r.rating === rating).length,
    percentage: (reviews.filter(r => r.rating === rating).length / reviews.length) * 100
  }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50">
      <TopNavigation />
      
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-yellow-600 text-white py-20 mt-20">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center"
          >
            <h1 className="text-5xl lg:text-6xl font-display font-bold mb-6">
              Yorumlar & Puanlamalar
            </h1>
            <p className="text-xl text-white/90 max-w-2xl mx-auto">
              Kullanıcılarımızın deneyimlerini okuyun ve platformumuz hakkında gerçek görüşleri öğrenin
            </p>
          </motion.div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Sidebar - Stats */}
          <div className="lg:col-span-1">
            <motion.div
              className="bg-white rounded-2xl p-8 shadow-lg sticky top-24"
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
            >
              {/* Overall Rating */}
              <div className="text-center mb-8 pb-8 border-b border-gray-200">
                <div className="text-6xl font-bold text-gray-900 mb-2">{averageRating}</div>
                <div className="flex items-center justify-center space-x-1 mb-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <i
                      key={star}
                      className={`ri-star-fill text-2xl ${
                        star <= Math.round(parseFloat(averageRating))
                          ? 'text-amber-500'
                          : 'text-gray-300'
                      }`}
                    />
                  ))}
                </div>
                <p className="text-gray-600">{reviews.length} değerlendirme</p>
              </div>

              {/* Rating Distribution */}
              <div className="space-y-3 mb-8">
                {ratingDistribution.map((dist) => (
                  <button
                    key={dist.rating}
                    onClick={() => setFilterRating(filterRating === dist.rating ? null : dist.rating)}
                    className={`w-full flex items-center space-x-3 cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors ${
                      filterRating === dist.rating ? 'bg-amber-50' : ''
                    }`}
                  >
                    <div className="flex items-center space-x-1 w-20">
                      <span className="text-sm font-medium text-gray-700">{dist.rating}</span>
                      <i className="ri-star-fill text-amber-500 text-sm" />
                    </div>
                    <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-orange-500"
                        style={{ width: `${dist.percentage}%` }}
                      />
                    </div>
                    <span className="text-sm text-gray-600 w-8">{dist.count}</span>
                  </button>
                ))}
              </div>

              {/* Sort Options */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Sıralama
                </label>
                <div className="space-y-2">
                  {[
                    { value: 'recent', label: 'En Yeni', icon: 'ri-time-line' },
                    { value: 'helpful', label: 'En Yararlı', icon: 'ri-thumb-up-line' },
                    { value: 'rating', label: 'En Yüksek Puan', icon: 'ri-star-line' }
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setSortBy(option.value as any)}
                      className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all cursor-pointer ${
                        sortBy === option.value
                          ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <i className={`${option.icon} text-lg`} />
                      <span className="font-medium">{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>

          {/* Right Content - Reviews */}
          <div className="lg:col-span-2 space-y-6">
            {sortedReviews.map((review, index) => (
              <motion.div
                key={review.id}
                className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-shadow"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                {/* User Info */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 rounded-full overflow-hidden">
                      <img
                        src={review.userAvatar}
                        alt={review.userName}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="font-bold text-gray-900">{review.userName}</h3>
                        {review.verified && (
                          <div className="flex items-center space-x-1 bg-green-100 px-2 py-1 rounded-full">
                            <i className="ri-checkbox-circle-fill text-green-600 text-xs" />
                            <span className="text-xs text-green-700 font-medium">Doğrulanmış</span>
                          </div>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">{review.date}</p>
                    </div>
                  </div>

                  {/* Rating */}
                  <div className="flex items-center space-x-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <i
                        key={star}
                        className={`ri-star-fill text-lg ${
                          star <= review.rating ? 'text-amber-500' : 'text-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* Product Name */}
                <div className="inline-flex items-center space-x-2 bg-gray-100 px-3 py-1 rounded-full mb-4">
                  <i className="ri-shopping-bag-line text-gray-600 text-sm" />
                  <span className="text-sm text-gray-700 font-medium">{review.productName}</span>
                </div>

                {/* Comment */}
                <p className="text-gray-700 leading-relaxed mb-4">{review.comment}</p>

                {/* Actions */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                  <button className="flex items-center space-x-2 text-gray-600 hover:text-amber-600 transition-colors cursor-pointer">
                    <i className="ri-thumb-up-line text-lg" />
                    <span className="text-sm font-medium">Yararlı ({review.helpful})</span>
                  </button>

                  <button className="flex items-center space-x-2 text-gray-600 hover:text-amber-600 transition-colors cursor-pointer">
                    <i className="ri-share-line text-lg" />
                    <span className="text-sm font-medium">Paylaş</span>
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
