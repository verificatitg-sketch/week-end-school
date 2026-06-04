'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAppStore } from '@/store/app-store';
import { useAuthStore } from '@/store/auth-store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  Search,
  Briefcase,
  GraduationCap,
  DollarSign,
  Trophy,
  Users,
  MapPin,
  Calendar,
  ExternalLink,
  Building2,
} from 'lucide-react';

interface Opportunity {
  id: string;
  title: string;
  type: string;
  organization: string;
  location: string;
  deadline: string;
  description: string;
  url?: string;
}

const OPP_TYPES = [
  { value: 'all', label: 'Toutes' },
  { value: 'emploi', label: 'Emploi' },
  { value: 'stage', label: 'Stage' },
  { value: 'bourse', label: 'Bourse' },
  { value: 'concours', label: 'Concours' },
  { value: 'financement', label: 'Financement' },
  { value: 'mentorat', label: 'Mentorat' },
];

const TYPE_ICONS: Record<string, React.ElementType> = {
  emploi: Briefcase,
  stage: GraduationCap,
  bourse: DollarSign,
  concours: Trophy,
  financement: DollarSign,
  mentorat: Users,
};

const TYPE_COLORS: Record<string, string> = {
  emploi: 'bg-weds-blue-100 text-weds-blue-700',
  stage: 'bg-weds-blue-100 text-weds-blue-700',
  bourse: 'bg-green-100 text-green-700',
  concours: 'bg-amber-100 text-amber-700',
  financement: 'bg-cyan-100 text-cyan-700',
  mentorat: 'bg-purple-100 text-purple-700',
};

export function OpportunitiesView() {
  const setSelectedOpportunityId = useAppStore((s) => s.setSelectedOpportunityId);
  const token = useAuthStore((s) => s.token);
  const { toast } = useToast();

  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeType, setActiveType] = useState('all');

  useEffect(() => {
    const fetchOpportunities = async () => {
      try {
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const res = await fetch('/api/opportunities', { headers });
        if (res.ok) {
          const data = await res.json();
          setOpportunities(data.opportunities || data || []);
        }
      } catch {
        // Silently handle
      } finally {
        setLoading(false);
      }
    };
    fetchOpportunities();
  }, [token]);

  const filteredOpportunities = useMemo(() => {
    return opportunities.filter((opp) => {
      const matchesSearch =
        !search ||
        opp.title.toLowerCase().includes(search.toLowerCase()) ||
        opp.organization.toLowerCase().includes(search.toLowerCase());
      const matchesType = activeType === 'all' || opp.type === activeType;
      return matchesSearch && matchesType;
    });
  }, [opportunities, search, activeType]);

  const handleApply = (opp: Opportunity) => {
    if (opp.url) {
      window.open(opp.url, '_blank', 'noopener,noreferrer');
    } else {
      toast({
        title: 'Contact',
        description: `Contactez ${opp.organization} pour plus de détails.`,
      });
    }
    setSelectedOpportunityId(opp.id);
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-weds-blue-800">Opportunités</h1>
        <p className="text-muted-foreground mt-1">
          Emplois, stages, bourses et plus encore
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher une opportunité..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
          aria-label="Rechercher une opportunité"
        />
      </div>

      {/* Type Tabs */}
      <Tabs value={activeType} onValueChange={setActiveType}>
        <TabsList className="flex flex-wrap h-auto gap-1 bg-transparent p-0">
          {OPP_TYPES.map((type) => (
            <TabsTrigger
              key={type.value}
              value={type.value}
              className="data-[state=active]:bg-weds-blue data-[state=active]:text-white rounded-full px-3 py-1.5 text-xs sm:text-sm border"
            >
              {type.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={activeType} className="mt-6">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4 space-y-3">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-8 w-24" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredOpportunities.length === 0 ? (
            <div className="text-center py-16">
              <Briefcase className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-medium text-muted-foreground">
                Aucune opportunité trouvée
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Modifiez vos critères de recherche
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredOpportunities.map((opp) => {
                const IconComp = TYPE_ICONS[opp.type] || Briefcase;
                return (
                  <Card key={opp.id} className="hover:shadow-lg transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3 mb-3">
                        <div
                          className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                            TYPE_COLORS[opp.type] || 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          <IconComp className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-sm line-clamp-2">{opp.title}</h3>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                            <Building2 className="h-3 w-3" />
                            <span className="truncate">{opp.organization}</span>
                          </div>
                        </div>
                      </div>

                      <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                        {opp.description}
                      </p>

                      <div className="flex flex-wrap gap-2 mb-3">
                        <Badge variant="secondary" className="text-xs">
                          {opp.type.charAt(0).toUpperCase() + opp.type.slice(1)}
                        </Badge>
                        <Badge variant="outline" className="text-xs gap-1">
                          <MapPin className="h-3 w-3" />
                          {opp.location}
                        </Badge>
                        {opp.deadline && (
                          <Badge variant="outline" className="text-xs gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(opp.deadline).toLocaleDateString('fr-FR')}
                          </Badge>
                        )}
                      </div>

                      <Button
                        size="sm"
                        className="w-full bg-weds-blue hover:bg-weds-blue-700 text-white"
                        onClick={() => handleApply(opp)}
                        aria-label={`Postuler à ${opp.title}`}
                      >
                        <ExternalLink className="h-3.5 w-3.5 mr-1" />
                        {opp.type === 'mentorat' ? 'Contacter' : 'Postuler'}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
