import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Search, BookOpen, CheckCircle2, ExternalLink } from 'lucide-react'
import { Button } from '@components/employee/ui/button'
import { Input } from '@components/employee/ui/input'
import { Badge } from '@components/employee/ui/badge'
import { KPIStatCard } from '@components/employee/shared/KPIStatCard'
import { useToast } from '@components/employee/shared/ToastProvider'
import { listCourses, listEnrollments, enrollEmployee, markComplete } from '@services/trainingService'
import { useAuthStore } from '@store/authStore'
import { portalCardClass } from '@components/employee/shared/interactiveCard'

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
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <KPIStatCard title="Available Courses" value={String(courses.length)} icon={BookOpen} toneIndex={0} />
        <KPIStatCard title="Enrolled" value={String(enrolledCount)} icon={BookOpen} toneIndex={1} />
        <KPIStatCard title="Completed" value={String(completedCount)} icon={CheckCircle2} toneIndex={2} />
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border pb-3">
        {[
          ['enrollment', 'Enrollment'],
          ['completed', 'Completed'],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`rounded-lg px-3 py-2 text-sm font-medium ${
              tab === key
                ? 'bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200'
                : 'text-muted hover:bg-muted/30'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'enrollment' ? (
        <div className="space-y-4">
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
            <h3 className="mb-2 font-heading text-lg font-semibold">Courses in progress & available</h3>
            <p className="mb-4 text-sm text-muted">Browse and enroll in new courses or mark enrolled ones complete.</p>
            {loading || loadingEnrollments ? (
              <p className="text-sm text-muted">Loading courses…</p>
            ) : enrollmentTabCourses.length === 0 ? (
              <p className="text-sm text-muted">No courses match your search, or everything is completed.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {enrollmentTabCourses.map((course) => (
                  <motion.div
                    key={course.id}
                    whileHover={{ y: -4 }}
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
                          variant="danger"
                          disabled={enrollingId === course.id}
                          onClick={() => void handleEnroll(course.id)}
                        >
                          {enrollingId === course.id ? 'Enrolling…' : 'Enroll'}
                        </Button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
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
            <h3 className="mb-2 font-heading text-lg font-semibold">Completed</h3>
            <p className="mb-4 text-sm text-muted">Courses you have finished.</p>
            {loadingEnrollments ? (
              <p className="text-sm text-muted">Loading…</p>
            ) : completedCards.length === 0 ? (
              <p className="text-sm text-muted">No completed courses yet.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {completedCards.map((e) => {
                  const link = courses.find((c) => c.id === e.courseId)?.link
                  return (
                    <motion.div
                      key={e.id}
                      whileHover={{ y: -4 }}
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
                    </motion.div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
