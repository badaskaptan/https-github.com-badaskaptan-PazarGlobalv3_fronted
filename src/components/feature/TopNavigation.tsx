
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

type TopNavigationProps = {
  isScrolled?: boolean;
};

export default function TopNavigation({ isScrolled: isScrolledProp }: TopNavigationProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isScrolledInternal, setIsScrolledInternal] = useState(false);
  const [user, setUser] = useState<any>(null);

  const isScrolled = typeof isScrolledProp === 'boolean' ? isScrolledProp : isScrolledInternal;

  useEffect(() => {
    // If parent controls scroll state, skip internal listener.
    if (typeof isScrolledProp === 'boolean') return;

    const handleScroll = () => {
      setIsScrolledInternal(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isScrolledProp]);

  useEffect(() => {
    checkUser();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
  };

  const isHomePage = location.pathname === '/';

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled || !isHomePage
          ? 'bg-white shadow-md'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <div
            onClick={() => navigate('/')}
            className="flex items-center gap-3 cursor-pointer"
          >
            <img
              src="/logo-readdy.png?v=1"
              alt="PazarGlobal"
              title="PazarGlobal"
              className="h-8 w-auto"
            />
            <span className="text-xl sm:text-2xl font-display font-bold leading-none">
              <span className="text-blue-800">Pazar</span>
              <span className="text-sky-400">Global</span>
            </span>
          </div>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center gap-8">
            <button
              onClick={() => navigate('/')}
              className={`font-medium transition-colors cursor-pointer whitespace-nowrap ${
                isScrolled || !isHomePage
                  ? 'text-gray-700 hover:text-teal-600'
                  : 'text-white hover:text-teal-200'
              }`}
            >
              Ana Sayfa
            </button>
            <button
              onClick={() => navigate('/listings')}
              className={`font-medium transition-colors cursor-pointer whitespace-nowrap ${
                isScrolled || !isHomePage
                  ? 'text-gray-700 hover:text-teal-600'
                  : 'text-white hover:text-teal-200'
              }`}
            >
              İlanlar
            </button>
            <button
              onClick={() => navigate('/about')}
              className={`font-medium transition-colors cursor-pointer whitespace-nowrap ${
                isScrolled || !isHomePage
                  ? 'text-gray-700 hover:text-teal-600'
                  : 'text-white hover:text-teal-200'
              }`}
            >
              Hakkımızda
            </button>
            <button
              onClick={() => navigate('/reviews')}
              className={`font-medium transition-colors cursor-pointer whitespace-nowrap ${
                isScrolled || !isHomePage
                  ? 'text-gray-700 hover:text-teal-600'
                  : 'text-white hover:text-teal-200'
              }`}
            >
              Yorumlar
            </button>
          </div>

          {/* Auth Buttons */}
          <div className="flex items-center gap-4">
            {user ? (
              <>
                <button
                  onClick={() => navigate('/create-listing')}
                  className="hidden md:block bg-teal-600 hover:bg-teal-700 text-white font-semibold px-6 py-2.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                >
                  İlan Ver
                </button>
                <button
                  onClick={() => navigate('/profile/listings')}
                  className={`font-medium transition-colors cursor-pointer whitespace-nowrap flex items-center gap-2 ${
                    isScrolled || !isHomePage
                      ? 'text-gray-700 hover:text-teal-600'
                      : 'text-white hover:text-teal-200'
                  }`}
                >
                  <i className="ri-folder-user-line text-xl"></i>
                  <span className="hidden md:inline">İlanlarım</span>
                </button>
                <button
                  onClick={() => navigate('/profile')}
                  className={`font-medium transition-colors cursor-pointer whitespace-nowrap flex items-center gap-2 ${
                    isScrolled || !isHomePage
                      ? 'text-gray-700 hover:text-teal-600'
                      : 'text-white hover:text-teal-200'
                  }`}
                >
                  <i className="ri-user-line text-xl"></i>
                  <span className="hidden md:inline">Profil</span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => navigate('/auth/login')}
                  className={`font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    isScrolled || !isHomePage
                      ? 'text-gray-700 hover:text-teal-600'
                      : 'text-white hover:text-teal-200'
                  }`}
                >
                  Giriş Yap
                </button>
                <button
                  onClick={() => navigate('/auth/register')}
                  className="bg-teal-600 hover:bg-teal-700 text-white font-semibold px-6 py-2.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                >
                  Kayıt Ol
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
