import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import TopNavigation from '../../../components/feature/TopNavigation';
import Footer from '../../home/components/Footer';
import { supabase, listingHelpers } from '../../../lib/supabase';
import { FALLBACK_CATEGORY_OPTIONS } from '../../../constants/categories';
import { toCanonicalCondition } from '../../../lib/condition';
import type { DBListing } from '../../../services/supabase';

const CONDITIONS: Array<ReturnType<typeof toCanonicalCondition>> = ['Sıfır', '2. El', 'Az Kullanılmış'];

// Toast bileşeni - otomatik kaybolan bildirim
const Toast = ({ message, type }: { message: string; type: 'success' | 'error' }) => (
  <div className={`fixed top-6 right-6 px-6 py-3 rounded-full shadow-lg text-white font-medium z-[60] animate-in fade-in slide-in-from-top-2 ${
    type === 'success' ? 'bg-green-500' : 'bg-red-500'
  }`}>
    {message}
  </div>
);

export default function ManageListingsPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [listings, setListings] = useState<DBListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedListing, setSelectedListing] = useState<DBListing | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [formState, setFormState] = useState({
    title: '',
    description: '',
    price: '',
    category: '',
    condition: '',
    location: '',
  });
  
  // Görsel yönetimi
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [uploadPreviews, setUploadPreviews] = useState<string[]>([]);
  const [deletedImagePaths, setDeletedImagePaths] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [imageStatusMessage, setImageStatusMessage] = useState('');

  const categoryOptions = useMemo(() => FALLBACK_CATEGORY_OPTIONS ?? [], []);

  const fetchUserListings = useCallback(async (uid: string) => {
    setLoading(true);
    setError('');
    try {
      const { data, error: fetchError } = await listingHelpers.getUserListings(uid);
      if (fetchError) throw fetchError;
      setListings(data ?? []);
    } catch (err: any) {
      console.error('İlanlar alınamadı:', err);
      setError(err.message || 'İlanlar yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          navigate('/auth/login');
          return;
        }
        setUserId(user.id);
        void fetchUserListings(user.id);
      } catch (err) {
        console.error('Kullanıcı doğrulanamadı:', err);
        navigate('/auth/login');
      }
    })();
  }, [fetchUserListings, navigate]);

  const openEditModal = (listing: DBListing) => {
    setSelectedListing(listing);
    setFormState({
      title: listing.title || '',
      description: listing.description || '',
      price: listing.price ? String(listing.price) : '',
      category: listing.category || '',
      condition: toCanonicalCondition(listing.condition) || '2. El',
      location: listing.location || '',
    });
    setUploadedFiles([]);
    setUploadPreviews([]);
    setDeletedImagePaths([]);
    setImageStatusMessage('');
    setSuccess('');
    setError('');
    setEditModalOpen(true);
  };

  const closeModal = () => {
    setEditModalOpen(false);
    setSelectedListing(null);
    setUploadedFiles([]);
    setUploadPreviews([]);
    setDeletedImagePaths([]);
    setImageStatusMessage('');
  };

  const handleFormChange = (field: keyof typeof formState, value: string) => {
    setFormState(prev => ({ ...prev, [field]: value }));
  };

  // Görsel dosya seçimi
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setImageStatusMessage('');
    setUploadingImages(true);

    try {
      const newPreviews: string[] = [];
      
      for (const file of files) {
        if (!file.type.startsWith('image/')) {
          throw new Error('Lütfen sadece görsel dosyası seçin');
        }
        if (file.size > 10 * 1024 * 1024) {
          throw new Error(`${file.name} 10MB'dan büyük`);
        }
        
        const reader = new FileReader();
        reader.onload = (event) => {
          newPreviews.push(event.target?.result as string);
        };
        reader.readAsDataURL(file);
      }

      // Previewler yüklendikten sonra state güncelle
      await new Promise(resolve => setTimeout(resolve, 100));
      setUploadedFiles(prev => [...prev, ...files]);
      setUploadPreviews(prev => [...prev, ...newPreviews]);
      setImageStatusMessage(`✅ ${files.length} fotoğraf eklendi`);
    } catch (err: any) {
      setError(err.message || 'Fotoğraf yüklenemedi');
    } finally {
      setUploadingImages(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Yeni eklenen görseli sil
  const removeUploadedImage = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
    setUploadPreviews(prev => prev.filter((_, i) => i !== index));
    setImageStatusMessage(`❌ Fotoğraf kaldırıldı`);
  };

  // Mevcut görseli silim listesine ekle
  const markImageForDeletion = (path: string) => {
    setDeletedImagePaths(prev => [...prev, path]);
    setImageStatusMessage(`❌ Fotoğraf silinecek`);
  };

  // Silinmek için işaretlenmiş görseli geri al
  const unmarkImageForDeletion = (path: string) => {
    setDeletedImagePaths(prev => prev.filter(p => p !== path));
    setImageStatusMessage('✓ Silme iptal edildi');
  };

  // Supabase'e görselleri yükle
  const uploadImagesToStorage = async (): Promise<string[]> => {
    const uploadedPaths: string[] = [];

    if (uploadedFiles.length === 0) return uploadedPaths;

    for (const file of uploadedFiles) {
      try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
        const filePath = `${userId}/${selectedListing?.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(filePath, file);

        if (uploadError) throw uploadError;
        uploadedPaths.push(filePath);
      } catch (err: any) {
        console.error('Upload error:', err);
        throw new Error(`Görsel yüklenemedi: ${err.message}`);
      }
    }

    return uploadedPaths;
  };

  // Supabase'den görselleri sil
  const deleteImagesFromStorage = async () => {
    if (deletedImagePaths.length === 0) return;

    for (const path of deletedImagePaths) {
      try {
        const { error: deleteError } = await supabase.storage
          .from('product-images')
          .remove([path]);
        if (deleteError) console.warn('Storage delete warning:', deleteError);
      } catch (err) {
        console.warn('Delete warning:', err);
      }
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedListing) return;

    if (!formState.title.trim()) {
      setError('Başlık gerekli');
      return;
    }

    if (!formState.price) {
      setError('Fiyat gerekli');
      return;
    }

    const numericPrice = Number(formState.price);
    if (Number.isNaN(numericPrice) || numericPrice <= 0) {
      setError('Geçerli bir fiyat girin');
      return;
    }

    if (!formState.category) {
      setError('Kategori seçmelisiniz');
      return;
    }

    if (!formState.condition) {
      setError('Durum seçmelisiniz');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');
    setImageStatusMessage('');

    try {
      // 1. Görselleri Storage'a yükle
      const newImagePaths = await uploadImagesToStorage();

      // 2. Silinecek görselleri Storage'dan sil
      await deleteImagesFromStorage();

      // 3. Mevcut görselleri derle (silinmeyecekler)
      const currentImagePaths = Array.isArray(selectedListing.images)
        ? selectedListing.images
          .map(img => typeof img === 'string' ? img : (img as any)?.path || (img as any)?.url)
          .filter((path): path is string => 
            path && !deletedImagePaths.includes(path)
          )
        : [];

      // Tüm görselleri birleştir (mevcut + yeni)
      const allImagePaths = [...currentImagePaths, ...newImagePaths];

      // 4. İlk görsel URL'sini belirle
      const firstImagePath = allImagePaths[0];
      const imageUrl = firstImagePath ? toPublicUrl(firstImagePath) : selectedListing.image_url;

      // 5. Veritabanını güncelle
      const payload = {
        title: formState.title.trim(),
        description: formState.description.trim(),
        price: numericPrice,
        category: formState.category,
        condition: formState.condition,
        location: formState.location.trim(),
        images: allImagePaths,
        image_url: imageUrl,
      };

      const { error: updateError } = await listingHelpers.update(selectedListing.id, payload);
      if (updateError) throw updateError;

      setSuccess('✅ İlan başarıyla güncellendi');
      setTimeout(() => {
        closeModal();
        if (userId) {
          void fetchUserListings(userId);
        }
      }, 800);
    } catch (err: any) {
      console.error('İlan güncellenemedi:', err);
      setError(err.message || 'İlan güncellenirken hata oluştu');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (listingId: string) => {
    if (!window.confirm('Bu ilanı silmek istediğinizden emin misiniz?')) {
      return;
    }

    setDeletingId(listingId);
    setError('');
    setSuccess('');

    try {
      const { error: deleteError } = await listingHelpers.delete(listingId);
      if (deleteError) throw deleteError;
      setSuccess('✅ İlan silindi');
      setTimeout(() => {
        setListings(prev => prev.filter(item => item.id !== listingId));
      }, 600);
    } catch (err: any) {
      console.error('Silme hatası:', err);
      setError(err.message || 'İlan silinemedi');
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (value: string) => {
    try {
      const date = new Date(value);
      return date.toLocaleDateString('tr-TR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return value;
    }
  };

  const toPublicUrl = (value?: string | null) => {
    if (!value) return '';
    if (/^https?:/i.test(value)) return value;
    const { data } = supabase.storage.from('product-images').getPublicUrl(value);
    return data.publicUrl || '';
  };

  const primaryImage = (listing: DBListing) => {
    if (listing.image_url) return toPublicUrl(listing.image_url);
    if (Array.isArray(listing.images) && listing.images.length > 0) {
      const entry = listing.images[0];
      if (typeof entry === 'string') return toPublicUrl(entry);
      if (typeof entry === 'object') {
        const candidate = (entry as any).public_url || (entry as any).image_url || (entry as any).url || (entry as any).path;
        return toPublicUrl(candidate);
      }
    }
    return 'https://via.placeholder.com/400x300?text=Ilan';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-cyan-50">
      <TopNavigation isScrolled />
      
      {/* Toast Bildirimi */}
      {success && <Toast message={success} type="success" />}
      {error && <Toast message={error} type="error" />}
      <div className="pt-24 pb-16">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-4xl font-display font-bold text-gray-900 mb-2">
                <span className="bg-gradient-primary bg-clip-text text-transparent">İlanlarım</span>
              </h1>
              <p className="text-gray-600">{listings.length} ilan bulundu</p>
            </div>
            <div className="flex items-center gap-3">
              {/* View Mode Toggle */}
              <div className="flex items-center bg-white rounded-full shadow-md p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                    viewMode === 'grid' ? 'bg-gradient-primary text-white' : 'text-gray-600 hover:text-gray-900'
                  }`}
                  aria-label="Izgara görünümü"
                  title="Izgara görünümü"
                >
                  <i className="ri-grid-line text-lg" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                    viewMode === 'list' ? 'bg-gradient-primary text-white' : 'text-gray-600 hover:text-gray-900'
                  }`}
                  aria-label="Liste görünümü"
                  title="Liste görünümü"
                >
                  <i className="ri-list-check text-lg" />
                </button>
              </div>
              <button
                onClick={() => navigate('/create-listing')}
                className="px-6 py-3 bg-gradient-primary text-white font-semibold rounded-full shadow-lg hover:shadow-xl transition-all whitespace-nowrap cursor-pointer"
              >
                Yeni İlan Oluştur
              </button>
            </div>
          </div>

          {(error || success) && (
            <div className={`mb-6 rounded-2xl border px-4 py-3 text-sm ${error ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'}`}>
              {error || success}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-24">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-purple-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-gray-500">İlanlar yükleniyor...</p>
              </div>
            </div>
          ) : listings.length === 0 ? (
            <div className="bg-white rounded-3xl shadow-lg p-10 text-center">
              <i className="ri-folder-open-line text-5xl text-gray-300 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Henüz ilanınız yok</h3>
              <p className="text-gray-600 mb-6">İlk ilanınızı oluşturup satışa başlayın.</p>
              <button
                onClick={() => navigate('/create-listing')}
                className="px-6 py-3 bg-gradient-primary text-white font-semibold rounded-full shadow-lg hover:shadow-xl transition-all whitespace-nowrap cursor-pointer"
              >
                İlan Oluştur
              </button>
            </div>
          ) : (
            <div className={viewMode === 'grid' ? 'grid md:grid-cols-2 lg:grid-cols-3 gap-6' : 'space-y-5'}>
              {listings.map(listing => (
                viewMode === 'grid' ? (
                  // Grid View (Kart Görünümü)
                  <div key={listing.id} className="bg-white rounded-3xl shadow-lg overflow-hidden group hover:shadow-xl transition-all">
                    <div className="relative h-56 bg-gray-100 overflow-hidden">
                      <img
                        src={primaryImage(listing)}
                        alt={listing.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute top-3 right-3 flex flex-col gap-2">
                        <button
                          onClick={() => openEditModal(listing)}
                          className="w-10 h-10 rounded-full bg-blue-500 text-white hover:bg-blue-600 transition-all cursor-pointer flex items-center justify-center shadow-lg"
                          title="Düzenle"
                        >
                          <i className="ri-edit-line text-lg" />
                        </button>
                        <button
                          onClick={() => handleDelete(listing.id)}
                          disabled={deletingId === listing.id}
                          className="w-10 h-10 rounded-full bg-red-500 text-white hover:bg-red-600 transition-all cursor-pointer flex items-center justify-center shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Sil"
                        >
                          <i className={deletingId === listing.id ? 'ri-loader-4-line animate-spin text-lg' : 'ri-delete-bin-line text-lg'} />
                        </button>
                      </div>
                      <div className="absolute bottom-3 left-3 flex gap-2">
                        <span className="px-3 py-1 bg-white/90 backdrop-blur-sm text-gray-700 text-xs font-semibold rounded-full">
                          {listing.category || 'Kategori Yok'}
                        </span>
                        <span className="px-3 py-1 bg-green-500/90 backdrop-blur-sm text-white text-xs font-semibold rounded-full">
                          {toCanonicalCondition(listing.condition) || listing.condition || '2. El'}
                        </span>
                      </div>
                    </div>
                    <div className="p-5">
                      <h3 className="text-xl font-bold text-gray-900 mb-2 line-clamp-1">{listing.title}</h3>
                      <p className="text-gray-600 text-sm line-clamp-2 mb-4">{listing.description || 'Açıklama eklenmemiş'}</p>
                      <div className="flex items-center justify-between">
                        <div className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                          {(listing.price ?? 0).toLocaleString('tr-TR')} ₺
                        </div>
                        <button
                          onClick={() => navigate(`/listing/${listing.id}`)}
                          className="px-4 py-2 rounded-full border border-gray-200 text-gray-600 hover:border-purple-500 hover:text-purple-600 transition-all cursor-pointer text-sm"
                        >
                          Detay
                        </button>
                      </div>
                      <div className="mt-3 text-xs text-gray-500 flex items-center">
                        <i className="ri-calendar-line mr-1" />
                        {formatDate(listing.created_at)}
                      </div>
                    </div>
                  </div>
                ) : (
                  // List View (Liste Görünümü)
                  <div key={listing.id} className="bg-white rounded-3xl shadow-lg p-6 flex flex-col md:flex-row gap-6">
                    <div className="w-full md:w-48 h-40 rounded-2xl overflow-hidden bg-gray-100 flex-shrink-0">
                      <img
                        src={primaryImage(listing)}
                        alt={listing.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 grid gap-4">
                      <div className="flex flex-col gap-2">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="px-3 py-1 bg-gray-100 text-gray-700 text-xs font-semibold rounded-full">
                            {listing.category || 'Kategori Yok'}
                          </span>
                          <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                            {toCanonicalCondition(listing.condition) || listing.condition || '2. El'}
                          </span>
                          <span className="text-xs text-gray-500">{formatDate(listing.created_at)}</span>
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900">{listing.title}</h3>
                        <p className="text-gray-600 line-clamp-2">{listing.description || 'Açıklama eklenmemiş'}</p>
                      </div>
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                          {(listing.price ?? 0).toLocaleString('tr-TR')} ₺
                        </div>
                        <div className="flex flex-wrap gap-3">
                          <button
                            onClick={() => navigate(`/listing/${listing.id}`)}
                            className="px-4 py-2 rounded-full border border-gray-200 text-gray-600 hover:border-gray-400 transition-all cursor-pointer"
                          >
                            İlanı Gör
                          </button>
                          <button
                            onClick={() => openEditModal(listing)}
                            className="px-4 py-2 rounded-full bg-blue-50 text-blue-700 hover:bg-blue-100 transition-all cursor-pointer"
                          >
                            Düzenle
                          </button>
                          <button
                            onClick={() => handleDelete(listing.id)}
                            disabled={deletingId === listing.id}
                            className="px-4 py-2 rounded-full bg-red-50 text-red-600 hover:bg-red-100 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {deletingId === listing.id ? 'Siliniyor...' : 'Sil'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              ))}
            </div>
          )}
        </div>
      </div>

      {editModalOpen && selectedListing && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 px-4 max-h-screen overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl p-8 relative my-8">
            <button
              onClick={closeModal}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 cursor-pointer"
            >
              <i className="ri-close-line text-2xl" />
            </button>
            <h2 className="text-2xl font-bold mb-6 text-gray-900">İlanı Düzenle</h2>
            
            {/* Modal Error */}
            {error && (
              <div className="mb-4 p-3 rounded-2xl bg-red-50 border border-red-200 text-sm text-red-700">
                {error}
              </div>
            )}
            
            <form onSubmit={handleUpdate} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Başlık</label>
                <input
                  value={formState.title}
                  onChange={e => handleFormChange('title', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  maxLength={120}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Açıklama</label>
                <textarea
                  value={formState.description}
                  onChange={e => handleFormChange('description', e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fiyat (₺)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formState.price}
                    onChange={e => handleFormChange('price', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
                  <select
                    value={formState.category}
                    onChange={e => handleFormChange('category', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="">Kategori Seçin</option>
                    {categoryOptions.map(option => (
                      <option key={option.id} value={option.id}>{option.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Durum</label>
                  <select
                    value={formState.condition}
                    onChange={e => handleFormChange('condition', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    {CONDITIONS.map(condition => (
                      <option key={condition} value={condition || ''}>{condition}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Konum</label>
                  <input
                    value={formState.location}
                    onChange={e => handleFormChange('location', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Fotoğraf Yönetimi */}
              <div className="border-t pt-5">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Fotoğraf Yönetimi</h3>
                
                {imageStatusMessage && (
                  <div className="mb-4 p-3 rounded-2xl bg-blue-50 border border-blue-200 text-sm text-blue-700">
                    {imageStatusMessage}
                  </div>
                )}

                {/* Mevcut Fotoğraflar */}
                {Array.isArray(selectedListing.images) && selectedListing.images.length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Mevcut Fotoğraflar</h4>
                    <div className="grid grid-cols-3 gap-3">
                      {selectedListing.images
                        .map((img, idx) => {
                          const path = typeof img === 'string' ? img : (img as any)?.path || (img as any)?.url;
                          return { path, idx };
                        })
                        .filter(({ path }) => path && !deletedImagePaths.includes(path as string))
                        .map(({ path, idx }) => (
                          <div
                            key={`existing-${idx}`}
                            className="relative group rounded-lg overflow-hidden bg-gray-200 aspect-square"
                          >
                            <img
                              src={toPublicUrl(path)}
                              alt="Fotoğraf"
                              className="w-full h-full object-cover"
                            />
                            <button
                              type="button"
                              onClick={() => markImageForDeletion(path as string)}
                              className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                            >
                              <div className="bg-red-600 text-white px-3 py-2 rounded-lg flex items-center gap-1 text-xs font-medium">
                                <i className="ri-delete-bin-line" />
                                Sil
                              </div>
                            </button>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Silinmek İçin İşaretlenen Fotoğraflar */}
                {deletedImagePaths.length > 0 && (
                  <div className="mb-6 p-3 rounded-2xl bg-red-50 border border-red-200">
                    <p className="text-sm font-medium text-red-700 mb-2">Silinecek Fotoğraflar ({deletedImagePaths.length})</p>
                    <div className="flex flex-wrap gap-2">
                      {deletedImagePaths.map(path => (
                        <button
                          key={`delete-${path}`}
                          type="button"
                          onClick={() => unmarkImageForDeletion(path)}
                          className="px-3 py-1 rounded-full bg-red-200 text-red-700 text-xs font-medium hover:bg-red-300 transition-colors cursor-pointer"
                        >
                          {path.split('/').pop()} <i className="ri-close-line ml-1" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Yeni Fotoğraf Yükle */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">Yeni Fotoğraf Ekle</label>
                  <label className="block p-6 rounded-2xl border-2 border-dashed border-purple-300 bg-purple-50 text-center cursor-pointer hover:border-purple-500 transition-colors">
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleImageSelect}
                      disabled={uploadingImages}
                      className="hidden"
                    />
                    <div>
                      <i className="ri-image-add-line text-3xl text-purple-600 mb-2" />
                      <p className="text-sm font-medium text-gray-900">Fotoğraf seçmek için tıklayın</p>
                      <p className="text-xs text-gray-600 mt-1">veya sürükleyip bırakın</p>
                      <p className="text-xs text-gray-500 mt-2">PNG, JPG, GIF (Max 10MB)</p>
                    </div>
                  </label>
                </div>

                {/* Yeni Yüklenen Fotoğraflar */}
                {uploadPreviews.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm font-medium text-gray-700 mb-3">Yeni Fotoğraflar ({uploadPreviews.length})</p>
                    <div className="grid grid-cols-3 gap-3">
                      {uploadPreviews.map((preview, idx) => (
                        <div
                          key={`new-${idx}`}
                          className="relative group rounded-lg overflow-hidden bg-gray-200 aspect-square"
                        >
                          <img
                            src={preview}
                            alt="Yeni Fotoğraf"
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => removeUploadedImage(idx)}
                            className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                          >
                            <div className="bg-red-600 text-white px-3 py-2 rounded-lg flex items-center gap-1 text-xs font-medium">
                              <i className="ri-delete-bin-line" />
                              Kaldır
                            </div>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Form Butonları */}
              <div className="flex items-center justify-end gap-4 pt-4 border-t">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-5 py-3 rounded-full border border-gray-200 text-gray-600 hover:border-gray-400 transition-all cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={saving || uploadingImages}
                  className="px-6 py-3 rounded-full bg-gradient-primary text-white font-semibold shadow-lg hover:shadow-xl transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {saving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Kaydediliyor...
                    </>
                  ) : (
                    <>
                      <i className="ri-save-line" />
                      Güncelle
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
