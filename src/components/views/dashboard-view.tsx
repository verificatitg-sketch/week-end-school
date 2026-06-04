'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/store/app-store';
import { useAuthStore } from '@/store/auth-store';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BookOpen,
  Award,
  Briefcase,
  AlertTriangle,
  GraduationCap,
  Heart,
  ArrowRight,
  Quote,
  Activity,
} from 'lucide-react';

interface Stats {
  totalUsers: number;
  totalCourses: number;
  totalEnrollments: number;
  totalSOS: number;
  totalReports: number;
  totalCertificates: number;
}

interface Enrollment {
  id: string;
  courseId: string;
  courseTitle: string;
  progress: number;
  enrolledAt: string;
}

export function DashboardView() {
  const setView = useAppStore((s) => s.setView);
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const { t } = useTranslation();

  const [stats, setStats] = useState<Stats | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const [statsRes, enrollRes] = await Promise.all([
          fetch('/api/admin/stats', { headers }),
          fetch('/api/enrollments', { headers }),
        ]);

        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setStats(statsData);
        }
        if (enrollRes.ok) {
          const enrollData = await enrollRes.json();
          setEnrollments(enrollData.enrollments || enrollData || []);
        }
      } catch {
        // Silently handle errors
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [token]);

  const firstName = user?.name?.split(' ')[0] || t('dashboard.defaultName');

  const statCards = [
    {
      title: t('dashboard.currentCourses'),
      value: enrollments.filter((e) => e.progress < 100).length,
      icon: BookOpen,
      color: 'text-weds-blue',
      bg: 'bg-weds-blue-50',
    },
    {
      title: t('dashboard.certificates'),
      value: stats?.totalCertificates || 0,
      icon: Award,
      color: 'text-weds-blue',
      bg: 'bg-weds-blue-50',
    },
    {
      title: t('dashboard.opportunities'),
      value: stats?.totalEnrollments || 0,
      icon: Briefcase,
      color: 'text-weds-blue',
      bg: 'bg-weds-blue-50',
    },
    {
      title: t('dashboard.sosAlerts'),
      value: stats?.totalSOS || 0,
      icon: AlertTriangle,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
  ];

  const quickActions = [
    { label: t('dashboard.viewCourses'), icon: GraduationCap, view: 'courses' as const, color: 'from-weds-blue to-weds-blue-700' },
    { label: t('dashboard.opportunities'), icon: Briefcase, view: 'opportunities' as const, color: 'from-weds-blue to-weds-blue-700' },
    { label: t('dashboard.report'), icon: AlertTriangle, view: 'alerts' as const, color: 'from-amber-500 to-amber-600' },
    { label: 'SOS', icon: Heart, view: 'sos' as const, color: 'from-red-500 to-red-600' },
  ];

  const recentActivities = [
    { text: t('dashboard.activity.newCourse'), time: t('dashboard.activity.2hAgo'), icon: BookOpen },
    { text: t('dashboard.activity.scholarship'), time: t('dashboard.activity.5hAgo'), icon: Briefcase },
    { text: t('dashboard.activity.communityPost'), time: t('dashboard.activity.1dAgo'), icon: Activity },
    { text: t('dashboard.activity.mentorshipSession'), time: t('dashboard.activity.2dAgo'), icon: Heart },
  ];

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-weds-blue via-weds-blue-700 to-weds-blue rounded-2xl p-6 md:p-8 text-white">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">
              {t('dashboard.welcome')}, {firstName} ! 👋
            </h1>
            <p className="text-weds-blue-100 mt-1">
              {t('dashboard.continueJourney')}
            </p>
          </div>
          <div className="flex items-center gap-2 bg-white/10 rounded-xl px-4 py-3 backdrop-blur-sm">
            <Quote className="h-5 w-5 text-weds-blue-100" />
            <p className="text-sm italic text-weds-blue-100">
              {t('dashboard.quote')}
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-10 w-10 rounded-lg mb-3" />
                  <Skeleton className="h-4 w-20 mb-2" />
                  <Skeleton className="h-8 w-12" />
                </CardContent>
              </Card>
            ))
          : statCards.map((card) => (
              <Card key={card.title} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className={`w-10 h-10 ${card.bg} rounded-lg flex items-center justify-center mb-3`}>
                    <card.icon className={`h-5 w-5 ${card.color}`} />
                  </div>
                  <p className="text-sm text-muted-foreground">{card.title}</p>
                  <p className="text-2xl font-bold">{card.value}</p>
                </CardContent>
              </Card>
            ))}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold mb-3">{t('dashboard.quickActions')}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {quickActions.map((action) => (
            <Button
              key={action.label}
              variant="outline"
              className="h-auto py-4 flex flex-col items-center gap-2 hover:shadow-md transition-all"
              onClick={() => setView(action.view)}
              aria-label={action.label}
            >
              <div className={`w-10 h-10 rounded-lg bg-gradient-to-r ${action.color} flex items-center justify-center`}>
                <action.icon className="h-5 w-5 text-white" />
              </div>
              <span className="text-sm font-medium">{action.label}</span>
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('dashboard.recentActivity')}</CardTitle>
            <CardDescription>{t('dashboard.recentActivityDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivities.map((activity, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-weds-blue-50 rounded-lg flex items-center justify-center shrink-0">
                    <activity.icon className="h-4 w-4 text-weds-blue" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{activity.text}</p>
                    <p className="text-xs text-muted-foreground">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* My Enrolled Courses */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">{t('dashboard.myCourses')}</CardTitle>
              <CardDescription>{t('dashboard.progress')}</CardDescription>
            </div>
            <Button variant="ghost" size="sm" className="text-weds-blue" onClick={() => setView('my-courses')}>
              {t('dashboard.viewAll')} <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-2 w-full" />
                  </div>
                ))}
              </div>
            ) : enrollments.length === 0 ? (
              <div className="text-center py-8">
                <GraduationCap className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  {t('dashboard.notEnrolled')}
                </p>
                <Button
                  variant="link"
                  className="text-weds-blue mt-2"
                  onClick={() => setView('courses')}
                >
                  {t('dashboard.exploreCourses')}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {enrollments.slice(0, 4).map((enrollment) => (
                  <div key={enrollment.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium truncate">{enrollment.courseTitle}</p>
                      <span className="text-xs text-muted-foreground shrink-0 ml-2">
                        {enrollment.progress}%
                      </span>
                    </div>
                    <div className="h-2 bg-weds-blue-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-weds-blue to-weds-blue-700 rounded-full transition-all"
                        style={{ width: `${enrollment.progress}%` }}
                      />
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
