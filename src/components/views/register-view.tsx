'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useAppStore } from '@/store/app-store';
import { useAuthStore } from '@/store/auth-store';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { LANGUAGE_NAMES, LANGUAGE_FLAGS, Language } from '@/lib/i18n/translations';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
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
  ArrowLeft,
  Siren,
  Globe,
  CheckCircle2,
} from 'lucide-react';

export function RegisterView() {
  const setView = useAppStore((s) => s.setView);
  const setAuth = useAppStore((s) => s.setAuth);
  const language = useAppStore((s) => s.language);
  const setLanguage = useAppStore((s) => s.setLanguage);
  const { t } = useTranslation();

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    gender: '',
    disability: '',
    location: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sosOpen, setSosOpen] = useState(false);

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const validate = (): string | null => {
    if (!form.name.trim()) return t('auth.nameRequired');
    if (!form.email.trim()) return t('auth.emailRequired');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return t('auth.emailInvalid');
    if (!form.password.trim()) return t('auth.passwordRequired');
    if (form.password.length < 6) return t('auth.passwordMin');
    if (form.password !== form.confirmPassword) return t('auth.passwordMismatch');
    if (!form.gender) return t('auth.genderRequired');
    if (!form.location.trim()) return t('auth.locationRequired');
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          password: form.password,
          phone: form.phone,
          gender: form.gender,
          disability: form.disability || undefined,
          location: form.location,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t('auth.registerError'));
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
      {/* Top Section - Blue Header with Logo + SOS */}
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
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden flex items-center justify-center bg-white shadow-xl ring-4 ring-white/30 mb-3">
            <Image src="/logo.png" alt="Week-end SCHOOL" width={112} height={112} className="w-full h-full object-cover" />
          </div>
          <h1 className="text-white text-xl sm:text-2xl font-black italic tracking-tight">
            Week-end
          </h1>
          <p className="text-weds-gold text-xs sm:text-sm font-bold tracking-[0.3em] -mt-0.5">
            SCHOOL DIGITAL
          </p>
          <p className="text-white/70 text-[11px] italic mt-1.5 text-center max-w-[240px]">
            &ldquo;{t('auth.motto')}&rdquo;
          </p>
        </div>

        {/* SOS Button - Rectangular, in blue header below motto, before curved transition */}
        <div className="relative z-10 w-full max-w-[280px] mt-4">
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
        <div className="w-full max-w-lg mx-auto">
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">{t('auth.name')} *</Label>
                <Input
                  id="name"
                  placeholder={t('auth.namePlaceholder')}
                  value={form.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  disabled={loading}
                  aria-label={t('auth.name')}
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">{t('auth.email')} *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={t('auth.emailPlaceholder')}
                  value={form.email}
                  onChange={(e) => updateField('email', e.target.value)}
                  disabled={loading}
                  aria-label={t('auth.email')}
                  className="h-11 rounded-xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="password">{t('auth.password')} *</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder={t('auth.passwordMinPlaceholder')}
                    value={form.password}
                    onChange={(e) => updateField('password', e.target.value)}
                    disabled={loading}
                    aria-label={t('auth.password')}
                    className="h-11 pr-10 rounded-xl"
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
              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword">{t('auth.confirmPassword')} *</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder={t('auth.confirmPasswordPlaceholder')}
                  value={form.confirmPassword}
                  onChange={(e) => updateField('confirmPassword', e.target.value)}
                  disabled={loading}
                  aria-label={t('auth.confirmPassword')}
                  className="h-11 rounded-xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="phone">{t('auth.phone')}</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder={t('auth.phonePlaceholder')}
                  value={form.phone}
                  onChange={(e) => updateField('phone', e.target.value)}
                  disabled={loading}
                  aria-label={t('auth.phone')}
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gender">{t('auth.gender')} *</Label>
                <select
                  id="gender"
                  value={form.gender}
                  onChange={(e) => updateField('gender', e.target.value)}
                  disabled={loading}
                  aria-label={t('auth.gender')}
                  className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="">{t('auth.genderPlaceholder')}</option>
                  <option value="male">{t('auth.male')}</option>
                  <option value="female">{t('auth.female')}</option>
                  <option value="other">{t('auth.other')}</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="location">{t('auth.location')} *</Label>
                <Input
                  id="location"
                  placeholder={t('auth.locationPlaceholder')}
                  value={form.location}
                  onChange={(e) => updateField('location', e.target.value)}
                  disabled={loading}
                  aria-label={t('auth.location')}
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="disability">{t('auth.disability')}</Label>
                <Input
                  id="disability"
                  placeholder={t('auth.disabilityPlaceholder')}
                  value={form.disability}
                  onChange={(e) => updateField('disability', e.target.value)}
                  disabled={loading}
                  aria-label={t('auth.disability')}
                  className="h-11 rounded-xl"
                />
              </div>
            </div>

            {error && (
              <div className="text-xs text-red-600 bg-red-50 p-3 rounded-xl border border-red-100 flex items-start gap-2" role="alert">
                <span className="shrink-0 mt-0.5">⚠️</span>
                {error}
              </div>
            )}

            {/* Create account + SOS buttons side by side */}
            <div className="flex gap-4">
              <Button
                type="submit"
                className="flex-1 h-14 bg-weds-blue hover:bg-weds-blue-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-weds-blue/30 hover:shadow-weds-blue/50 transition-all"
                disabled={loading}
                aria-label={t('auth.createAccount')}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('auth.registerLoading')}
                  </>
                ) : (
                  t('auth.createAccount')
                )}
              </Button>
            </div>
          </form>

          {/* Back to login */}
          <div className="mt-6 text-center">
            <Button
              variant="ghost"
              className="text-weds-blue gap-2 text-sm"
              onClick={() => setView('login')}
              aria-label={t('auth.backToLoginAria')}
            >
              <ArrowLeft className="h-4 w-4" />
              {t('auth.hasAccount')} {t('auth.login')}
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
