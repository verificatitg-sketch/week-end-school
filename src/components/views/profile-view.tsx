'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/store/app-store';
import { useAuthStore } from '@/store/auth-store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  User,
  Mail,
  Phone,
  MapPin,
  Award,
  Shield,
  Languages,
  Eye,
  Loader2,
  Save,
  Star,
  BookOpen,
  Palette,
} from 'lucide-react';

interface UserBadge {
  id: string;
  name: string;
  description: string;
  icon: string;
  earnedAt: string;
}

interface Certificate {
  id: string;
  courseTitle: string;
  issuedAt: string;
}

export function ProfileView() {
  const appStore = useAppStore();
  const { user, token } = useAuthStore();
  const setAuth = useAuthStore((s) => s.setAuth);
  const { toast } = useToast();

  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: '',
    location: '',
  });
  const [badges, setBadges] = useState<UserBadge[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loadingExtras, setLoadingExtras] = useState(true);

  useEffect(() => {
    const fetchExtras = async () => {
      try {
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        // Fetch badges and certificates - these may not exist yet, handle gracefully
        const results = await Promise.allSettled([
          fetch('/api/courses', { headers }),
          fetch('/api/enrollments?withCertificates=true', { headers }),
        ]);
        // For now, just set empty arrays if APIs don't exist
        setBadges([]);
        setCertificates([]);
      } catch {
        // Silently handle
      } finally {
        setLoadingExtras(false);
      }
    };
    fetchExtras();
  }, [token]);

  useEffect(() => {
    if (user) {
      queueMicrotask(() => setForm({
        name: user.name || '',
        email: user.email || '',
        phone: '',
        location: '',
      }));
    }
  }, [user]);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Update locally for now since /api/profile doesn't exist
      if (user && token) {
        const updatedUser = { ...user, name: form.name, email: form.email };
        setAuth(updatedUser, token);
      }
      setEditMode(false);
      toast({ title: 'Profil mis à jour !' });
    } catch {
      toast({ title: 'Erreur', description: 'Erreur de connexion', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleLanguageChange = (lang: 'fr' | 'en' | 'ew' | 'kab') => {
    appStore.setLanguage(lang);
  };

  const LANGUAGES = [
    { value: 'fr', label: 'Français' },
    { value: 'en', label: 'English' },
    { value: 'ew', label: 'Ewe' },
    { value: 'kab', label: 'Kabyè' },
  ];

  const FONT_SIZES = [
    { value: 'small', label: 'Petite' },
    { value: 'normal', label: 'Normale' },
    { value: 'large', label: 'Grande' },
    { value: 'xlarge', label: 'Très grande' },
  ];

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-weds-blue-800">Mon profil</h1>
        <p className="text-muted-foreground mt-1">
          Gérez vos informations et paramètres
        </p>
      </div>

      {/* Profile Info Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-5 w-5 text-weds-blue" />
              Informations personnelles
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditMode(!editMode)}
              aria-label={editMode ? 'Annuler' : 'Modifier'}
            >
              {editMode ? 'Annuler' : 'Modifier'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-6">
            <div className="flex flex-col items-center gap-3">
              <Avatar className="h-24 w-24">
                <AvatarImage src={user?.avatar} alt={user?.name} />
                <AvatarFallback className="bg-weds-blue-100 text-weds-blue-700 text-2xl">
                  {user?.name
                    ?.split(' ')
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2) || 'U'}
                </AvatarFallback>
              </Avatar>
              <Badge variant="secondary">{(typeof user?.role === 'string' ? user.role : user?.role?.name) || 'Membre'}</Badge>
            </div>

            <div className="flex-1 space-y-4">
              {editMode ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-name">Nom complet</Label>
                      <Input
                        id="edit-name"
                        value={form.name}
                        onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                        aria-label="Nom complet"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-email">Email</Label>
                      <Input
                        id="edit-email"
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                        aria-label="Email"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-phone">Téléphone</Label>
                      <Input
                        id="edit-phone"
                        value={form.phone}
                        onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                        aria-label="Téléphone"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-location">Localisation</Label>
                      <Input
                        id="edit-location"
                        value={form.location}
                        onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
                        aria-label="Localisation"
                      />
                    </div>
                  </div>
                  <Button
                    className="bg-weds-blue hover:bg-weds-blue-700 text-white"
                    onClick={handleSave}
                    disabled={saving}
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Enregistrer
                  </Button>
                </>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{user?.name || 'Non défini'}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{user?.email || 'Non défini'}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{form.phone || 'Non défini'}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{form.location || 'Non définie'}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Accessibility Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-5 w-5 text-weds-blue" />
            Accessibilité
          </CardTitle>
          <CardDescription>Adapter l&apos;interface à vos besoins</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Language */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Languages className="h-4 w-4 text-muted-foreground" />
              <div>
                <Label className="text-sm font-medium">Langue</Label>
                <p className="text-xs text-muted-foreground">Choisir la langue de l&apos;interface</p>
              </div>
            </div>
            <Select
              value={appStore.language}
              onValueChange={(v) => handleLanguageChange(v as 'fr' | 'en' | 'ew' | 'kab')}
            >
              <SelectTrigger className="w-36" aria-label="Langue">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((lang) => (
                  <SelectItem key={lang.value} value={lang.value}>
                    {lang.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Font Size */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Palette className="h-4 w-4 text-muted-foreground" />
              <div>
                <Label className="text-sm font-medium">Taille du texte</Label>
                <p className="text-xs text-muted-foreground">Ajuster la taille de la police</p>
              </div>
            </div>
            <Select
              value={appStore.fontSize}
              onValueChange={(v) => appStore.setFontSize(v as 'small' | 'normal' | 'large' | 'xlarge')}
            >
              <SelectTrigger className="w-36" aria-label="Taille du texte">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FONT_SIZES.map((size) => (
                  <SelectItem key={size.value} value={size.value}>
                    {size.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* High Contrast */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Eye className="h-4 w-4 text-muted-foreground" />
              <div>
                <Label className="text-sm font-medium">Contraste élevé</Label>
                <p className="text-xs text-muted-foreground">Améliorer la lisibilité</p>
              </div>
            </div>
            <Switch
              checked={appStore.highContrast}
              onCheckedChange={appStore.setHighContrast}
              aria-label="Contraste élevé"
            />
          </div>

          <Separator />

          {/* Screen Reader */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              <div>
                <Label className="text-sm font-medium">Lecteur d&apos;écran</Label>
                <p className="text-xs text-muted-foreground">Optimiser pour les lecteurs d&apos;écran</p>
              </div>
            </div>
            <Switch
              checked={appStore.screenReader}
              onCheckedChange={appStore.setScreenReader}
              aria-label="Lecteur d'écran"
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Badges */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Star className="h-5 w-5 text-amber-500" />
              Badges obtenus
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingExtras ? (
              <div className="flex flex-wrap gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-16 rounded-xl" />
                ))}
              </div>
            ) : badges.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Aucun badge obtenu pour le moment
              </p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {badges.map((badge) => (
                  <div
                    key={badge.id}
                    className="flex flex-col items-center gap-1 p-3 bg-amber-50 rounded-xl w-20"
                    title={badge.description}
                  >
                    <Award className="h-8 w-8 text-amber-500" />
                    <span className="text-xs text-center font-medium truncate w-full">
                      {badge.name}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Certificates */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Award className="h-5 w-5 text-weds-blue" />
              Certificats
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingExtras ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : certificates.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Aucun certificat obtenu pour le moment
              </p>
            ) : (
              <div className="space-y-3">
                {certificates.map((cert) => (
                  <div
                    key={cert.id}
                    className="flex items-center gap-3 p-3 bg-weds-blue-50 rounded-lg"
                  >
                    <Award className="h-8 w-8 text-weds-blue shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{cert.courseTitle}</p>
                      <p className="text-xs text-muted-foreground">
                        Délivré le {new Date(cert.issuedAt).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
