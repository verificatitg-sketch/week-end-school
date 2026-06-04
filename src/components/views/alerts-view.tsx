'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/store/app-store';
import { useAuthStore } from '@/store/auth-store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  AlertTriangle,
  Shield,
  MapPin,
  Eye,
  EyeOff,
  Send,
  Loader2,
  CheckCircle2,
  Clock,
  AlertCircle,
} from 'lucide-react';

interface Report {
  id: string;
  category: string;
  description: string;
  location: string;
  severity: string;
  anonymous: boolean;
  status: string;
  createdAt: string;
}

const CATEGORIES = [
  { value: 'violence', label: 'Violence' },
  { value: 'conflit', label: 'Conflit communautaire' },
  { value: 'vbg', label: 'VBG' },
  { value: 'discours', label: 'Discours haineux' },
  { value: 'discrimination', label: 'Discrimination' },
];

const SEVERITY_COLORS: Record<string, string> = {
  low: 'bg-weds-blue-100 text-weds-blue-700',
  medium: 'bg-amber-100 text-amber-700',
  high: 'bg-red-100 text-red-700',
  critical: 'bg-red-200 text-red-800',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  investigating: 'bg-weds-blue-100 text-weds-blue-700',
  resolved: 'bg-weds-blue-100 text-weds-blue-700',
  dismissed: 'bg-gray-100 text-gray-700',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  investigating: 'En investigation',
  resolved: 'Résolu',
  dismissed: 'Rejeté',
};

const JPS_ZONES = [
  { name: 'Maritime', status: 'stable' },
  { name: 'Plateaux', status: 'stable' },
  { name: 'Centrale', status: 'surveillance' },
  { name: 'Kara', status: 'stable' },
  { name: 'Savanes', status: 'preoccupant' },
];

const ZONE_COLORS: Record<string, string> = {
  stable: 'bg-weds-blue',
  surveillance: 'bg-amber-500',
  preoccupant: 'bg-red-500',
};

const ZONE_LABELS: Record<string, string> = {
  stable: 'Stable',
  surveillance: 'Surveillance',
  preoccupant: 'Préoccupant',
};

