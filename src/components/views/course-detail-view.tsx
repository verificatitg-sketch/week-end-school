'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/store/app-store';
import { useAuthStore } from '@/store/auth-store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Circle,
  Clock,
  Star,
  Users,
  PlayCircle,
  Loader2,
} from 'lucide-react';

interface Lesson {
  id: string;
  title: string;
  duration: string;
  completed: boolean;
}

interface Module {
  id: string;
  title: string;
  lessons: Lesson[];
}

interface CourseDetail {
  id: string;
  title: string;
  description: string;
  category: string;
  level: string;
  rating: number;
  enrolledCount: number;
  duration: string;
  modules: Module[];
  isEnrolled: boolean;
  progress: number;
}

export function CourseDetailView() {
  const setView = useAppStore((s) => s.setView);
  const selectedCourseId = useAppStore((s) => s.selectedCourseId);
  const token = useAuthStore((s) => s.token);
  const { toast } = useToast();

  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);

  useEffect(() => {
    if (!selectedCourseId) {
      setView('courses');
      return;
    }
    const fetchCourse = async () => {
      try {
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const res = await fetch(`/api/courses/${selectedCourseId}`, { headers });
        if (res.ok) {
          const data = await res.json();
          setCourse(data.course || data);
        }
      } catch {
        // Silently handle
      } finally {
        setLoading(false);
      }
    };
    fetchCourse();
  }, [selectedCourseId, token, setView]);

  const handleEnroll = async () => {
    if (!selectedCourseId || !token) return;
    setEnrolling(true);
    try {
      const res = await fetch('/api/enrollments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ courseId: selectedCourseId }),
      });
      if (res.ok) {
        toast({ title: 'Inscription réussie !', description: 'Vous êtes maintenant inscrit(e) à ce cours.' });
        setCourse((prev) => prev ? { ...prev, isEnrolled: true, progress: 0 } : prev);
      } else {
        const data = await res.json();
        toast({ title: 'Erreur', description: data.error || "Erreur lors de l'inscription", variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Erreur', description: 'Erreur de connexion', variant: 'destructive' });
    } finally {
      setEnrolling(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-48 w-full" />
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="flex flex-col items-center justify-center py-20 p-4">
        <BookOpen className="h-16 w-16 text-muted-foreground mb-4" />
        <p className="text-lg font-medium text-muted-foreground">Cours non trouvé</p>
        <Button variant="link" className="text-weds-blue mt-2" onClick={() => setView('courses')}>
          Retour aux cours
        </Button>
      </div>
    );
  }

  const totalLessons = course.modules?.reduce((sum, m) => sum + (m.lessons?.length || 0), 0) || 0;
  const completedLessons = course.modules?.reduce(
    (sum, m) => sum + (m.lessons?.filter((l) => l.completed).length || 0),
    0
  ) || 0;

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Back button */}
      <Button
        variant="ghost"
        className="text-weds-blue-700 gap-2"
        onClick={() => setView('courses')}
        aria-label="Retour aux cours"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour aux cours
      </Button>

      {/* Course Header */}
      <div className="bg-gradient-to-r from-weds-blue via-weds-blue-700 to-green-600 rounded-2xl p-6 md:p-8 text-white">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="flex-1">
            <Badge className="bg-white/20 text-white border-0 mb-3">
              {course.category}
            </Badge>
            <h1 className="text-2xl md:text-3xl font-bold">{course.title}</h1>
            <p className="text-weds-blue-100 mt-2 line-clamp-3">{course.description}</p>
            <div className="flex items-center gap-4 mt-4 text-sm text-weds-blue-100">
              <span className="flex items-center gap-1">
                <Star className="h-4 w-4 text-amber-300 fill-amber-300" />
                {course.rating?.toFixed(1) || '4.5'}
              </span>
              <span className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                {course.enrolledCount || 0} inscrits
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {course.duration || '10h'}
              </span>
              <Badge className="bg-white/20 text-white border-0">
                {course.level}
              </Badge>
            </div>
          </div>
          <div className="shrink-0">
            {course.isEnrolled ? (
              <div className="text-center">
                <p className="text-sm text-weds-blue-100 mb-2">Progression</p>
                <div className="w-32">
                  <Progress value={course.progress} className="h-3 bg-white/20" />
                  <p className="text-sm mt-1">{course.progress}%</p>
                </div>
              </div>
            ) : (
              <Button
                size="lg"
                className="bg-white text-weds-blue-700 hover:bg-weds-blue-50 font-semibold"
                onClick={handleEnroll}
                disabled={enrolling}
                aria-label="S'inscrire au cours"
              >
                {enrolling ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Inscription...
                  </>
                ) : (
                  "S'inscrire"
                )}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Course Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-weds-blue">{course.modules?.length || 0}</p>
            <p className="text-xs text-muted-foreground">Modules</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-weds-blue">{totalLessons}</p>
            <p className="text-xs text-muted-foreground">Leçons</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{completedLessons}</p>
            <p className="text-xs text-muted-foreground">Complétées</p>
          </CardContent>
        </Card>
      </div>

      {/* Modules & Lessons */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Contenu du cours</h2>
        <div className="space-y-4">
          {course.modules?.map((module, mIdx) => (
            <Card key={module.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <span className="w-7 h-7 bg-weds-blue-100 text-weds-blue-700 rounded-lg flex items-center justify-center text-sm font-semibold">
                    {mIdx + 1}
                  </span>
                  {module.title}
                </CardTitle>
                <CardDescription>
                  {module.lessons?.length || 0} leçons
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {module.lessons?.map((lesson) => (
                    <div
                      key={lesson.id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-weds-blue-50 transition-colors"
                    >
                      {lesson.completed ? (
                        <CheckCircle2 className="h-5 w-5 text-weds-blue shrink-0" />
                      ) : (
                        <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
                      )}
                      <PlayCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span
                        className={`text-sm flex-1 ${
                          lesson.completed
                            ? 'text-muted-foreground line-through'
                            : 'font-medium'
                        }`}
                      >
                        {lesson.title}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {lesson.duration}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
