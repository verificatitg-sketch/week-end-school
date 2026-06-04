'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useAppStore } from '@/store/app-store';
import { useAuthStore } from '@/store/auth-store';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { LANGUAGE_NAMES, LANGUAGE_FLAGS, Language } from '@/lib/i18n/translations';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  const setAuth = useAuthStore((s) => s.setAuth);
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
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Language selector at Top Left */}
      <div className="absolute top-3 left-3 z-20">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1.5 text-white/90 hover:text-white hover:bg-white/10 bg-black/10 backdrop-blur-sm">
              <Globe className="h-4 w-4" />
              <span className="text-xs">{LANGUAGE_FLAGS[language]} {LANGUAGE_NAMES[language]}</span>
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

      {/* SOS Button at Top Right */}
      <div className="absolute top-3 right-3 z-20 flex flex-col items-center">
        <button
          onClick={() => setSosOpen(true)}
          className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-full flex flex-col items-center justify-center bg-gradient-to-br from-red-500 to-red-700 text-white shadow-2xl hover:shadow-red-500/50 transition-all duration-300 hover:scale-110 active:scale-95 focus:outline-none focus:ring-4 focus:ring-red-300 cursor-pointer animate-sos-pulse"
          aria-label={t('sos.sosButtonAria')}
        >
          <Siren className="h-5 w-5 sm:h-6 sm:w-6" />
          <span className="text-[9px] sm:text-[10px] font-black mt-0.5">SOS</span>
        </button>
        <span className="text-[8px] font-bold text-white/80 mt-0.5">{t('sos.urgencyLabel')}</span>
      </div>

      {/* Register content */}
      <div className="flex-1 flex items-center justify-center p-4 relative">
        {/* Background - Togo green gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-weds-blue via-weds-blue-800 to-weds-blue-700" />
        <div className="absolute top-0 left-0 w-80 h-80 bg-weds-gold/10 rounded-full blur-3xl -translate-y-1/2 -translate-x-1/2" />
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-weds-blue-600/30 rounded-full blur-3xl translate-y-1/2 translate-x-1/2" />
        <div className="absolute top-1/2 left-0 right-0 h-1 bg-weds-gold/20 -translate-y-1/2" />

        <Card className="w-full max-w-lg relative z-10 shadow-2xl border-weds-blue/20 bg-white/95 backdrop-blur-sm">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto w-14 h-14 rounded-xl overflow-hidden flex items-center justify-center shadow-lg ring-2 ring-weds-blue/20">
              <Image src="/logo.png" alt="Week-end SCHOOL" width={56} height={56} className="w-14 h-14" />
            </div>
            <CardTitle className="text-xl font-bold text-weds-blue">
              {t('auth.registerTitle')}
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              {t('auth.registerSubtitle')}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">{t('auth.name')} *</Label>
                  <Input
                    id="name"
                    placeholder={t('auth.namePlaceholder')}
                    value={form.name}
                    onChange={(e) => updateField('name', e.target.value)}
                    disabled={loading}
                    aria-label={t('auth.name')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">{t('auth.email')} *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder={t('auth.emailPlaceholder')}
                    value={form.email}
                    onChange={(e) => updateField('email', e.target.value)}
                    disabled={loading}
                    aria-label={t('auth.email')}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
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
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">{t('auth.confirmPassword')} *</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder={t('auth.confirmPasswordPlaceholder')}
                    value={form.confirmPassword}
                    onChange={(e) => updateField('confirmPassword', e.target.value)}
                    disabled={loading}
                    aria-label={t('auth.confirmPassword')}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">{t('auth.phone')}</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder={t('auth.phonePlaceholder')}
                    value={form.phone}
                    onChange={(e) => updateField('phone', e.target.value)}
                    disabled={loading}
                    aria-label={t('auth.phone')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gender">{t('auth.gender')} *</Label>
                  <Select value={form.gender} onValueChange={(v) => updateField('gender', v)}>
                    <SelectTrigger className="w-full" aria-label={t('auth.gender')}>
                      <SelectValue placeholder={t('auth.genderPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">{t('auth.male')}</SelectItem>
                      <SelectItem value="female">{t('auth.female')}</SelectItem>
                      <SelectItem value="other">{t('auth.other')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="location">{t('auth.location')} *</Label>
                  <Input
                    id="location"
                    placeholder={t('auth.locationPlaceholder')}
                    value={form.location}
                    onChange={(e) => updateField('location', e.target.value)}
                    disabled={loading}
                    aria-label={t('auth.location')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="disability">{t('auth.disability')}</Label>
                  <Input
                    id="disability"
                    placeholder={t('auth.disabilityPlaceholder')}
                    value={form.disability}
                    onChange={(e) => updateField('disability', e.target.value)}
                    disabled={loading}
                    aria-label={t('auth.disability')}
                  />
                </div>
              </div>

              {error && (
                <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md" role="alert">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="w-full bg-weds-blue hover:bg-weds-blue-700 text-white"
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
            </form>
          </CardContent>

          <CardFooter className="justify-center">
            <Button
              variant="ghost"
              className="text-weds-blue gap-2"
              onClick={() => setView('login')}
              aria-label={t('auth.backToLoginAria')}
            >
              <ArrowLeft className="h-4 w-4" />
              {t('auth.hasAccount')} {t('auth.login')}
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* SOS Caller Modal */}
      {sosOpen && <SosCallerModal onClose={() => setSosOpen(false)} />}
    </div>
  );
}
