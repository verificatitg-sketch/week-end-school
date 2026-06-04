'use client';

import React from 'react';
import Image from 'next/image';
import { useAppStore, ViewType } from '@/store/app-store';
import { useAuthStore } from '@/store/auth-store';
import { useSosStore } from '@/store/sos-store';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { LANGUAGE_NAMES, LANGUAGE_FLAGS, Language } from '@/lib/i18n/translations';
import { SosAdminIncomingCall, SosAdminActiveCall } from '@/components/sos/sos-admin-receiver';
import { GlobalSosButton } from '@/components/sos/sos-global-button';
import { LoginView } from '@/components/views/login-view';
import { RegisterView } from '@/components/views/register-view';
import { DashboardView } from '@/components/views/dashboard-view';
import { CoursesView } from '@/components/views/courses-view';
import { CourseDetailView } from '@/components/views/course-detail-view';
import { MyCoursesView } from '@/components/views/my-courses-view';
import { OpportunitiesView } from '@/components/views/opportunities-view';
import { CommunityView } from '@/components/views/community-view';
import { MentorshipView } from '@/components/views/mentorship-view';
import { AlertsView } from '@/components/views/alerts-view';
import { SOSView } from '@/components/views/sos-view';
import { AdminView } from '@/components/views/admin-view';
import { AccountManagementView } from '@/components/views/account-management-view';
import { ProfileView } from '@/components/views/profile-view';
import { NotificationsView } from '@/components/views/notifications-view';
import {
  LayoutDashboard,
  BookOpen,
  GraduationCap,
  Briefcase,
  Users,
  HandHelping,
  AlertTriangle,
  Siren,
  Shield,
  User,
  Bell,
  Menu,
  X,
  Bot,
  LogOut,
  Heart,
  Globe,
  Eye,
  BookMarked,
  CheckCircle2,
  Home,
  MessageCircle,
  Settings,
  ChevronRight,
  Phone,
  Star,
  UserCog,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

// ==================== PAIXBOT CHAT ====================
function PaixbotChat() {
  const { chatbotOpen, setChatbotOpen, language } = useAppStore();
  const { token } = useAuthStore();
  const { t } = useTranslation();
  const [messages, setMessages] = React.useState<Array<{ role: string; content: string }>>([
    {
      role: 'assistant',
      content: t('common.appName') + ' — ' + t('auth.motto'),
    },
  ]);
  const [input, setInput] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    const userMessage = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const res = await fetch('/api/chatbot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message: userMessage, language }),
      });
      const data = await res.json();
      if (data.response) {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.response }]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: t('common.error') },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: t('common.offline') },
      ]);
    }
    setIsLoading(false);
  };

  if (!chatbotOpen) return null;

  return (
    <div className="fixed bottom-20 right-3 z-50 w-[calc(100%-1.5rem)] sm:w-96 h-[450px] sm:h-[500px] bg-background border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-weds-blue text-white p-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm">PAIXBOT</h3>
            <p className="text-[10px] text-weds-blue-100">24h/24 • Online</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-white/20 h-8 w-8"
          onClick={() => setChatbotOpen(false)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              'max-w-[85%] p-2.5 rounded-xl text-sm leading-relaxed',
              msg.role === 'user'
                ? 'ml-auto bg-weds-blue text-white rounded-br-sm'
                : 'bg-muted rounded-bl-sm'
            )}
          >
            {msg.content}
          </div>
        ))}
        {isLoading && (
          <div className="bg-muted p-2.5 rounded-xl rounded-bl-sm max-w-[85%] text-sm">
            <div className="flex gap-1">
              <span className="w-2 h-2 bg-weds-blue rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 bg-weds-blue rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 bg-weds-blue rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-2.5 border-t shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage();
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t('sos.chatPlaceholder')}
            className="flex-1 px-3 py-2 bg-muted rounded-lg text-sm outline-none focus:ring-2 focus:ring-weds-blue"
          />
          <Button type="submit" size="sm" className="bg-weds-blue hover:bg-weds-blue-700 text-white" disabled={isLoading}>
            →
          </Button>
        </form>
      </div>
    </div>
  );
}

