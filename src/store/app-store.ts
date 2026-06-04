export type ViewType =
  | 'dashboard'
  | 'courses'
  | 'course-detail'
  | 'opportunities'
  | 'community'
  | 'mentorship'
  | 'alerts'
  | 'sos'
  | 'admin'
  | 'account-management'
  | 'profile'
  | 'notifications'
  | 'login'
  | 'register'
  | 'my-courses';

interface AppState {
  currentView: ViewType;
  selectedCourseId: string | null;
  selectedOpportunityId: string | null;
  selectedPostId: string | null;
  selectedMentorId: string | null;
  sidebarOpen: boolean;
  chatbotOpen: boolean;
  language: 'fr' | 'en' | 'ew' | 'kab';
  highContrast: boolean;
  fontSize: 'small' | 'normal' | 'large' | 'xlarge';
  screenReader: boolean;

  setView: (view: ViewType) => void;
  setSelectedCourseId: (id: string | null) => void;
  setSelectedOpportunityId: (id: string | null) => void;
  setSelectedPostId: (id: string | null) => void;
  setSelectedMentorId: (id: string | null) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleChatbot: () => void;
  setChatbotOpen: (open: boolean) => void;
  setLanguage: (lang: 'fr' | 'en' | 'ew' | 'kab') => void;
  _hydrateLanguage: () => void;
  setHighContrast: (val: boolean) => void;
  setFontSize: (size: 'small' | 'normal' | 'large' | 'xlarge') => void;
  setScreenReader: (val: boolean) => void;
}

import { create } from 'zustand';

export const useAppStore = create<AppState>((set) => ({
  currentView: 'login',
  selectedCourseId: null,
  selectedOpportunityId: null,
  selectedPostId: null,
  selectedMentorId: null,
  sidebarOpen: false,
  chatbotOpen: false,
  language: 'fr',
  highContrast: false,
  fontSize: 'normal',
  screenReader: false,

  setView: (view) => set({ currentView: view, sidebarOpen: false }),
  setSelectedCourseId: (id) => set({ selectedCourseId: id }),
  setSelectedOpportunityId: (id) => set({ selectedOpportunityId: id }),
  setSelectedPostId: (id) => set({ selectedPostId: id }),
  setSelectedMentorId: (id) => set({ selectedMentorId: id }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleChatbot: () => set((s) => ({ chatbotOpen: !s.chatbotOpen })),
  setChatbotOpen: (open) => set({ chatbotOpen: open }),
  setLanguage: (lang) => {
    if (typeof window !== 'undefined') localStorage.setItem('weds_language', lang);
    set({ language: lang });
  },
  _hydrateLanguage: () => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('weds_language') as AppState['language'] | null;
      if (saved && ['fr', 'en', 'ew', 'kab'].includes(saved)) {
        set({ language: saved });
      }
    }
  },
  setHighContrast: (val) => set({ highContrast: val }),
  setFontSize: (size) => set({ fontSize: size }),
  setScreenReader: (val) => set({ screenReader: val }),
}));
