'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/store/app-store';
import { useAuthStore } from '@/store/auth-store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  MessageSquare,
  Heart,
  Plus,
  Send,
  User,
  Clock,
  Loader2,
  MessagesSquare,
} from 'lucide-react';

interface Post {
  id: string;
  title: string;
  content: string;
  author: string;
  category: string;
  createdAt: string;
  likesCount: number;
  commentsCount: number;
  liked?: boolean;
}

const SPACES = [
  { value: 'all', label: 'Tous' },
  { value: 'jeunesse', label: 'Jeunesse' },
  { value: 'paix', label: 'Paix' },
  { value: 'femmes', label: 'Femmes' },
  { value: 'entrepreneuriat', label: 'Entrepreneuriat' },
  { value: 'leadership', label: 'Leadership' },
  { value: 'general', label: 'Général' },
];

export function CommunityView() {
  const setSelectedPostId = useAppStore((s) => s.setSelectedPostId);
  const token = useAuthStore((s) => s.token);
  const { toast } = useToast();

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSpace, setActiveSpace] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newPost, setNewPost] = useState({ title: '', content: '', category: '' });
  const [submitting, setSubmitting] = useState(false);
  const [likingId, setLikingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const res = await fetch('/api/community', { headers });
        if (res.ok) {
          const data = await res.json();
          setPosts(data.posts || data || []);
        }
      } catch {
        // Silently handle
      } finally {
        setLoading(false);
      }
    };
    fetchPosts();
  }, [token]);

  const filteredPosts =
    activeSpace === 'all'
      ? posts
      : posts.filter((p) => p.category === activeSpace);

  const handleCreatePost = async () => {
    if (!newPost.title.trim() || !newPost.content.trim() || !newPost.category) {
      toast({ title: 'Erreur', description: 'Tous les champs sont requis', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/community', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(newPost),
      });
      if (res.ok) {
        const data = await res.json();
        setPosts((prev) => [data.post || data, ...prev]);
        setNewPost({ title: '', content: '', category: '' });
        setDialogOpen(false);
        toast({ title: 'Post créé !', description: 'Votre post a été publié.' });
      } else {
        toast({ title: 'Erreur', description: 'Impossible de créer le post', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Erreur', description: 'Erreur de connexion', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleLike = async (postId: string) => {
    setLikingId(postId);
    try {
      const res = await fetch(`/api/community/${postId}/like`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId
              ? {
                  ...p,
                  likesCount: p.liked ? p.likesCount - 1 : p.likesCount + 1,
                  liked: !p.liked,
                }
              : p
          )
        );
      }
    } catch {
      // Silently handle
    } finally {
      setLikingId(null);
    }
  };

  const handlePostClick = (postId: string) => {
    setSelectedPostId(postId);
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-weds-blue-800">Communauté</h1>
          <p className="text-muted-foreground mt-1">
            Échangez, partagez et apprenez ensemble
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              className="bg-weds-blue hover:bg-weds-blue-700 text-white"
              aria-label="Créer un post"
            >
              <Plus className="h-4 w-4 mr-2" />
              Nouveau post
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Créer un post</DialogTitle>
              <DialogDescription>
                Partagez vos idées avec la communauté
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Input
                  placeholder="Titre du post"
                  value={newPost.title}
                  onChange={(e) => setNewPost((p) => ({ ...p, title: e.target.value }))}
                  aria-label="Titre du post"
                />
              </div>
              <div className="space-y-2">
                <Select
                  value={newPost.category}
                  onValueChange={(v) => setNewPost((p) => ({ ...p, category: v }))}
                >
                  <SelectTrigger className="w-full" aria-label="Catégorie">
                    <SelectValue placeholder="Choisir un espace" />
                  </SelectTrigger>
                  <SelectContent>
                    {SPACES.filter((s) => s.value !== 'all').map((space) => (
                      <SelectItem key={space.value} value={space.value}>
                        {space.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Textarea
                  placeholder="Contenu du post..."
                  value={newPost.content}
                  onChange={(e) => setNewPost((p) => ({ ...p, content: e.target.value }))}
                  rows={4}
                  aria-label="Contenu du post"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                className="bg-weds-blue hover:bg-weds-blue-700 text-white"
                onClick={handleCreatePost}
                disabled={submitting}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Publier
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Space Tabs */}
      <Tabs value={activeSpace} onValueChange={setActiveSpace}>
        <TabsList className="flex flex-wrap h-auto gap-1 bg-transparent p-0">
          {SPACES.map((space) => (
            <TabsTrigger
              key={space.value}
              value={space.value}
              className="data-[state=active]:bg-weds-blue data-[state=active]:text-white rounded-full px-3 py-1.5 text-xs sm:text-sm border"
            >
              {space.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={activeSpace} className="mt-6">
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4 space-y-3">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-16 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredPosts.length === 0 ? (
            <div className="text-center py-16">
              <MessagesSquare className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-medium text-muted-foreground">
                Aucun post dans cet espace
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Soyez le premier à partager !
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredPosts.map((post) => (
                <Card
                  key={post.id}
                  className="hover:shadow-md transition-shadow"
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-weds-blue-100 rounded-full flex items-center justify-center shrink-0">
                        <User className="h-5 w-5 text-weds-blue" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div
                          className="cursor-pointer"
                          onClick={() => handlePostClick(post.id)}
                          role="button"
                          tabIndex={0}
                          aria-label={`Voir le post ${post.title}`}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handlePostClick(post.id);
                            }
                          }}
                        >
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm">{post.author}</span>
                            <Badge variant="secondary" className="text-xs">
                              {SPACES.find((s) => s.value === post.category)?.label || post.category}
                            </Badge>
                          </div>
                          <h3 className="font-semibold mt-1">{post.title}</h3>
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-3">
                            {post.content}
                          </p>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                            <Clock className="h-3 w-3" />
                            {new Date(post.createdAt).toLocaleDateString('fr-FR', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                        </div>

                        <div className="flex items-center gap-4 mt-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            className={`gap-1 ${post.liked ? 'text-red-500' : 'text-muted-foreground'}`}
                            onClick={() => handleLike(post.id)}
                            disabled={likingId === post.id}
                            aria-label={post.liked ? 'Retirer le like' : 'Liker'}
                          >
                            <Heart
                              className={`h-4 w-4 ${post.liked ? 'fill-red-500' : ''}`}
                            />
                            <span className="text-xs">{post.likesCount}</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1 text-muted-foreground"
                            onClick={() => handlePostClick(post.id)}
                            aria-label="Commentaires"
                          >
                            <MessageSquare className="h-4 w-4" />
                            <span className="text-xs">{post.commentsCount}</span>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