// ==================== SOS FLOATING BUTTON (replaced by GlobalSosButton) ====================

// ==================== DRAWER NAV (Mobile) ====================
function DrawerNav({ onNavigate }: { onNavigate?: () => void }) {
  const { currentView, setView } = useAppStore();
  const { user, logout } = useAuthStore();
  const { t } = useTranslation();

  const mainItems: Array<{ view: ViewType; label: string; icon: React.ReactNode; color?: string }> = [
    { view: 'my-courses', label: t('nav.myCourses'), icon: <BookMarked className="h-5 w-5" /> },
    { view: 'opportunities', label: t('nav.opportunities'), icon: <Briefcase className="h-5 w-5" /> },
    { view: 'mentorship', label: t('nav.mentorship'), icon: <HandHelping className="h-5 w-5" /> },
    { view: 'alerts', label: t('nav.alerts'), icon: <AlertTriangle className="h-5 w-5" /> },
    { view: 'notifications', label: t('nav.notifications'), icon: <Bell className="h-5 w-5" /> },
  ];

  const adminItems: Array<{ view: ViewType; label: string; icon: React.ReactNode }> = [
    { view: 'admin', label: t('nav.admin'), icon: <Shield className="h-5 w-5" /> },
    { view: 'account-management', label: t('nav.accountManagement'), icon: <UserCog className="h-5 w-5" /> },
  ];

  const isActive = (view: ViewType) => currentView === view;

  const isAdmin = (user?.role as Record<string, unknown>)?.name === 'SUPER_ADMIN' || (user?.role as Record<string, unknown>)?.name === 'ADMIN' || (typeof user?.role === 'string' && (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN'));

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="p-4 border-b bg-weds-blue text-white">
        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12 border-2 border-weds-gold">
            <AvatarFallback className="bg-weds-blue-800 text-weds-gold text-lg font-bold">
              {user?.name?.charAt(0) || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate">{user?.name || 'User'}</p>
            <p className="text-xs text-weds-blue-100 truncate">{user?.email}</p>
          </div>
        </div>
      </div>

      {/* Nav Items */}
      <ScrollArea className="flex-1 py-2">
        <nav className="space-y-0.5 px-2">
          {mainItems.map((item) => (
            <button
              key={item.view}
              onClick={() => {
                setView(item.view);
                onNavigate?.();
              }}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors',
                isActive(item.view)
                  ? 'bg-weds-blue-50 text-weds-blue font-medium'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              {item.icon}
              {item.label}
              <ChevronRight className="h-4 w-4 ml-auto opacity-40" />
            </button>
          ))}

          {isAdmin && (
            <>
              <Separator className="my-2" />
              {adminItems.map((item) => (
                <button
                  key={item.view}
                  onClick={() => {
                    setView(item.view);
                    onNavigate?.();
                  }}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors',
                    isActive(item.view)
                      ? 'bg-weds-blue-50 text-weds-blue font-medium'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  {item.icon}
                  {item.label}
                  <ChevronRight className="h-4 w-4 ml-auto opacity-40" />
                </button>
              ))}
            </>
          )}
        </nav>
      </ScrollArea>

      {/* Footer */}
      <div className="p-3 border-t space-y-1">
        <button
          onClick={() => {
            logout();
            setView('login');
          }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-weds-red hover:bg-weds-red-50 transition-colors"
        >
          <LogOut className="h-5 w-5" />
          {t('nav.logout')}
        </button>
      </div>
    </div>
  );
}

// ==================== VIEW ROUTER ====================
function ViewRouter() {
  const { currentView } = useAppStore();

  switch (currentView) {
    case 'dashboard':
      return <DashboardView />;
    case 'courses':
      return <CoursesView />;
    case 'course-detail':
      return <CourseDetailView />;
    case 'my-courses':
      return <MyCoursesView />;
    case 'opportunities':
      return <OpportunitiesView />;
    case 'community':
      return <CommunityView />;
    case 'mentorship':
      return <MentorshipView />;
    case 'alerts':
      return <AlertsView />;
    case 'sos':
      return <SOSView />;
    case 'admin':
      return <AdminView />;
    case 'account-management':
      return <AccountManagementView />;
    case 'profile':
      return <ProfileView />;
    case 'notifications':
      return <NotificationsView />;
    default:
      return <DashboardView />;
  }
}

// ==================== BOTTOM TAB BAR ====================
function BottomTabBar() {
  const { currentView, setView } = useAppStore();
  const { t } = useTranslation();

  const tabs: Array<{ view: ViewType; label: string; icon: React.ReactNode; activeIcon: React.ReactNode; special?: boolean }> = [
    {
      view: 'dashboard',
      label: t('nav.dashboard'),
      icon: <Home className="h-5 w-5" />,
      activeIcon: <Home className="h-5 w-5" />,
    },
    {
      view: 'courses',
      label: t('nav.courses'),
      icon: <BookOpen className="h-5 w-5" />,
      activeIcon: <BookOpen className="h-5 w-5" />,
    },
    {
      view: 'sos',
      label: 'SOS',
      icon: <Siren className="h-6 w-6" />,
      activeIcon: <Siren className="h-6 w-6" />,
      special: true,
    },
    {
      view: 'community',
      label: t('nav.community'),
      icon: <MessageCircle className="h-5 w-5" />,
      activeIcon: <MessageCircle className="h-5 w-5" />,
    },
    {
      view: 'profile',
      label: t('nav.profile'),
      icon: <User className="h-5 w-5" />,
      activeIcon: <User className="h-5 w-5" />,
    },
  ];

  const isActive = (view: ViewType) => {
    if (view === 'courses') return currentView === 'courses' || currentView === 'course-detail' || currentView === 'my-courses';
    if (view === 'profile') return currentView === 'profile' || currentView === 'notifications';
    return currentView === view;
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-background border-t shadow-lg pb-safe lg:hidden">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {tabs.map((tab) => {
          const active = isActive(tab.view);
          if (tab.special) {
            return (
              <button
                key={tab.view}
                onClick={() => setView(tab.view)}
                className="relative -mt-6 flex flex-col items-center justify-center"
                aria-label={t('sos.sosButtonAria')}
              >
                <div className={cn(
                  'w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-95',
                  active
                    ? 'bg-weds-red text-white ring-4 ring-weds-red/20'
                    : 'bg-weds-red text-white hover:bg-weds-red-light'
                )}>
                  {tab.activeIcon}
                </div>
                <span className={cn(
                  'text-[10px] font-bold mt-1',
                  active ? 'text-weds-red' : 'text-muted-foreground'
                )}>
                  SOS
                </span>
              </button>
            );
          }
          return (
            <button
              key={tab.view}
              onClick={() => setView(tab.view)}
              className="flex flex-col items-center justify-center gap-0.5 min-w-[48px] min-h-[48px] transition-colors"
              aria-label={tab.label}
            >
              <div className={cn(
                'transition-colors',
                active ? 'text-weds-blue' : 'text-muted-foreground'
              )}>
                {active ? tab.activeIcon : tab.icon}
              </div>
              <span className={cn(
                'text-[10px] leading-tight',
                active ? 'text-weds-blue font-semibold' : 'text-muted-foreground'
              )}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

// ==================== DESKTOP SIDEBAR ====================
function DesktopSidebar() {
  const { currentView, setView } = useAppStore();
  const { user, logout } = useAuthStore();
  const { t } = useTranslation();

  const navItems: Array<{ view: ViewType; label: string; icon: React.ReactNode }> = [
    { view: 'dashboard', label: t('nav.dashboard'), icon: <LayoutDashboard className="h-5 w-5" /> },
    { view: 'courses', label: t('nav.courses'), icon: <BookOpen className="h-5 w-5" /> },
    { view: 'my-courses', label: t('nav.myCourses'), icon: <BookMarked className="h-5 w-5" /> },
    { view: 'opportunities', label: t('nav.opportunities'), icon: <Briefcase className="h-5 w-5" /> },
    { view: 'community', label: t('nav.community'), icon: <Users className="h-5 w-5" /> },
    { view: 'mentorship', label: t('nav.mentorship'), icon: <HandHelping className="h-5 w-5" /> },
    { view: 'alerts', label: t('nav.alerts'), icon: <AlertTriangle className="h-5 w-5" /> },
    { view: 'sos', label: t('nav.sos'), icon: <Siren className="h-5 w-5" /> },
  ];

  const adminItems: Array<{ view: ViewType; label: string; icon: React.ReactNode }> = [
    { view: 'admin', label: t('nav.admin'), icon: <Shield className="h-5 w-5" /> },
    { view: 'account-management', label: t('nav.accountManagement'), icon: <UserCog className="h-5 w-5" /> },
  ];

  const isActive = (view: ViewType) => currentView === view;
  const isAdmin = (user?.role as Record<string, unknown>)?.name === 'SUPER_ADMIN' || (user?.role as Record<string, unknown>)?.name === 'ADMIN' || (typeof user?.role === 'string' && (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN'));

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-4 border-b">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center">
            <Image src="/logo.png" alt="Week-end SCHOOL" width={40} height={40} className="w-10 h-10" />
          </div>
          <div>
            <p className="font-bold text-sm leading-tight text-weds-red italic">Week-end</p>
            <p className="text-[10px] text-weds-blue font-bold tracking-wider">SCHOOL</p>
          </div>
        </div>
      </div>

      {/* Nav Items */}
      <ScrollArea className="flex-1 py-2">
        <nav className="space-y-0.5 px-2">
          {navItems.map((item) => (
            <button
              key={item.view}
              onClick={() => setView(item.view)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors',
                isActive(item.view)
                  ? 'bg-weds-blue-50 text-weds-blue font-medium'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              {item.icon}
              {item.label}
              {item.view === 'sos' && (
                <Badge className="ml-auto text-[10px] px-1.5 py-0 bg-weds-red text-white">SOS</Badge>
              )}
            </button>
          ))}

          {isAdmin && (
            <>
              <Separator className="my-2" />
              {adminItems.map((item) => (
                <button
                  key={item.view}
                  onClick={() => setView(item.view)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors',
                    isActive(item.view)
                      ? 'bg-weds-blue-50 text-weds-blue font-medium'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </>
          )}
        </nav>
      </ScrollArea>

      {/* Footer */}
      <div className="p-3 border-t space-y-1">
        <button
          onClick={() => setView('notifications')}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-muted-foreground hover:bg-muted transition-colors"
        >
          <Bell className="h-5 w-5" />
          {t('nav.notifications')}
        </button>
        <button
          onClick={() => setView('profile')}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-muted-foreground hover:bg-muted transition-colors"
        >
          <User className="h-5 w-5" />
          {t('nav.profile')}
        </button>
        <Separator />
        <button
          onClick={() => { logout(); setView('login'); }}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-weds-red hover:bg-weds-red-50 transition-colors"
        >
          <LogOut className="h-5 w-5" />
          {t('nav.logout')}
        </button>
      </div>
    </div>
  );
}

// ==================== MAIN APP ====================
export default function WEDSApp() {
  const { currentView, setView, toggleChatbot, language } = useAppStore();
  const { user, isAuthenticated, initialize, token } = useAuthStore();
  const { incomingCalls, activeCallId, connect: connectSos, isConnected: sosConnected } = useSosStore();
  const { t } = useTranslation();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    initialize();
    useAppStore.getState()._hydrateLanguage();
    queueMicrotask(() => setMounted(true));
  }, [initialize]);

  React.useEffect(() => {
    if (mounted && !isAuthenticated && currentView !== 'register') {
      setView('login');
    }
  }, [mounted, isAuthenticated, currentView, setView]);

  // Connect SOS socket when user is authenticated
  React.useEffect(() => {
    if (mounted && isAuthenticated && user && !sosConnected) {
      const roleName = (user.role as Record<string, unknown>)?.name as string || 'BENEFICIAIRE';
      connectSos(user.id, user.name, roleName);
    }
  }, [mounted, isAuthenticated, user, sosConnected, connectSos]);

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl overflow-hidden flex items-center justify-center animate-pulse">
            <Image src="/logo.png" alt="Week-end SCHOOL" width={64} height={64} className="w-16 h-16" />
          </div>
          <p className="text-sm text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  // Auth views (no sidebar)
  if (!isAuthenticated) {
    if (currentView === 'register') {
      return <RegisterView />;
    }
    return <LoginView />;
  }

  // Main app with layout
  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 border-r bg-card flex-col shrink-0">
        <DesktopSidebar />
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top Header */}
        <header className="h-14 border-b bg-card flex items-center px-3 sm:px-4 gap-2 shrink-0">
          {/* Mobile menu */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden h-9 w-9">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <DrawerNav />
            </SheetContent>
          </Sheet>

          {/* Logo on mobile */}
          <div className="flex items-center gap-2 lg:hidden">
            <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center">
              <Image src="/logo.png" alt="Week-end SCHOOL" width={32} height={32} className="w-8 h-8" />
            </div>
            <div className="hidden sm:block">
              <p className="text-xs font-bold text-weds-red italic leading-tight">Week-end</p>
              <p className="text-[9px] text-weds-blue font-bold tracking-wider">SCHOOL</p>
            </div>
          </div>

          {/* Page title on desktop */}
          <div className="hidden lg:block flex-1">
            <h2 className="font-semibold text-sm truncate">
              {currentView === 'dashboard' && t('nav.dashboard')}
              {currentView === 'courses' && t('nav.courses')}
              {currentView === 'course-detail' && t('courses.detail')}
              {currentView === 'my-courses' && t('nav.myCourses')}
              {currentView === 'opportunities' && t('nav.opportunities')}
              {currentView === 'community' && t('nav.community')}
              {currentView === 'mentorship' && t('nav.mentorship')}
              {currentView === 'alerts' && t('alerts.title')}
              {currentView === 'sos' && t('nav.sos')}
              {currentView === 'admin' && t('nav.admin')}
              {currentView === 'account-management' && t('nav.accountManagement')}
              {currentView === 'profile' && t('nav.profile')}
              {currentView === 'notifications' && t('nav.notifications')}
            </h2>
          </div>

          <div className="flex-1 lg:hidden" />

          {/* PAIXBOT Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={toggleChatbot}
            className="gap-1.5 text-weds-blue border-weds-blue-200 hover:bg-weds-blue-50 h-8 px-2"
          >
            <Bot className="h-4 w-4" />
            <span className="hidden sm:inline text-xs">PAIXBOT</span>
          </Button>

          {/* Language */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={t('nav.language')}>
                <Globe className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {(['fr', 'en', 'ew', 'kab'] as Language[]).map((lang) => (
                <DropdownMenuItem
                  key={lang}
                  onClick={() => useAppStore.getState().setLanguage(lang)}
                  className={language === lang ? 'bg-weds-blue-50 font-bold' : ''}
                >
                  {LANGUAGE_FLAGS[lang]} {LANGUAGE_NAMES[lang]}
                  {language === lang && <CheckCircle2 className="h-3 w-3 ml-auto text-weds-blue" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User (Desktop) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 gap-2 px-2 hidden lg:flex">
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="bg-weds-blue-100 text-weds-blue text-xs">
                    {user?.name?.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs">{user?.name}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setView('profile')}>{t('nav.profile')}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setView('notifications')}>{t('nav.notifications')}</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-weds-red"
                onClick={() => {
                  useAuthStore.getState().logout();
                  setView('login');
                }}
              >
                {t('nav.logout')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto pb-16 lg:pb-0">
          <ViewRouter />
        </main>

        {/* Footer (Desktop only) */}
        <footer className="hidden lg:block border-t bg-card py-3 px-4 text-center shrink-0">
          <p className="text-xs text-muted-foreground">
            <Heart className="h-3 w-3 inline text-weds-red" /> {t('common.appName')} — {t('auth.motto')}
          </p>
        </footer>
      </div>

      {/* Bottom Tab Bar (Mobile) */}
      <BottomTabBar />

      {/* SOS Floating Button (Desktop only - on mobile it's in the tab bar) */}
      <GlobalSosButton />

      {/* PAIXBOT Chat */}
      <PaixbotChat />

      {/* Admin SOS Call Notifications */}
      {incomingCalls.length > 0 && !activeCallId && incomingCalls.map((call) => (
        <SosAdminIncomingCall key={call.id} call={call} />
      ))}
      {activeCallId && <SosAdminActiveCall />}
    </div>
  );
}
