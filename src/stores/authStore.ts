import { create } from 'zustand';
import { supabase, authHelpers } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';

interface Profile {
  id: string;
  full_name: string | null;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
  location: string | null;
  bio: string | null;
  rating: number;
  is_verified: boolean;
}

interface CustomUser {
  id: string;
  phone: string;
  email: string;
  full_name: string;
  is_active: boolean;
}

interface AuthState {
  user: User | null;
  customUser: CustomUser | null;
  profile: Profile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  
  // Actions
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  loadUser: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ success: boolean; error?: string }>;
  verifySession: () => Promise<boolean>;
  checkAuth: () => Promise<boolean>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  customUser: null,
  profile: null,
  isLoading: true,
  isAuthenticated: false,

  // Session doğrulama (WhatsApp için)
  verifySession: async () => {
    try {
      const sessionToken = localStorage.getItem('session_token');
      const userId = localStorage.getItem('user_id');

      if (!sessionToken || !userId) {
        return false;
      }

      const { data, error } = await supabase.functions.invoke('auth-verify', {
        body: { session_token: sessionToken }
      });

      if (error || !data.success) {
        localStorage.removeItem('session_token');
        localStorage.removeItem('user_id');
        set({
          customUser: null,
          isAuthenticated: false,
        });
        return false;
      }

      // Kullanıcı bilgilerini al
      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (userData) {
        set({
          customUser: userData,
          isAuthenticated: true,
        });
        return true;
      }

      return false;
    } catch {
      return false;
    }
  },

  // Auth kontrolü (hem Supabase hem custom session)
  checkAuth: async () => {
    try {
      // Önce custom session kontrol et
      const sessionToken = localStorage.getItem('session_token');
      if (sessionToken) {
        const isValid = await get().verifySession();
        return isValid;
      }

      // Supabase auth kontrol et
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        set({
          user,
          isAuthenticated: true,
        });
        return true;
      }

      return false;
    } catch {
      return false;
    }
  },

  signIn: async (email: string, password: string) => {
    try {
      const { data, error } = await authHelpers.signIn(email, password);
      
      if (error) {
        return { success: false, error: error.message };
      }

      if (data.user) {
        // Profil bilgilerini getir
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .single();

        set({
          user: data.user,
          profile: profileData,
          isAuthenticated: true,
        });
      }

      return { success: true };
    } catch {
      return { success: false, error: 'Giriş yapılırken bir hata oluştu' };
    }
  },

  signUp: async (email: string, password: string, fullName: string) => {
    try {
      const { data, error } = await authHelpers.signUp(email, password, fullName);
      
      if (error) {
        return { success: false, error: error.message };
      }

      if (data.user) {
        // Profil oluştur
        await supabase.from('profiles').insert({
          id: data.user.id,
          email: data.user.email,
          full_name: fullName,
          display_name: fullName,
          is_verified: false,
          rating: 0,
        });

        set({
          user: data.user,
          isAuthenticated: true,
        });
      }

      return { success: true };
    } catch {
      return { success: false, error: 'Kayıt olurken bir hata oluştu' };
    }
  },

  signOut: async () => {
    // Custom session temizle
    localStorage.removeItem('session_token');
    localStorage.removeItem('user_id');
    
    // Supabase session temizle
    await authHelpers.signOut();
    
    set({
      user: null,
      customUser: null,
      profile: null,
      isAuthenticated: false,
    });
  },

  loadUser: async () => {
    try {
      set({ isLoading: true });
      
      // Önce custom session kontrol et
      const sessionToken = localStorage.getItem('session_token');
      const userId = localStorage.getItem('user_id');

      if (sessionToken && userId) {
        const isValid = await get().verifySession();
        if (isValid) {
          set({ isLoading: false });
          return;
        }
      }

      // Supabase auth kontrol et
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // Profil bilgilerini getir
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        set({
          user,
          profile: profileData,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        set({
          user: null,
          customUser: null,
          profile: null,
          isAuthenticated: false,
          isLoading: false,
        });
      }
    } catch {
      set({
        user: null,
        customUser: null,
        profile: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },

  updateProfile: async (updates: Partial<Profile>) => {
    try {
      const { user } = get();
      if (!user) {
        return { success: false, error: 'Kullanıcı girişi gerekli' };
      }

      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id)
        .select()
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      set({ profile: data });
      return { success: true };
    } catch {
      return { success: false, error: 'Profil güncellenirken bir hata oluştu' };
    }
  },
}));

// Auth state değişikliklerini dinle
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN' && session?.user) {
    useAuthStore.getState().loadUser();
  } else if (event === 'SIGNED_OUT') {
    useAuthStore.setState({
      user: null,
      customUser: null,
      profile: null,
      isAuthenticated: false,
    });
  }
});
