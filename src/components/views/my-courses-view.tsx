'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/store/app-store';
import { useAuthStore } from '@/store/auth-store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { BookOpen, Award, ArrowRight, CheckCircle2, Clock } from 'lucide-react';

interface Enrollment {
  id: string;
  courseId: string;
  courseTitle: string;
  courseCategory: string;
  progress: number;
  enrolledAt: string;
  completed: boolean;
  certificateId?: string;
}

export function MyCoursesView() {
  const setView = useAppStore((s) => s.setView);
  const setSelectedCourseId = useAppStore((s) => s.setSelectedCourseId);
  const token = useAuthStore((s) => s.token);

  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEnrollments = async () => {
      try {
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const res = await fetch('/api/enrollments', { headers });
        if (res.ok) {
          const data = await res.json();
          setEnrollments(data.enrollments || data || []);
        }
      } catch {
        // Silently handle
      } finally {
        setLoading(false);
      }
    };
    fetchEnrollments();
  }, [token]);

  const handleCourseClick = (courseId: string) => {
    setSelectedCourseId(courseId);
    setView('course-detail');
  };

  const inProgress = enrollments.filter((e) => !e.completed);
  const completed = enrollments.filter((e) => e.completed);

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-weds-blue-800">Mes formations</h1>
          <p className="text-muted-foreground mt-1">
            Suivez votre progression et obtenez vos certificats
          </p>
        </div>
        <Button
          className="bg-weds-blue hover:bg-weds-blue-700 text-white"
          onClick={() => setView('courses')}
          aria-label="Explorer les formations"
        >
          <BookOpen className="h-4 w-4 mr-2" />
          Explorer
        </Button>
      </div>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex gap-4">
                  <Skeleton className="h-20 w-20 rounded-lg shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-2 w-full" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : enrollments.length === 0 ? (
        <div className="text-center py-16">
          <BookOpen className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <p className="text-lg font-medium text-muted-foreground">
            Aucune formation commencée
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Explorez notre catalogue et inscrivez-vous à votre premier cours
          </p>
          <Button
            variant="link"
            className="text-weds-blue mt-3"
            onClick={() => setView('courses')}
          >
            Voir les formations
          </Button>
        </div>
      ) : (
        <>
          {/* In Progress */}
          {inProgress.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Clock className="h-5 w-5 text-weds-blue" />
                En cours ({inProgress.length})
              </h2>
              <div className="space-y-3">
                {inProgress.map((enrollment) => (
                  <Card
                    key={enrollment.id}
                    className="hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => handleCourseClick(enrollment.courseId)}
                    role="button"
                    tabIndex={0}
                    aria-label={`Voir le cours ${enrollment.courseTitle}`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleCourseClick(enrollment.courseId);
                      }
                    }}
                  >
                    <CardContent className="p-4">
                      <div className="flex gap-4">
                        <div className="w-16 h-16 bg-gradient-to-br from-weds-blue-100 to-weds-blue-100 rounded-lg flex items-center justify-center shrink-0">
                          <BookOpen className="h-7 w-7 text-weds-blue" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <Badge variant="secondary" className="text-xs mb-1">
                                {enrollment.courseCategory}
                              </Badge>
                              <h3 className="font-semibold text-sm truncate">
                                {enrollment.courseTitle}
                              </h3>
                            </div>
                            <Button variant="ghost" size="sm" className="text-weds-blue shrink-0">
                              <ArrowRight className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="mt-2">
                            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                              <span>Progression</span>
                              <span>{enrollment.progress}%</span>
                            </div>
                            <Progress value={enrollment.progress} className="h-2" />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Completed */}
          {completed.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-weds-blue" />
                Terminées ({completed.length})
              </h2>
              <div className="space-y-3">
                {completed.map((enrollment) => (
                  <Card
                    key={enrollment.id}
                    className="hover:shadow-md transition-shadow cursor-pointer border-weds-blue-100"
                    onClick={() => handleCourseClick(enrollment.courseId)}
                    role="button"
                    tabIndex={0}
                    aria-label={`Voir le cours ${enrollment.courseTitle}`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleCourseClick(enrollment.courseId);
                      }
                    }}
                  >
                    <CardContent className="p-4">
                      <div className="flex gap-4">
                        <div className="w-16 h-16 bg-gradient-to-br from-weds-blue-100 to-green-100 rounded-lg flex items-center justify-center shrink-0 relative">
                          <BookOpen className="h-7 w-7 text-weds-blue" />
                          {enrollment.certificateId && (
                            <Award className="h-5 w-5 text-amber-500 absolute -top-1 -right-1" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h3 className="font-semibold text-sm truncate">
                                {enrollment.courseTitle}
                              </h3>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge className="bg-weds-blue-100 text-weds-blue-700 border-0">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Complété
                                </Badge>
                                {enrollment.certificateId && (
                                  <Badge className="bg-amber-100 text-amber-700 border-0">
                                    <Award className="h-3 w-3 mr-1" />
                                    Certificat
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
