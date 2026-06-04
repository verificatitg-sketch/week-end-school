'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAppStore } from '@/store/app-store';
import { useAuthStore } from '@/store/auth-store';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Star, Users, Clock, BookOpen } from 'lucide-react';

interface Course {
  id: string;
  title: string;
  description: string;
  category: string;
  level: string;
  rating: number;
  enrolledCount: number;
  duration: string;
  thumbnail?: string;
}

export function CoursesView() {
  const setView = useAppStore((s) => s.setView);
  const setSelectedCourseId = useAppStore((s) => s.setSelectedCourseId);
  const token = useAuthStore((s) => s.token);
  const { t } = useTranslation();

  const CATEGORIES = [
    { value: 'all', label: t('courses.all') },
    { value: 'entrepreneuriat', label: t('courses.cat.entrepreneuriat') },
    { value: 'leadership', label: t('courses.cat.leadership') },
    { value: 'employabilite', label: t('courses.cat.employabilite') },
    { value: 'citoyennete', label: t('courses.cat.citoyennete') },
    { value: 'culture-paix', label: t('courses.cat.culturePaix') },
    { value: 'transformation-digitale', label: t('courses.cat.transformationDigitale') },
    { value: 'developpement-personnel', label: t('courses.cat.developpementPersonnel') },
  ];

  const LEVEL_COLORS: Record<string, string> = {
    'Débutant': 'bg-weds-blue-100 text-weds-blue-700',
    'Beginner': 'bg-weds-blue-100 text-weds-blue-700',
    'Intermédiaire': 'bg-weds-blue-100 text-weds-blue-700',
    'Intermediate': 'bg-weds-blue-100 text-weds-blue-700',
    'Avancé': 'bg-amber-100 text-amber-700',
    'Advanced': 'bg-amber-100 text-amber-700',
  };

  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const res = await fetch('/api/courses', { headers });
        if (res.ok) {
          const data = await res.json();
          setCourses(data.courses || data || []);
        }
      } catch {
        // Silently handle
      } finally {
        setLoading(false);
      }
    };
    fetchCourses();
  }, [token]);

  const filteredCourses = useMemo(() => {
    return courses.filter((course) => {
      const matchesSearch =
        !search ||
        course.title.toLowerCase().includes(search.toLowerCase()) ||
        course.description.toLowerCase().includes(search.toLowerCase());
      const matchesCategory =
        activeCategory === 'all' || course.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [courses, search, activeCategory]);

  const handleCourseClick = (courseId: string) => {
    setSelectedCourseId(courseId);
    setView('course-detail');
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-weds-blue-800">{t('courses.title')}</h1>
        <p className="text-muted-foreground mt-1">
          {t('courses.subtitle')}
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t('courses.search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
          aria-label={t('courses.search')}
        />
      </div>

      {/* Category Tabs */}
      <Tabs value={activeCategory} onValueChange={setActiveCategory}>
        <TabsList className="flex flex-wrap h-auto gap-1 bg-transparent p-0">
          {CATEGORIES.map((cat) => (
            <TabsTrigger
              key={cat.value}
              value={cat.value}
              className="data-[state=active]:bg-weds-blue data-[state=active]:text-white rounded-full px-3 py-1.5 text-xs sm:text-sm border"
            >
              {cat.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={activeCategory} className="mt-6">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i}>
                  <Skeleton className="h-40 w-full rounded-t-xl" />
                  <CardContent className="p-4 space-y-3">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-3 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredCourses.length === 0 ? (
            <div className="text-center py-16">
              <BookOpen className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-medium text-muted-foreground">
                {t('courses.notFound')}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCourses.map((course) => (
                <Card
                  key={course.id}
                  className="cursor-pointer hover:shadow-lg transition-all group overflow-hidden"
                  onClick={() => handleCourseClick(course.id)}
                  role="button"
                  tabIndex={0}
                  aria-label={course.title}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleCourseClick(course.id);
                    }
                  }}
                >
                  {/* Thumbnail placeholder */}
                  <div className="h-40 bg-gradient-to-br from-weds-blue-100 to-weds-blue-50 flex items-center justify-center relative">
                    <BookOpen className="h-12 w-12 text-weds-blue-600 group-hover:scale-110 transition-transform" />
                    <Badge
                      className={`absolute top-3 right-3 ${LEVEL_COLORS[course.level] || 'bg-gray-100 text-gray-700'}`}
                    >
                      {course.level}
                    </Badge>
                  </div>
                  <CardContent className="p-4">
                    <Badge variant="secondary" className="mb-2 text-xs">
                      {course.category}
                    </Badge>
                    <CardTitle className="text-base line-clamp-2 group-hover:text-weds-blue-700 transition-colors">
                      {course.title}
                    </CardTitle>
                    <CardDescription className="mt-1 line-clamp-2 text-xs">
                      {course.description}
                    </CardDescription>
                    <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                        {course.rating?.toFixed(1) || '4.5'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {course.enrolledCount || 0}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {course.duration || '10h'}
                      </span>
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
