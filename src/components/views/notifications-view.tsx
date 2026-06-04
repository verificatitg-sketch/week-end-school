'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  Bell,
  BookOpen,
  Award,
  Briefcase,
  AlertTriangle,
  MessageSquare,
  CheckCheck,
  Clock,
  Trash2,
} from 'lucide-react';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  createdAt: string;
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  course: BookOpen,
  certificate: Award,
  opportunity: Briefcase,
  alert: AlertTriangle,
  community: MessageSquare,
  default: Bell,
};

const TYPE_COLORS: Record<string, string> = {
  course: 'text-weds-blue bg-weds-blue-50',
  certificate: 'text-weds-blue bg-weds-blue-50',
  opportunity: 'text-green-600 bg-green-50',
  alert: 'text-amber-600 bg-amber-50',
  community: 'text-purple-600 bg-purple-50',
  default: 'text-gray-600 bg-gray-50',
};

const NOTIF_TYPES = [
  { value: 'all', label: 'Toutes' },
  { value: 'course', label: 'Cours' },
  { value: 'certificate', label: 'Certificats' },
  { value: 'opportunity', label: 'Opportunités' },
  { value: 'alert', label: 'Alertes' },
  { value: 'community', label: 'Communauté' },
];

export function NotificationsView() {
  const token = useAuthStore((s) => s.token);
  const { toast } = useToast();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeType, setActiveType] = useState('all');

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const res = await fetch('/api/notifications', { headers });
        if (res.ok) {
          const data = await res.json();
          setNotifications(data.notifications || data || []);
        }
      } catch {
        // Silently handle
      } finally {
        setLoading(false);
      }
    };
    fetchNotifications();
  }, [token]);

  const filteredNotifications =
    activeType === 'all'
      ? notifications
      : notifications.filter((n) => n.type === activeType);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAsRead = async (id: string) => {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`/api/notifications/${id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ read: true }),
      });
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, read: true } : n))
        );
      }
    } catch {
      // Silently handle
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('/api/notifications/mark-all-read', {
        method: 'PUT',
        headers,
      });
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        toast({ title: 'Toutes les notifications marquées comme lues' });
      }
    } catch {
      // Silently handle
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`/api/notifications/${id}`, {
        method: 'DELETE',
        headers,
      });
      if (res.ok) {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
        toast({ title: 'Notification supprimée' });
      }
    } catch {
      // Silently handle
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-weds-blue-800 flex items-center gap-2">
            <Bell className="h-7 w-7" />
            Notifications
          </h1>
          <p className="text-muted-foreground mt-1">
            {unreadCount > 0
              ? `${unreadCount} notification${unreadCount > 1 ? 's' : ''} non lue${unreadCount > 1 ? 's' : ''}`
              : 'Toutes les notifications sont lues'}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllRead}
            className="text-weds-blue"
            aria-label="Tout marquer comme lu"
          >
            <CheckCheck className="h-4 w-4 mr-2" />
            Tout marquer comme lu
          </Button>
        )}
      </div>

      {/* Type Filter */}
      <Tabs value={activeType} onValueChange={setActiveType}>
        <TabsList className="flex flex-wrap h-auto gap-1 bg-transparent p-0">
          {NOTIF_TYPES.map((type) => (
            <TabsTrigger
              key={type.value}
              value={type.value}
              className="data-[state=active]:bg-weds-blue data-[state=active]:text-white rounded-full px-3 py-1.5 text-xs sm:text-sm border"
            >
              {type.label}
              {type.value === 'all' && unreadCount > 0 && (
                <Badge className="ml-1.5 bg-red-500 text-white text-[10px] px-1.5 py-0 min-w-[18px]">
                  {unreadCount}
                </Badge>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={activeType} className="mt-6">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="flex gap-3">
                      <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-full" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="text-center py-16">
              <Bell className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-medium text-muted-foreground">
                Aucune notification
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Vos notifications apparaîtront ici
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredNotifications.map((notification) => {
                const IconComp = TYPE_ICONS[notification.type] || TYPE_ICONS.default;
                const colorClass = TYPE_COLORS[notification.type] || TYPE_COLORS.default;

                return (
                  <Card
                    key={notification.id}
                    className={`transition-all ${
                      !notification.read
                        ? 'border-weds-blue-100 bg-weds-blue-50/30'
                        : 'hover:shadow-sm'
                    }`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${colorClass}`}
                        >
                          <IconComp className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h3
                                className={`text-sm font-medium ${
                                  !notification.read ? 'font-semibold' : ''
                                }`}
                              >
                                {notification.title}
                              </h3>
                              <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                                {notification.message}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {!notification.read && (
                                <div className="w-2 h-2 rounded-full bg-weds-blue" />
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(notification.createdAt).toLocaleDateString('fr-FR', {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            {!notification.read && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-weds-blue h-7 text-xs"
                                onClick={() => handleMarkAsRead(notification.id)}
                                aria-label="Marquer comme lu"
                              >
                                <CheckCheck className="h-3.5 w-3.5 mr-1" />
                                Lu
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-muted-foreground h-7 text-xs"
                              onClick={() => handleDelete(notification.id)}
                              aria-label="Supprimer"
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-1" />
                              Supprimer
                            </Button>
                          </div>
                        </div>
                      </div>
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