export function AlertsView() {
  const token = useAuthStore((s) => s.token);
  const { toast } = useToast();

  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    category: '',
    description: '',
    location: '',
    severity: 'medium',
    anonymous: false,
  });

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const res = await fetch('/api/reports', { headers });
        if (res.ok) {
          const data = await res.json();
          setReports(data.reports || data || []);
        }
      } catch {
        // Silently handle
      } finally {
        setLoading(false);
      }
    };
    fetchReports();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.category || !form.description.trim() || !form.location.trim()) {
      toast({
        title: 'Erreur',
        description: 'Veuillez remplir tous les champs obligatoires',
        variant: 'destructive',
      });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        const data = await res.json();
        setReports((prev) => [data.report || data, ...prev]);
        setForm({ category: '', description: '', location: '', severity: 'medium', anonymous: false });
        toast({ title: 'Signalement envoyé', description: 'Votre signalement a été enregistré.' });
      } else {
        toast({ title: 'Erreur', description: 'Impossible d\'envoyer le signalement', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Erreur', description: 'Erreur de connexion', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-weds-blue-800">
          Alertes et Signalements
        </h1>
        <p className="text-muted-foreground mt-1">
          Signalez les incidents et suivez l&apos;évolution de la situation
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Report Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              Nouveau signalement
            </CardTitle>
            <CardDescription>
              Signalez un incident de manière sécurisée
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div className="space-y-2">
                <Label>Catégorie *</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) => setForm((p) => ({ ...p, category: v }))}
                >
                  <SelectTrigger className="w-full" aria-label="Catégorie">
                    <SelectValue placeholder="Sélectionner une catégorie" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Localisation *</Label>
                <Input
                  id="location"
                  placeholder="Ville, quartier, région..."
                  value={form.location}
                  onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
                  aria-label="Localisation"
                />
              </div>

              <div className="space-y-2">
                <Label>Sévérité</Label>
                <Select
                  value={form.severity}
                  onValueChange={(v) => setForm((p) => ({ ...p, severity: v }))}
                >
                  <SelectTrigger className="w-full" aria-label="Sévérité">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Faible</SelectItem>
                    <SelectItem value="medium">Moyen</SelectItem>
                    <SelectItem value="high">Élevé</SelectItem>
                    <SelectItem value="critical">Critique</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  placeholder="Décrivez l'incident en détail..."
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  rows={4}
                  aria-label="Description de l'incident"
                />
              </div>

              <div className="flex items-center gap-3">
                <Switch
                  checked={form.anonymous}
                  onCheckedChange={(v) => setForm((p) => ({ ...p, anonymous: v }))}
                  aria-label="Signalement anonyme"
                />
                <Label className="flex items-center gap-2 cursor-pointer">
                  {form.anonymous ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                  Signalement anonyme
                </Label>
              </div>

              <Button
                type="submit"
                className="w-full bg-weds-blue hover:bg-weds-blue-700 text-white"
                disabled={submitting}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Envoyer le signalement
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* JPS Map */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-5 w-5 text-weds-blue" />
                Carte JPS - Justice, Paix, Sécurité
              </CardTitle>
              <CardDescription>
                État de la situation par région
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {JPS_ZONES.map((zone) => (
                  <div
                    key={zone.name}
                    className="flex items-center gap-3 p-3 rounded-lg bg-gray-50"
                  >
                    <div className={`w-4 h-4 rounded-full ${ZONE_COLORS[zone.status]}`} />
                    <div className="flex-1">
                      <p className="font-medium text-sm">{zone.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {ZONE_LABELS[zone.status]}
                      </p>
                    </div>
                    <Badge
                      className={`${
                        zone.status === 'stable'
                          ? 'bg-weds-blue-100 text-weds-blue-700'
                          : zone.status === 'surveillance'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-red-100 text-red-700'
                      } border-0`}
                    >
                      {ZONE_LABELS[zone.status]}
                    </Badge>
                  </div>
                ))}
              </div>

              {/* Map Grid Placeholder */}
              <div className="mt-4 grid grid-cols-5 gap-1 h-40 rounded-lg overflow-hidden">
                {Array.from({ length: 20 }).map((_, i) => {
                  const zone = JPS_ZONES[i % JPS_ZONES.length];
                  return (
                    <div
                      key={i}
                      className={`${ZONE_COLORS[zone.status]} opacity-40 rounded-sm`}
                      title={`${zone.name} - ${ZONE_LABELS[zone.status]}`}
                    />
                  );
                })}
              </div>

              <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-weds-blue" />
                  Stable
                </span>
                <span className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-amber-500" />
                  Surveillance
                </span>
                <span className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  Préoccupant
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent Reports */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-weds-blue" />
            Signalements récents
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : reports.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Aucun signalement pour le moment
            </p>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {reports.map((report) => (
                <div
                  key={report.id}
                  className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg"
                >
                  <AlertTriangle
                    className={`h-5 w-5 shrink-0 mt-0.5 ${
                      report.severity === 'critical' || report.severity === 'high'
                        ? 'text-red-500'
                        : report.severity === 'medium'
                        ? 'text-amber-500'
                        : 'text-weds-blue'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary" className="text-xs">
                        {CATEGORIES.find((c) => c.value === report.category)?.label || report.category}
                      </Badge>
                      <Badge className={`${SEVERITY_COLORS[report.severity] || ''} border-0 text-xs`}>
                        {report.severity}
                      </Badge>
                      <Badge className={`${STATUS_COLORS[report.status] || ''} border-0 text-xs`}>
                        {STATUS_LABELS[report.status] || report.status}
                      </Badge>
                    </div>
                    <p className="text-sm mt-1 line-clamp-2">{report.description}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {report.location}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(report.createdAt).toLocaleDateString('fr-FR')}
                      </span>
                      {report.anonymous && (
                        <span className="flex items-center gap-1">
                          <EyeOff className="h-3 w-3" />
                          Anonyme
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
