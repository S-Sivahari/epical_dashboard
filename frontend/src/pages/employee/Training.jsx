import { useEffect, useMemo, useState } from 'react'
import { Search, BookOpen, CheckCircle2, ExternalLink, GraduationCap } from 'lucide-react'
import { Button } from '@components/employee/ui/button'
import { Input } from '@components/employee/ui/input'
import { Badge } from '@components/employee/ui/badge'
import { KPIStatCard } from '@components/employee/shared/KPIStatCard'
import { useToast } from '@components/employee/shared/ToastProvider'
import { listCourses, listEnrollments, enrollEmployee, markComplete } from '@services/trainingService'
import { useAuthStore } from '@store/authStore'
import { InteractiveCard, portalCardClass } from '@components/employee/shared/interactiveCard'
import { cn } from '@pages/employee/lib/utils'

const tabs = [
  { id: 'enrollment', label: 'Enrollment', icon: BookOpen },
  { id: 'completed', label: 'Completed', icon: CheckCircle2 },
]

export default function Training() {
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [allEnrollments, setAllEnrollments] = useState([])
  const [loadingEnrollments, setLoadingEnrollments] = useState(false)
  const [enrollingId, setEnrollingId] = useState(null)
  const [completingId, setCompletingId] = useState(null)
  const [tab, setTab] = useState('enrollment')
  const { toast } = useToast()
  const user = useAuthStore((s) => s.user)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const data = await listCourses()
        setCourses(data)
      } catch (e) {
        toast({ title: 'Error', description: 'Failed to load courses' })
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [toast])

  useEffect(() => {
    if (!user?.id) return
    const loadAll = async () => {
      setLoadingEnrollments(true)
      try {
        const data = await listEnrollments({ employee: user.id })
        setAllEnrollments(data)
      } catch {
        toast({ title: 'Error', description: 'Failed to load enrollments' })
      } finally {
        setLoadingEnrollments(false)
      }
    }
    void loadAll()
  }, [toast, user?.id])

  const term = search.trim().toLowerCase()
  const matchesCourseSearch = (c) => {
    if (!term) return true
    return (
      (c.title || '').toLowerCase().includes(term) ||
      (c.topic || '').toLowerCase().includes(term) ||
      (c.platform || '').toLowerCase().includes(term)
    )
  }

  const enrollmentCourseIdsCompleted = useMemo(() => {
    const ids = new Set()
    allEnrollments.forEach((e) => {
      if (e.status === 'Completed') ids.add(e.courseId)
    })
    return ids
  }, [allEnrollments])

  const enrolledCount = useMemo(
    () => allEnrollments.filter((e) => e.status === 'Enrolled').length,
    [allEnrollments],
  )
  const completedCount = useMemo(
    () => allEnrollments.filter((e) => e.status === 'Completed').length,
    [allEnrollments],
  )

  const statusByCourse = useMemo(() => {
    const map = {}
    allEnrollments.forEach((e) => {
      map[e.courseId] = { status: e.status, enrollmentId: e.id }
    })
    return map
  }, [allEnrollments])

  const enrollmentTabCourses = useMemo(() => {
    return courses.filter((c) => !enrollmentCourseIdsCompleted.has(c.id)).filter(matchesCourseSearch)
  }, [courses, enrollmentCourseIdsCompleted, term, search])

  const completedCards = useMemo(() => {
    return allEnrollments
      .filter((e) => e.status === 'Completed')
      .filter((e) => {
        if (!term) return true
        const t = `${e.courseTitle ?? ''} ${e.topic ?? ''}`.toLowerCase()
        return t.includes(term)
      })
      .sort((a, b) => {
        const da = new Date(a.completedAt || a.enrolledAt || 0).getTime()
        const db = new Date(b.completedAt || b.enrolledAt || 0).getTime()
        return db - da
      })
  }, [allEnrollments, term, search])

  const handleEnroll = async (courseId) => {
    if (!user?.id || !user.name) {
      toast({ title: 'Not allowed', description: 'Login required to enroll.' })
      return
    }
    setEnrollingId(courseId)
    try {
      const record = await enrollEmployee({
        courseId,
        employeeId: user.id,
        employeeName: user.name,
      })
      setAllEnrollments((prev) => [record, ...prev])
      toast({ title: 'Enrolled', description: 'You have been enrolled.' })
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to enroll' })
    } finally {
      setEnrollingId(null)
    }
  }

  const handleComplete = async (enrollmentId) => {
    setCompletingId(enrollmentId)
    try {
      const updated = await markComplete(enrollmentId)
      setAllEnrollments((prev) => prev.map((e) => (e.id === enrollmentId ? updated : e)))
      toast({ title: 'Completed', description: 'Course marked as completed.' })
    } catch {
      toast({ title: 'Error', description: 'Failed to update status' })
    } finally {
      setCompletingId(null)
    }
  }

  return (
    <div className="employee-training-page space-y-6 pb-8" data-page-scrollable>
      <div className="grid gap-4 sm:grid-cols-3">
        <KPIStatCard title="Available Courses" value={String(courses.length)} icon={BookOpen} toneIndex={0} />
        <KPIStatCard title="Enrolled" value={String(enrolledCount)} icon={GraduationCap} toneIndex={1} />
        <KPIStatCard title="Completed" value={String(completedCount)} icon={CheckCircle2} toneIndex={2} />
      </div>

      <div
        className="employee-documents-tab-rail inline-flex w-full max-w-md rounded-xl border p-1 sm:w-auto"
        role="tablist"
        aria-label="Training sections"
      >
        {tabs.map((t) => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'employee-documents-tab-btn flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all duration-200 sm:flex-none sm:min-w-[10.5rem]',
                tab === t.id ? 'employee-documents-tab-btn--active' : 'employee-documents-tab-btn--inactive',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              {t.label}
            </button>
          )
        })}
      </div>

      <div className="transition-opacity duration-200">
      {tab === 'enrollment' ? (
        <div className="space-y-4" role="tabpanel" aria-label="Enrollment">
          <div className="relative max-w-xl">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search courses to enroll or continue…"
              className="pl-9"
            />
          </div>
          <div>
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <GraduationCap className="h-5 w-5" aria-hidden />
              </div>
              <div>
                <h3 className="font-heading text-lg font-semibold text-foreground">Courses in progress & available</h3>
                <p className="mt-0.5 text-sm text-muted">
                  Browse and enroll in new courses or mark enrolled ones complete.
                </p>
              </div>
            </div>
            {loading || loadingEnrollments ? (
              <p className="text-sm text-muted">Loading courses…</p>
            ) : enrollmentTabCourses.length === 0 ? (
              <p className="text-sm text-muted">No courses match your search, or everything is completed.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {enrollmentTabCourses.map((course) => (
                  <InteractiveCard
                    key={course.id}
                    selectable={false}
                    className={portalCardClass({ className: 'p-5' })}
                  >
                    <div className="flex items-start justify-between">
                      <Badge variant="secondary">{course.platform || 'Platform'}</Badge>
                    </div>
                    <h4 className="mt-3 font-heading font-semibold">{course.title}</h4>
                    <p className="mt-1 text-sm text-muted">{course.topic}</p>
                    <div className="mt-4 flex gap-2">
                      <Button size="sm" variant="outline" asChild>
                        <a href={course.link} target="_blank" rel="noreferrer">
                          <ExternalLink className="h-4 w-4 mr-1" />
                          View Course
                        </a>
                      </Button>
                      {statusByCourse[course.id]?.status === 'Enrolled' ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={completingId === statusByCourse[course.id]?.enrollmentId}
                          onClick={() => void handleComplete(statusByCourse[course.id].enrollmentId)}
                        >
                          {completingId === statusByCourse[course.id]?.enrollmentId
                            ? 'Updating…'
                            : 'Mark Complete'}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          disabled={enrollingId === course.id}
                          onClick={() => void handleEnroll(course.id)}
                        >
                          {enrollingId === course.id ? 'Enrolling…' : 'Enroll'}
                        </Button>
                      )}
                    </div>
                  </InteractiveCard>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4" role="tabpanel" aria-label="Completed">
          <div className="relative max-w-xl">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search completed courses…"
              className="pl-9"
            />
          </div>
          <div>
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <CheckCircle2 className="h-5 w-5" aria-hidden />
              </div>
              <div>
                <h3 className="font-heading text-lg font-semibold text-foreground">Completed</h3>
                <p className="mt-0.5 text-sm text-muted">Courses you have finished.</p>
              </div>
            </div>
            {loadingEnrollments ? (
              <p className="text-sm text-muted">Loading…</p>
            ) : completedCards.length === 0 ? (
              <p className="text-sm text-muted">No completed courses yet.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {completedCards.map((e) => {
                  const link = courses.find((c) => c.id === e.courseId)?.link
                  return (
                    <InteractiveCard
                      key={e.id}
                      selectable={false}
                      className={portalCardClass({ className: 'p-5' })}
                    >
                      <Badge variant="success">Completed</Badge>
                      <h4 className="mt-3 font-heading font-semibold">{e.courseTitle}</h4>
                      <p className="mt-1 text-sm text-muted">{e.topic}</p>
                      <div className="mt-4">
                        {link ? (
                          <Button size="sm" variant="outline" asChild>
                            <a href={link} target="_blank" rel="noreferrer">
                              <ExternalLink className="h-4 w-4 mr-1" />
                              View course
                            </a>
                          </Button>
                        ) : (
                          <span className="text-xs text-muted">Course link unavailable</span>
                        )}
                      </div>
                    </InteractiveCard>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
