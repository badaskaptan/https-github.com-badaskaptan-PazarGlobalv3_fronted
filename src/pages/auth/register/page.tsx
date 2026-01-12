import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TopNavigation from '../../../components/feature/TopNavigation';
import { supabase } from '../../../lib/supabase';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validasyon
    if (!formData.name || !formData.email || !formData.phone || !formData.password) {
      setError('Lütfen tüm alanları doldurun');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Şifreler eşleşmiyor');
      return;
    }

    if (formData.password.length < 6) {
      setError('Şifre en az 6 karakter olmalıdır');
      return;
    }

    setLoading(true);

    try {
      // ⚠️ GÜVENLİK: Telefon numarasının daha önce kullanılıp kullanılmadığını kontrol et
      const { data: existingPhone } = await supabase
        .from('profiles')
        .select('id, phone')
        .eq('phone', formData.phone)
        .limit(1);

      if (existingPhone && existingPhone.length > 0) {
        throw new Error('Bu telefon numarası zaten kayıtlı. Lütfen giriş yapın veya farklı bir numara kullanın.');
      }

      // Supabase Auth ile kayıt
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/login`,
          data: {
            full_name: formData.name,
            display_name: formData.name,
            phone: formData.phone,
          },
        },
      });

      if (authError) {
        throw authError;
      }

      if (authData.user) {
        // Profil bilgilerini güncelle
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            full_name: formData.name,
            display_name: formData.name,
            phone: formData.phone,
          })
          .eq('id', authData.user.id);

        if (profileError) {
          console.error('Profil güncelleme hatası:', profileError);
        }

        setSuccess('Kayıt başarılı! Giriş yapabilirsiniz.');
        
        setTimeout(() => {
          navigate('/auth/login');
        }, 2000);
      }
    } catch (err: any) {
      console.error('Kayıt hatası:', err);
      setError(err.message || 'Kayıt sırasında bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-orange-50">
      <TopNavigation />
      
      <div className="flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Kayıt Ol</h1>
              <p className="text-gray-600">Hemen ücretsiz hesap oluşturun</p>
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

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ad Soyad
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                  placeholder="Adınız ve soyadınız"
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  E-posta
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                  placeholder="ornek@email.com"
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Telefon Numarası
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                  placeholder="+90 5XX XXX XX XX"
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Şifre
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                  placeholder="En az 6 karakter"
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Şifre Tekrar
                </label>
                <input
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                  placeholder="Şifrenizi tekrar girin"
                  disabled={loading}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
              >
                {loading ? 'Kayıt Yapılıyor...' : 'Kayıt Ol'}
              </button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                Zaten hesabınız var mı?{' '}
                <button
                  onClick={() => navigate('/auth/login')}
                  className="text-teal-600 hover:text-teal-700 font-semibold cursor-pointer"
                >
                  Giriş Yap
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
