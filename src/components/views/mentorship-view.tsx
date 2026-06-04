'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/store/app-store';
import { useAuthStore } from '@/store/auth-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  Star,
  Clock,
  MessageSquare,
  Send,
  Loader2,
  Users,
  UserCheck,
} from 'lucide-react';

interface MentorData {
  id: string;
  userId: string;
  expertise: string;
  availability: string;
  experience?: string;
  rating: number;
  acceptRequests: boolean;
  user: {
    id: string;
    name: string;
    avatar?: string;
    bio?: string;
    location?: string;
  };
}

export function MentorshipView() {
  const setSelectedMentorId = useAppStore((s) => s.setSelectedMentorId);
  const token = useAuthStore((s) => s.token);
  const { toast } = useToast();

  const [mentors, setMentors] = useState<MentorData[]>([]);
  const [requests, setRequests] = useState<Array<{ id: string; status: string; mentor: { user: { name: string } }; createdAt: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedMentor, setSelectedMentor] = useState<MentorData | null>(null);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        
        const mentorsRes = await fetch('/api/mentors', { headers });
        if (mentorsRes.ok) {
          const data = await mentorsRes.json();
          setMentors(data.mentors || []);
        }

        if (token) {
          try {
            const reqRes = await fetch('/api/mentor-requests', { headers });
            if (reqRes.ok) {
              const reqData = await reqRes.json();
              setRequests(reqData.requests || []);
            }
          } catch {
            // Silently handle
          }
        }
      } catch {
        // Silently handle
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [token]);

  const handleRequestMentor = (mentor: MentorData) => {
    setSelectedMentor(mentor);
    setDialogOpen(true);
    setSelectedMentorId(mentor.id);
  };

  const handleSubmitRequest = async () => {
    if (!selectedMentor || !message.trim()) {
      toast({ title: 'Erreur', description: 'Veuillez écrire un message', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/mentor-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ mentorId: selectedMentor.id, message }),
      });
      if (res.ok) {
        toast({
          title: 'Demande envoyée !',
          description: `${selectedMentor.user.name} recevra votre demande.`,
        });
        setDialogOpen(false);
        setMessage('');
        // Refresh requests
        if (token) {
          const reqRes = await fetch('/api/mentor-requests', {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (reqRes.ok) {
            const reqData = await reqRes.json();
            setRequests(reqData.requests || []);
          }
        }
      } else {
        toast({ title: 'Erreur', description: 'Impossible d\'envoyer la demande', variant: 'destructive' });
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
        <h1 className="text-2xl font-bold text-weds-blue-800 dark:text-weds-blue-100">Mentorat</h1>
        <p className="text-muted-foreground mt-1">
          Trouvez un mentor pour vous accompagner dans votre parcours
        </p>
      </div>

      {/* My Mentorship Requests */}
      {requests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-weds-blue" />
              Mes demandes de mentorat
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {requests.map((req) => (
                <div
                  key={req.id}
                  className="flex items-center justify-between p-3 bg-weds-blue-50 dark:bg-weds-blue-800/20 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-sm">
                      {req.mentor?.user?.name || 'Mentor'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Demandé le {new Date(req.createdAt).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                  <Badge
                    className={
                      req.status === 'accepted'
                        ? 'bg-weds-blue-100 text-weds-blue-700 border-0'
                        : req.status === 'pending'
                        ? 'bg-amber-100 text-amber-700 border-0'
                        : 'bg-red-100 text-red-700 border-0'
                    }
                  >
                    {req.status === 'accepted' ? 'Accepté' : req.status === 'pending' ? 'En attente' : 'Refusé'}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Mentor Grid */}
      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Users className="h-5 w-5 text-weds-blue" />
          Mentors disponibles
        </h2>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4 flex flex-col items-center text-center space-y-3">
                  <Skeleton className="h-20 w-20 rounded-full" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-8 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : mentors.length === 0 ? (
          <div className="text-center py-16">
            <Users className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-medium text-muted-foreground">
              Aucun mentor disponible pour le moment
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {mentors.map((mentor) => (
              <Card key={mentor.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-4 flex flex-col items-center text-center">
                  <Avatar className="h-20 w-20 mb-3">
                    <AvatarFallback className="bg-weds-blue-100 text-weds-blue-700 text-xl">
                      {mentor.user.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .toUpperCase()
                        .slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <h3 className="font-semibold">{mentor.user.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {mentor.expertise}
                  </p>
                  {mentor.experience && (
                    <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                      {mentor.experience}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                      {mentor.rating?.toFixed(1) || '4.5'}
                    </span>
                    {mentor.user.location && (
                      <span>{mentor.user.location}</span>
                    )}
                  </div>
                  <Badge className="mt-2 bg-weds-blue-100 text-weds-blue-700 border-0">
                    <Clock className="h-3 w-3 mr-1" />
                    {mentor.availability}
                  </Badge>
                  <Button
                    size="sm"
                    className="mt-3 w-full bg-weds-blue hover:bg-weds-blue-700 text-white"
                    onClick={() => handleRequestMentor(mentor)}
                    disabled={!mentor.acceptRequests}
                    aria-label={`Demander ${mentor.user.name} comme mentor`}
                  >
                    <MessageSquare className="h-3.5 w-3.5 mr-1" />
                    Demander ce mentor
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Request Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Demander un mentor</DialogTitle>
            <DialogDescription>
              Envoyez un message à {selectedMentor?.user?.name || 'ce mentor'} pour lui demander d&apos;être votre mentor
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="Présentez-vous et expliquez pourquoi vous souhaitez être mentoré(e)..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              aria-label="Message au mentor"
            />
          </div>
          <DialogFooter>
            <Button
              className="bg-weds-blue hover:bg-weds-blue-700 text-white"
              onClick={handleSubmitRequest}
              disabled={submitting}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Envoyer la demande
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
