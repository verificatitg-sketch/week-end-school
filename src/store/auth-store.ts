import { create } from 'zustand';

interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role?: string;
  roleId?: string;
  language?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  setAuth: (user: User, token: string) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
  initialize: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,

  setAuth: (user, token) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('weds_token', token);
      localStorage.setItem('weds_user', JSON.stringify(user));
    }
    set({ user, token, isAuthenticated: true, isLoading: false });
  },

  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('weds_token');
      localStorage.removeItem('weds_user');
    }
    set({ user: null, token: null, isAuthenticated: false, isLoading: false });
  },

  setLoading: (loading) => set({ isLoading: loading }),

  initialize: () => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('weds_token');
      const userStr = localStorage.getItem('weds_user');
      if (token && userStr) {
        try {
          const user = JSON.parse(userStr);
          set({ user, token, isAuthenticated: true, isLoading: false });
        } catch {
          set({ isLoading: false });
        }
      } else {
        set({ isLoading: false });
      }
    }
  },
}));
