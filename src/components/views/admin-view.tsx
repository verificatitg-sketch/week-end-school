'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Users,
  BookOpen,
  Award,
  AlertTriangle,
  FileText,
  GraduationCap,
  TrendingUp,
  Activity,
  Briefcase,
  HandHelping,
  MessageSquare,
  Shield,
  Copy,
  CheckCircle2,
  Siren,
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n/useTranslation';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

interface Stats {
  users: number;
  courses: number;
  enrollments: number;
  opportunities: number;
  sosAlerts: number;
  reports: number;
  certificates: number;
  mentors: number;
  communityPosts: number;
}

interface RecentActivity {
  users: Array<{ id: string; name: string; email: string; createdAt: string }>;
  enrollments: Array<{
    id: string;
    user: { name: string };
    course: { title: string };
    enrolledAt: string;
  }>;
  sosAlerts: Array<{
    id: string;
    user: { name: string };
    status: string;
    createdAt: string;
  }>;
}

interface AdminData {
  stats: Stats;
  recentActivity: RecentActivity;
  distributions: {
    roles: Record<string, number>;
    sosStatus: Record<string, number>;
  };
}

const CHART_COLORS = ['#059669', '#0d9488', '#0ea5e9', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899'];

export function AdminView() {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const { t } = useTranslation();

  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState(false);

  const handleCopyId = () => {
    if (user?.id) {
      navigator.clipboard.writeText(user.id);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const res = await fetch('/api/admin/stats', { headers });
        if (res.ok) {
          const result = await res.json();
          setData(result);
        }
      } catch {
        // Silently handle
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [token]);

  // Show only for admin users
  const roleName = typeof user?.role === 'string' ? user.role : user?.role?.name;
  if (roleName !== 'SUPER_ADMIN' && roleName !== 'ADMIN') {
    return (
      <div className="flex flex-col items-center justify-center py-20 p-4">
        <AlertTriangle className="h-16 w-16 text-amber-500 mb-4" />
        <p className="text-lg font-medium text-muted-foreground">{t('admin.restricted')}</p>
        <p className="text-sm text-muted-foreground mt-1">
          {t('admin.restrictedMessage')}
        </p>
      </div>
    );
  }

  const statCards = [
    { title: t('admin.users'), value: data?.stats?.users || 0, icon: Users, color: 'text-weds-blue', bg: 'bg-weds-blue-50' },
    { title: t('admin.courses'), value: data?.stats?.courses || 0, icon: BookOpen, color: 'text-weds-blue', bg: 'bg-weds-blue-50' },
    { title: t('admin.enrollments'), value: data?.stats?.enrollments || 0, icon: GraduationCap, color: 'text-green-600', bg: 'bg-green-50' },
    { title: t('admin.opportunities'), value: data?.stats?.opportunities || 0, icon: Briefcase, color: 'text-cyan-600', bg: 'bg-cyan-50' },
    { title: t('admin.sosAlerts'), value: data?.stats?.sosAlerts || 0, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
    { title: t('admin.reports'), value: data?.stats?.reports || 0, icon: FileText, color: 'text-amber-600', bg: 'bg-amber-50' },
    { title: t('admin.certificates'), value: data?.stats?.certificates || 0, icon: Award, color: 'text-violet-600', bg: 'bg-violet-50' },
    { title: t('admin.mentors'), value: data?.stats?.mentors || 0, icon: HandHelping, color: 'text-pink-600', bg: 'bg-pink-50' },
    { title: t('admin.communityPosts'), value: data?.stats?.communityPosts || 0, icon: MessageSquare, color: 'text-orange-600', bg: 'bg-orange-50' },
  ];

  // Transform role distribution for pie chart
  const roleData = data?.distributions?.roles
    ? Object.entries(data.distributions.roles).map(([name, value]) => ({ name, value }))
    : [{ name: t('common.noData'), value: 1 }];

  // SOS status distribution
  const sosData = data?.distributions?.sosStatus
    ? Object.entries(data.distributions.sosStatus).map(([name, value]) => ({ name, value }))
    : [{ name: t('common.noData'), value: 1 }];

  // Mock trend data (would come from real analytics)
  const trendData = [
    { month: t('admin.monthJan'), count: 5 },
    { month: t('admin.monthFeb'), count: 12 },
    { month: t('admin.monthMar'), count: 18 },
    { month: t('admin.monthApr'), count: 25 },
    { month: t('admin.monthMay'), count: 34 },
    { month: t('admin.monthJun'), count: data?.stats?.users || 42 },
  ];

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-weds-blue-800 dark:text-weds-blue-100">{t('admin.title')}</h1>
        <p className="text-muted-foreground mt-1">
          {t('admin.subtitle')}
        </p>
      </div>

      {/* Admin ID Card - Important for SOS */}
      <Card className="border-weds-blue-100 bg-gradient-to-r from-weds-blue-50 to-weds-blue-50">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-weds-blue rounded-xl flex items-center justify-center shrink-0">
              <Shield className="h-7 w-7 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-bold text-weds-blue-800">{user?.name || t('admin.administrator')}</p>
                <Badge className="bg-weds-blue-100 text-weds-blue-700 border-0 text-xs">
                  {typeof user?.role === 'string' ? user.role : (user?.role as Record<string, string>)?.name || 'ADMIN'}
                </Badge>
                <Badge className="bg-red-100 text-red-800 border-0 text-xs gap-1">
                  <Siren className="h-3 w-3" />
                  {t('sos.receptorSOS')}
                </Badge>
              </div>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-xs text-weds-blue font-medium">{t('admin.idLabel')}</span>
                <span className="text-xs text-weds-blue-700 font-mono font-bold bg-white px-2 py-0.5 rounded border border-weds-blue-100 break-all">
                  {user?.id || 'N/A'}
                </span>
                <button
                  onClick={handleCopyId}
                  className="text-weds-blue hover:text-weds-blue-700 transition shrink-0 p-1 hover:bg-weds-blue-100 rounded"
                  aria-label={t('admin.copyIdAria')}
                >
                  {copiedId ? <CheckCircle2 className="h-4 w-4 text-weds-blue" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-[10px] text-weds-blue mt-1">
                {t('sos.adminIdHelper')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-9 gap-3">
        {loading
          ? Array.from({ length: 9 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-3">
                  <Skeleton className="h-6 w-6 rounded-lg mb-2" />
                  <Skeleton className="h-3 w-14 mb-1" />
                  <Skeleton className="h-5 w-8" />
                </CardContent>
              </Card>
            ))
          : statCards.map((card) => (
              <Card key={card.title} className="hover:shadow-md transition-shadow">
                <CardContent className="p-3">
                  <div className={`w-6 h-6 ${card.bg} rounded-lg flex items-center justify-center mb-1.5`}>
                    <card.icon className={`h-3.5 w-3.5 ${card.color}`} />
                  </div>
                  <p className="text-[10px] text-muted-foreground">{card.title}</p>
                  <p className="text-lg font-bold">{card.value}</p>
                </CardContent>
              </Card>
            ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Registration Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-weds-blue" />
              {t('admin.userRegistration')}
            </CardTitle>
            <CardDescription>{t('admin.monthlyEvolution')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#059669"
                    strokeWidth={2}
                    dot={{ fill: '#059669', r: 4 }}
                    activeDot={{ r: 6 }}
                    name={t('admin.enrollmentsLineName')}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Role Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-5 w-5 text-weds-blue" />
              {t('admin.roleDistribution')}
            </CardTitle>
            <CardDescription>{t('admin.userDistribution')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={roleData}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {roleData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SOS Status Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            {t('admin.sosStatus')}
          </CardTitle>
          <CardDescription>{t('admin.sosStatusSubtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sosData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#dc2626" radius={[4, 4, 0, 0]} name={t('admin.alertsBarName')} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Users */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-5 w-5 text-weds-blue" />
              {t('admin.recentUsers')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('admin.nameCol')}</TableHead>
                    <TableHead>{t('admin.dateCol')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.recentActivity?.users || []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center text-muted-foreground py-8">
                        {t('admin.noRecentUsers')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    (data?.recentActivity?.users || []).map((u) => (
                      <TableRow key={u.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{u.name}</p>
                            <p className="text-xs text-muted-foreground">{u.email}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {new Date(u.createdAt).toLocaleDateString('fr-FR')}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Recent Enrollments */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-5 w-5 text-weds-blue" />
              {t('admin.recentEnrollments')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('admin.userCol')}</TableHead>
                    <TableHead>{t('admin.courseCol')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.recentActivity?.enrollments || []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center text-muted-foreground py-8">
                        {t('admin.noRecentEnrollments')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    (data?.recentActivity?.enrollments || []).map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="font-medium text-sm">{e.user.name}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">
                            {e.course.title}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
