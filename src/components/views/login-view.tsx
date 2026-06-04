'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useAppStore } from '@/store/app-store';
import { useAuthStore } from '@/store/auth-store';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { LANGUAGE_NAMES, LANGUAGE_FLAGS, Language } from '@/lib/i18n/translations';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { SosCallerModal } from '@/components/sos/sos-caller-modal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Loader2,
  Eye,
  EyeOff,
  Accessibility,
  Siren,
  Globe,
  CheckCircle2,
  Mail,
  Lock,
  ChevronRight,
} from 'lucide-react';

// ==================== LOGIN VIEW ====================
export function LoginView() {
  const setView = useAppStore((s) => s.setView);
  const setAuth = useAuthStore((s) => s.setAuth);
  const language = useAppStore((s) => s.language);
  const setLanguage = useAppStore((s) => s.setLanguage);
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sosOpen, setSosOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError(t('auth.emailRequired'));
      return;
    }
    if (!password.trim()) {
      setError(t('auth.passwordRequired'));
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError(t('auth.emailInvalid'));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t('auth.loginError'));
        return;
      }
      setAuth(data.user, data.token);
      setView('dashboard');
    } catch {
      setError(t('auth.serverError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Top Section - Blue Header with Logo */}
      <div className="relative bg-gradient-to-b from-weds-blue via-weds-blue to-weds-blue-800 px-6 pt-12 pb-16 flex flex-col items-center overflow-hidden">
        {/* Decorative background elements */}
        <div className="absolute top-0 right-0 w-40 h-40 bg-weds-gold/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full blur-2xl translate-y-1/2 -translate-x-1/4" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-weds-blue-400/10 rounded-full blur-3xl" />

        {/* Language selector - Top Left */}
        <div className="absolute top-3 left-3 z-20">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1.5 text-white/90 hover:text-white hover:bg-white/10">
                <Globe className="h-4 w-4" />
                <span className="text-xs">{LANGUAGE_FLAGS[language]}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {(['fr', 'en', 'ew', 'kab'] as Language[]).map((lang) => (
                <DropdownMenuItem
                  key={lang}
                  onClick={() => setLanguage(lang)}
                  className={language === lang ? 'bg-weds-blue-50 font-bold' : ''}
                >
                  {LANGUAGE_FLAGS[lang]} {LANGUAGE_NAMES[lang]}
                  {language === lang && <CheckCircle2 className="h-3 w-3 ml-auto text-weds-blue" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Logo Section */}
        <div className="relative z-10 flex flex-col items-center mt-4">
          <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full overflow-hidden flex items-center justify-center bg-white shadow-xl ring-4 ring-white/30 mb-4">
            <Image src="/logo.png" alt="Week-end SCHOOL" width={128} height={128} className="w-full h-full object-cover" />
          </div>
          <h1 className="text-white text-2xl sm:text-3xl font-black italic tracking-tight">
            Week-end
          </h1>
          <p className="text-weds-gold text-sm sm:text-base font-bold tracking-[0.3em] -mt-1">
            SCHOOL DIGITAL
          </p>
          <p className="text-white/70 text-xs italic mt-2 text-center max-w-[240px]">
            &ldquo;{t('auth.motto')}&rdquo;
          </p>
        </div>

        {/* SOS Button - Rectangular, full width, below motto in blue header */}
        <div className="relative z-10 w-full max-w-[280px] mt-5">
          <button
            onClick={() => setSosOpen(true)}
            className="w-full h-14 rounded-xl flex items-center justify-center gap-2 bg-red-500 text-white font-bold text-sm shadow-lg shadow-red-500/30 hover:bg-red-600 hover:shadow-red-500/50 transition-all active:scale-[0.98] cursor-pointer"
            aria-label="SOS Urgence"
          >
            <Siren className="h-5 w-5" />
            <span>SOS</span>
          </button>
        </div>

        {/* Curved bottom edge */}
        <div className="absolute bottom-0 left-0 right-0 h-6 bg-white rounded-t-[2rem]" />
      </div>

      {/* Form Section - White */}
      <div className="flex-1 px-6 -mt-2">
        <div className="w-full max-w-sm mx-auto">
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {/* Email field */}
            <div className="space-y-1.5">
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <Mail className="h-4.5 w-4.5" />
                </div>
                <Input
                  id="email"
                  type="email"
                  placeholder={t('auth.emailPlaceholder')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  aria-label={t('auth.email')}
                  autoComplete="email"
                  className="h-12 pl-10 pr-4 bg-gray-50 border-gray-200 focus:bg-white focus:border-weds-blue focus:ring-weds-blue/20 rounded-xl text-sm"
                />
              </div>
            </div>

            {/* Password field */}
            <div className="space-y-1.5">
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <Lock className="h-4.5 w-4.5" />
                </div>
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={t('auth.passwordPlaceholder')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  aria-label={t('auth.password')}
                  autoComplete="current-password"
                  className="h-12 pl-10 pr-10 bg-gray-50 border-gray-200 focus:bg-white focus:border-weds-blue focus:ring-weds-blue/20 rounded-xl text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div className="text-xs text-red-600 bg-red-50 p-3 rounded-xl border border-red-100 flex items-start gap-2" role="alert">
                <span className="shrink-0 mt-0.5">⚠️</span>
                {error}
              </div>
            )}

            {/* Login button */}
            <Button
              type="submit"
              className="w-full h-12 bg-weds-blue hover:bg-weds-blue-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-weds-blue/30 hover:shadow-weds-blue/50 transition-all"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('auth.loginLoading')}
                </>
              ) : (
                <>
                  {t('auth.login')}
                  <ChevronRight className="ml-1 h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          {/* Register link */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500">
              {t('auth.noAccount')}{' '}
              <button
                onClick={() => setView('register')}
                className="text-weds-blue font-bold hover:underline cursor-pointer"
              >
                {t('auth.register')}
              </button>
            </p>
          </div>

          {/* Accessibility */}
          <div className="mt-4 text-center">
            <Button
              variant="ghost"
              size="sm"
              className="text-gray-400 gap-1.5 text-xs h-8"
              onClick={() => setView('profile')}
              aria-label={t('auth.accessibility')}
            >
              <Accessibility className="h-3.5 w-3.5" />
              {t('auth.accessibility')}
            </Button>
          </div>
        </div>
      </div>

      {/* Bottom Section - Brand footer */}
      <div className="px-6 py-4 text-center">
        <div className="flex items-center justify-center gap-2 mb-1">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
          <span className="text-[10px] text-gray-400 font-medium">WEDS</span>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
        </div>
        <p className="text-[10px] text-gray-400">
          © {new Date().getFullYear()} WEEK-END SCHOOL DIGITAL — Togo
        </p>
      </div>

      {/* SOS Caller Modal */}
      {sosOpen && <SosCallerModal onClose={() => setSosOpen(false)} />}
    </div>
  );
}
