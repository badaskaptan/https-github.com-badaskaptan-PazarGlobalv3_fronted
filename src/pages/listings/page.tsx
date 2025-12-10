import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import FilterSidebar from './components/FilterSidebar';
import ListingCard from './components/ListingCard';
import ChatBox from '../../components/feature/ChatBox';
import TopNavigation from '../../components/feature/TopNavigation';
import Footer from '../home/components/Footer';
import { fetchListingsWithFilters, type DBListing } from '../../services/supabase';
import { supabase } from '../../lib/supabase';
import type { Listing, FilterState } from '../../types/listing';

// Resolve a Supabase storage path or direct URL to a public URL
const resolveImageUrl = (path?: string | null) => {
  if (!path) return null;
  if (path.startsWith('http')) return path;

  const { data } = supabase.storage.from('product-images').getPublicUrl(path);
  return data.publicUrl || null;
};

export default function ListingsPage() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState('newest');
  const [showFilters, setShowFilters] = useState(false);

  // Only use real data from Supabase
  const [filteredListings, setFilteredListings] = useState<Listing[]>([]);
  const [isLoadingFromSupabase, setIsLoadingFromSupabase] = useState(false);

  const [filters, setFilters] = useState<FilterState>({
    categories: [],
    priceRange: [0, 1000000],
    location: '',
    condition: [],
    isPremium: false,
    dateRange: 'all',
  });

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Fetch from Supabase when filters change
  useEffect(() => {
    const fetchData = async () => {
      setIsLoadingFromSupabase(true);
      try {
        const data = await fetchListingsWithFilters(filters);

        // Convert Supabase data to frontend Listing type
        const convertedListings: Listing[] = data.map((item: DBListing) => ({
          id: item.id,
          title: item.title,
          description: item.description,
          price: item.price,
          category: item.category,
          location: item.location,
          condition: item.condition,
          image:
            resolveImageUrl(item.images?.[0]) ||
            resolveImageUrl(item.image_url) ||
            'https://via.placeholder.com/400x300',
          images: item.images
            ?.map(img => resolveImageUrl(img))
            .filter((url): url is string => Boolean(url)),
          isPremium: item.is_premium || false,
          views: item.views,
          createdAt: item.created_at,
          seller: {
            name: 'Kullanıcı',
            rating: 4.5,
            verified: false,
          },
        }));

        // Sort the listings
        let sortedListings = [...convertedListings];
        switch (sortBy) {
          case 'newest':
            sortedListings.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            break;
          case 'oldest':
            sortedListings.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
            break;
          case 'price-low':
            sortedListings.sort((a, b) => a.price - b.price);
            break;
          case 'price-high':
            sortedListings.sort((a, b) => b.price - a.price);
            break;
          case 'popular':
            sortedListings.sort((a, b) => b.views - a.views);
            break;
        }

        setFilteredListings(sortedListings);
      } catch (error) {
        console.error('Failed to fetch from Supabase:', error);
        setFilteredListings([]);
      } finally {
        setIsLoadingFromSupabase(false);
      }
    };

    fetchData();
  }, [filters, sortBy]);

  const handleFilterChange = (newFilters: Partial<FilterState>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  const clearFilters = () => {
    setFilters({
      categories: [],
      priceRange: [0, 1000000],
      location: '',
      condition: [],
      isPremium: false,
      dateRange: 'all',
    });
  };

  const handleNavigation = (path: string) => {
    if (window.REACT_APP_NAVIGATE) {
      window.REACT_APP_NAVIGATE(path);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-cyan-50">
      <TopNavigation isScrolled={isScrolled} />

      <div className="pt-24 pb-16">
        <div className="max-w-7xl mx-auto px-6">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl lg:text-5xl font-display font-bold mb-4">
              <span className="bg-gradient-primary bg-clip-text text-transparent">
                Tüm İlanlar
              </span>
            </h1>
            <p className="text-lg text-gray-600">
              {filteredListings.length} ilan bulundu
            </p>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center space-x-2 px-5 py-2.5 bg-white rounded-full shadow-md hover:shadow-lg transition-all whitespace-nowrap cursor-pointer"
              >
                <i className="ri-filter-3-line text-lg" />
                <span className="text-sm font-medium">Filtreler</span>
                {(filters.categories.length > 0 || filters.condition.length > 0 || filters.isPremium) && (
                  <span className="w-5 h-5 bg-gradient-primary text-white text-xs rounded-full flex items-center justify-center">
                    {filters.categories.length + filters.condition.length + (filters.isPremium ? 1 : 0)}
                  </span>
                )}
              </button>

              {(filters.categories.length > 0 || filters.condition.length > 0 || filters.isPremium || filters.location) && (
                <button
                  onClick={clearFilters}
                  className="text-sm text-gray-600 hover:text-red-600 transition-colors whitespace-nowrap cursor-pointer"
                >
                  Filtreleri Temizle
                </button>
              )}
            </div>

            <div className="flex items-center space-x-4">
              {/* Sort */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-4 py-2.5 bg-white rounded-full shadow-md text-sm font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="newest">En Yeni</option>
                <option value="oldest">En Eski</option>
                <option value="price-low">Fiyat: Düşükten Yükseğe</option>
                <option value="price-high">Fiyat: Yüksekten Düşüğe</option>
                <option value="popular">En Popüler</option>
              </select>

              {/* View Mode */}
              <div className="flex items-center bg-white rounded-full shadow-md p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer ${viewMode === 'grid' ? 'bg-gradient-primary text-white' : 'text-gray-600 hover:text-gray-900'
                    }`}
                >
                  <i className="ri-grid-line text-lg" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer ${viewMode === 'list' ? 'bg-gradient-primary text-white' : 'text-gray-600 hover:text-gray-900'
                    }`}
                >
                  <i className="ri-list-check text-lg" />
                </button>
              </div>
            </div>
          </div>

          <div className="flex gap-8">
            {/* Filter Sidebar */}
            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="w-80 flex-shrink-0"
                >
                  <FilterSidebar filters={filters} onFilterChange={handleFilterChange} />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Listings Grid/List */}
            <div className="flex-1">
              {filteredListings.length === 0 ? (
                <div className="text-center py-20">
                  <i className="ri-inbox-line text-6xl text-gray-300 mb-4" />
                  <h3 className="text-xl font-semibold text-gray-600 mb-2">İlan Bulunamadı</h3>
                  <p className="text-gray-500">Filtrelerinizi değiştirmeyi deneyin</p>
                </div>
              ) : (
                <div
                  className={
                    viewMode === 'grid'
                      ? 'grid md:grid-cols-2 lg:grid-cols-3 gap-6'
                      : 'space-y-4'
                  }
                >
                  {filteredListings.map((listing, index) => (
                    <ListingCard
                      key={listing.id}
                      listing={listing}
                      viewMode={viewMode}
                      index={index}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <Footer />
      {/* AI Chat Panel */}
      <ChatBox />
    </div>
  );
}
