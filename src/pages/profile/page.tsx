
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import TopNavigation from '../../components/feature/TopNavigation';
import { supabase } from '../../lib/supabase';

export default function ProfilePage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resettingPin, setResettingPin] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [profileData, setProfileData] = useState({
    full_name: '',
    display_name: '',
    bio: '',
    location: '',
  });

  const [securityData, setSecurityData] = useState({
    phone: '',
    pin: '',
    confirmPin: '',
  });

  const [hasWhatsAppSecurity, setHasWhatsAppSecurity] = useState(false);

  const checkUser = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate('/auth/login');
        return;
      }

      setUser(user);

      // Profil bilgilerini al
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profile) {
        setProfileData({
          full_name: profile.full_name || '',
          display_name: profile.display_name || '',
          bio: profile.bio || '',
          location: profile.location || '',
        });
      }

      // WhatsApp güvenlik ayarı var mı kontrol et
      const { data: security } = await supabase
        .from('user_security')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (security && security.pin_hash) {
        setHasWhatsAppSecurity(true);
      }

    } catch (err) {
      console.error('Kullanıcı bilgileri alınamadı:', err);
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    void checkUser();
  }, [checkUser]);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          full_name: profileData.full_name,
          display_name: profileData.display_name,
          bio: profileData.bio,
          location: profileData.location,
        })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setSuccess('Profil bilgileriniz güncellendi!');
    } catch (err: any) {
      setError(err.message || 'Profil güncellenirken hata oluştu');
    } finally {
      setSaving(false);
    }
  };

  const handleWhatsAppSecuritySetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!securityData.phone || !securityData.pin) {
      setError('Telefon numarası ve PIN giriniz');
      return;
    }

    if (securityData.pin !== securityData.confirmPin) {
      setError('PIN kodları eşleşmiyor');
      return;
    }

    if (securityData.pin.length !== 4) {
      setError('PIN 4 haneli olmalıdır');
      return;
    }

    setSaving(true);

    try {
      // PIN hash oluştur
      const encoder = new TextEncoder();
      const data = encoder.encode(securityData.pin);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const pinHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      // RPC ile kaydet (duplicate phone gibi durumları DB tarafında güvenli şekilde çözer)
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('register_user_pin', {
          p_user_id: user.id,
          p_phone: securityData.phone,
          p_pin_hash: pinHash,
        });

      if (rpcError) throw rpcError;
      if (Array.isArray(rpcData) && rpcData.length > 0 && rpcData[0]?.success === false) {
        throw new Error(rpcData[0]?.message || 'Güvenlik ayarları kaydedilirken hata oluştu');
      }

      setSuccess('WhatsApp güvenlik ayarları kaydedildi!');
      setHasWhatsAppSecurity(true);
      setSecurityData({ phone: '', pin: '', confirmPin: '' });
    } catch (err: any) {
      setError(err.message || 'Güvenlik ayarları kaydedilirken hata oluştu');
    } finally {
      setSaving(false);
    }
  };

  const handleWhatsAppPinReset = async () => {
    setError('');
    setSuccess('');
    setResettingPin(true);

    try {
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('reset_user_pin', { p_user_id: user.id });

      if (rpcError) throw rpcError;
      if (Array.isArray(rpcData) && rpcData.length > 0 && rpcData[0]?.success === false) {
        throw new Error(rpcData[0]?.message || 'PIN sıfırlanırken hata oluştu');
      }

      setHasWhatsAppSecurity(false);
      setSecurityData({ phone: '', pin: '', confirmPin: '' });
      setSuccess('PIN sıfırlandı. Yeni PIN oluşturabilirsiniz.');
    } catch (err: any) {
      setError(err.message || 'PIN sıfırlanırken hata oluştu');
    } finally {
      setResettingPin(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-orange-50">
        <TopNavigation />
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Yükleniyor...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-orange-50">
      <TopNavigation />
      
      <div className="max-w-4xl mx-auto px-4 py-16">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Profil Ayarları</h1>
          <p className="text-gray-600">Hesap bilgilerinizi ve güvenlik ayarlarınızı yönetin</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-600">{success}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Profil Bilgileri */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Profil Bilgileri</h2>
            
            <form onSubmit={handleProfileUpdate} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ad Soyad
                </label>
                <input
                  type="text"
                  value={profileData.full_name}
                  onChange={(e) => setProfileData({ ...profileData, full_name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                  placeholder="Adınız ve soyadınız"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Görünen Ad
                </label>
                <input
                  type="text"
                  value={profileData.display_name}
                  onChange={(e) => setProfileData({ ...profileData, display_name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                  placeholder="Kullanıcı adınız"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Biyografi
                </label>
                <textarea
                  value={profileData.bio}
                  onChange={(e) => setProfileData({ ...profileData, bio: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm resize-none"
                  placeholder="Kendinizden bahsedin..."
                  maxLength={500}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Konum
                </label>
                <input
                  type="text"
                  value={profileData.location}
                  onChange={(e) => setProfileData({ ...profileData, location: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                  placeholder="Şehir, Ülke"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
              >
                {saving ? 'Kaydediliyor...' : 'Profili Güncelle'}
              </button>
            </form>
          </div>

          {/* WhatsApp Güvenlik Ayarları */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <div className="flex items-center gap-3 mb-6">
              <i className="ri-whatsapp-line text-3xl text-green-600"></i>
              <div>
                <h2 className="text-xl font-bold text-gray-900">WhatsApp Güvenliği</h2>
                <p className="text-sm text-gray-600">İsteğe bağlı 2 katmanlı güvenlik</p>
              </div>
            </div>

            {hasWhatsAppSecurity ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <i className="ri-shield-check-line text-3xl text-green-600"></i>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">WhatsApp Güvenliği Aktif</h3>
                <p className="text-sm text-gray-600 mb-6">
                  Hesabınız WhatsApp ile korunuyor
                </p>
                <div className="flex flex-col gap-3 items-center">
                  <button
                    onClick={() => setHasWhatsAppSecurity(false)}
                    className="text-sm text-teal-600 hover:text-teal-700 font-semibold cursor-pointer"
                    disabled={saving || resettingPin}
                  >
                    Ayarları Değiştir
                  </button>

                  <button
                    onClick={handleWhatsAppPinReset}
                    className="text-sm text-red-600 hover:text-red-700 font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={saving || resettingPin}
                  >
                    {resettingPin ? 'PIN sıfırlanıyor...' : 'PIN\'i Sıfırla'}
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleWhatsAppSecuritySetup} className="space-y-6">
                <div className="bg-teal-50 border border-teal-200 rounded-lg p-4 mb-6">
                  <p className="text-sm text-teal-800">
                    <i className="ri-information-line mr-2"></i>
                    WhatsApp güvenliği ile hesabınıza ekstra koruma ekleyin. Telefon numaranız ve PIN kodunuz ile giriş yapabilirsiniz.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Telefon Numarası
                  </label>
                  <input
                    type="tel"
                    value={securityData.phone}
                    onChange={(e) => setSecurityData({ ...securityData, phone: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                    placeholder="+90 5XX XXX XX XX"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    4 Haneli PIN
                  </label>
                  <input
                    type="password"
                    value={securityData.pin}
                    onChange={(e) => setSecurityData({ ...securityData, pin: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                    placeholder="****"
                    maxLength={4}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    PIN Tekrar
                  </label>
                  <input
                    type="password"
                    value={securityData.confirmPin}
                    onChange={(e) => setSecurityData({ ...securityData, confirmPin: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                    placeholder="****"
                    maxLength={4}
                  />
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
                >
                  {saving ? 'Kaydediliyor...' : 'WhatsApp Güvenliğini Aktifleştir'}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Çıkış Yap */}
        <div className="mt-8 text-center">
          <button
            onClick={handleLogout}
            className="text-red-600 hover:text-red-700 font-semibold cursor-pointer"
          >
            <i className="ri-logout-box-line mr-2"></i>
            Çıkış Yap
          </button>
        </div>
      </div>
    </div>
  );
}
