
import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import TopNavigation from '../../components/feature/TopNavigation';
import Footer from '../home/components/Footer';
import ChatBox from '../../components/feature/ChatBox';
import { toCanonicalCondition } from '../../lib/condition';
import { supabase } from '../../lib/supabase';

interface ListingDetail {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  condition: string;
  location: string;
  images: string[];
  is_premium: boolean;
  views: number;
  created_at: string;
  user_name: string;
  user_phone: string;
}

export default function ListingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [isScrolled, setIsScrolled] = useState(false);
  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const fetchListing = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('listings')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      if (data) {
        const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
        const bucketBase = supabaseUrl
          ? `${supabaseUrl}/storage/v1/object/public/product-images`
          : '';

        const toAbsoluteUrl = (value: string) => {
          if (/^https?:\/\//i.test(value)) {
            return value;
          }
          if (!bucketBase) {
            return value;
          }
          const sanitized = value.replace(/^\/+/, '');
          return `${bucketBase}/${sanitized}`;
        };

        const resolveImageUrl = (entry: unknown): string | null => {
          if (!entry) {
            return null;
          }
          if (typeof entry === 'string') {
            const trimmed = entry.trim();
            return trimmed ? toAbsoluteUrl(trimmed) : null;
          }
          if (typeof entry === 'object') {
            const typed = entry as {
              image_url?: string;
              public_url?: string;
              url?: string;
              path?: string;
            };
            const candidate = typed.image_url || typed.public_url || typed.url || typed.path;
            if (candidate && typeof candidate === 'string' && candidate.trim()) {
              return toAbsoluteUrl(candidate.trim());
            }
          }
          return null;
        };

        let imageUrls: string[] = [];
        if (Array.isArray(data.images) && data.images.length > 0) {
          imageUrls = data.images
            .map(resolveImageUrl)
            .filter((url): url is string => Boolean(url));
        }

        if (imageUrls.length === 0 && data.image_url) {
          const fallback = resolveImageUrl(data.image_url);
          if (fallback) {
            imageUrls = [fallback];
          }
        }

        if (imageUrls.length === 0) {
          imageUrls = [
            'https://readdy.ai/api/search-image?query=product%20placeholder%20simple%20clean%20background&width=800&height=600&seq=placeholder&orientation=landscape',
          ];
        }

        console.log('📸 Resim URL\'leri:', imageUrls);

        setListing({
          id: data.id,
          title: data.title,
          description: data.description || '',
          price: data.price,
          category: data.category,
          condition: data.condition,
          location: data.location,
          images: imageUrls,
          is_premium: data.is_premium || false,
          views: data.view_count || 0,
          created_at: data.created_at,
          user_name: data.user_name || 'Satıcı',
          user_phone: data.user_phone || ''
        });

        // Increment views
        await supabase.rpc('increment_listing_views', { listing_id: id });
      }
    } catch (error) {
      console.error('Error fetching listing:', error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      void fetchListing();
    }
  }, [id, fetchListing]);

  const formatDate = (date: string) => {
    const itemDate = new Date(date);
    return itemDate.toLocaleDateString('tr-TR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleWhatsAppContact = () => {
    if (listing?.user_phone) {
      const message = encodeURIComponent(`Merhaba, "${listing.title}" ilanınız hakkında bilgi almak istiyorum.`);
      window.open(`https://wa.me/${listing.user_phone.replace(/\D/g, '')}?text=${message}`, '_blank');
    }
  };

  const handleImageClick = (index: number) => {
    setCurrentImageIndex(index);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-cyan-50">
        <TopNavigation isScrolled={isScrolled} />
        <div className="pt-24 pb-16 flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="inline-block w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mb-4"></div>
            <p className="text-gray-600">İlan yükleniyor...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-cyan-50">
        <TopNavigation isScrolled={isScrolled} />
        <div className="pt-24 pb-16 flex items-center justify-center min-h-screen">
          <div className="text-center">
            <i className="ri-error-warning-line text-6xl text-gray-300 mb-4" />
            <h3 className="text-xl font-semibold text-gray-600 mb-2">İlan Bulunamadı</h3>
            <p className="text-gray-500">Aradığınız ilan mevcut değil veya kaldırılmış olabilir.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-cyan-50">
      <TopNavigation isScrolled={isScrolled} />

      <div className="pt-24 pb-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-8">
            {/* Image Gallery */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-4"
            >
              {/* Main Image */}
              <div className="relative h-96 lg:h-[500px] rounded-2xl overflow-hidden bg-white shadow-lg">
                <img
                  src={listing.images[currentImageIndex] || 'https://readdy.ai/api/search-image?query=product%20placeholder%20simple%20clean%20background&width=800&height=600&seq=placeholder&orientation=landscape'}
                  alt={listing.title}
                  className="w-full h-full object-cover"
                />
                {listing.is_premium && (
                  <div className="absolute top-4 right-4 px-4 py-2 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-sm font-bold rounded-full flex items-center space-x-2">
                    <i className="ri-vip-crown-fill" />
                    <span>Premium İlan</span>
                  </div>
                )}
              </div>

              {/* Thumbnail Gallery */}
              {listing.images.length > 1 && (
                <div className="grid grid-cols-4 gap-3">
                  {listing.images.map((image, index) => (
                    <button
                      key={index}
                      onClick={() => handleImageClick(index)}
                      className={`relative h-24 rounded-lg overflow-hidden cursor-pointer transition-all ${
                        currentImageIndex === index
                          ? 'ring-4 ring-primary-500 scale-105'
                          : 'hover:scale-105 opacity-70 hover:opacity-100'
                      }`}
                    >
                      <img
                        src={image}
                        alt={`${listing.title} - ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </motion.div>

            {/* Listing Details */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              {/* Title & Price */}
              <div className="bg-white rounded-2xl p-6 shadow-lg">
                <div className="flex items-start justify-between mb-4">
                  <h1 className="text-3xl font-bold text-gray-900 flex-1">
                    {listing.title}
                  </h1>
                </div>

                <div className="flex items-center justify-between mb-6">
                  <div className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                    {listing.price.toLocaleString('tr-TR')} ₺
                  </div>
                  <div className="flex items-center space-x-2 text-sm text-gray-500">
                    <i className="ri-eye-line" />
                    <span>{listing.views} görüntülenme</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 mb-6">
                  <span className="px-4 py-2 bg-purple-100 text-purple-700 text-sm font-medium rounded-full">
                    {listing.category}
                  </span>
                  <span className="px-4 py-2 bg-green-100 text-green-700 text-sm font-medium rounded-full">
                    {toCanonicalCondition(listing.condition) || listing.condition}
                  </span>
                  <span className="px-4 py-2 bg-blue-100 text-blue-700 text-sm font-medium rounded-full flex items-center space-x-1">
                    <i className="ri-map-pin-line" />
                    <span>{listing.location}</span>
                  </span>
                </div>

                <div className="pt-6 border-t border-gray-200">
                  <p className="text-sm text-gray-500 mb-1">İlan Tarihi</p>
                  <p className="text-gray-900 font-medium">{formatDate(listing.created_at)}</p>
                </div>
              </div>

              {/* Description */}
              {listing.description && (
                <div className="bg-white rounded-2xl p-6 shadow-lg">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">Açıklama</h2>
                  <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {listing.description}
                  </p>
                </div>
              )}

              {/* Seller Info */}
              <div className="bg-white rounded-2xl p-6 shadow-lg">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Satıcı Bilgileri</h2>
                <div className="flex items-center space-x-4 mb-6">
                  <div className="w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center text-white text-2xl font-bold">
                    {listing.user_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{listing.user_name}</p>
                    <p className="text-sm text-gray-500">Satıcı</p>
                  </div>
                </div>

                {listing.user_phone && (
                  <button
                    onClick={handleWhatsAppContact}
                    className="w-full py-4 bg-gradient-to-r from-green-500 to-green-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all flex items-center justify-center space-x-2 cursor-pointer whitespace-nowrap"
                  >
                    <i className="ri-whatsapp-line text-2xl" />
                    <span>WhatsApp ile İletişime Geç</span>
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      <Footer />
      <ChatBox />
    </div>
  );
}
