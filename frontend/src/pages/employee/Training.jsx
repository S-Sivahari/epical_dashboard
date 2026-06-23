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
      } catch {
        toast({ title: 'Error', description: 'Failed To Load courses' })
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
        toast({ title: 'Error', description: 'Failed To Load Enrollments' })
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
  }, [courses, enrollmentCourseIdsCompleted, term])

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
  }, [allEnrollments, term])

  const handleEnroll = async (courseId) => {
    if (!user?.id || !user.name) {
      toast({ title: 'Not Allowed', description: 'Login Required To Enroll.' })
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
      toast({ title: 'Enrolled', description: 'You Have Been Enrolled.' })
    } catch {
      toast({ title: 'Error', description: 'Failed To Enroll' })
    } finally {
      setEnrollingId(null)
    }
  }

  const handleComplete = async (enrollmentId) => {
    setCompletingId(enrollmentId)
    try {
      const updated = await markComplete(enrollmentId)
      setAllEnrollments((prev) => prev.map((e) => (e.id === enrollmentId ? updated : e)))
      toast({ title: 'Completed', description: 'Course Marked As Completed.' })
    } catch {
      toast({ title: 'Error', description: 'Failed To Update Status' })
    } finally {
      setCompletingId(null)
    }
  }

  const renderSearch = (placeholder) => (
    <div className="employee-training-search">
      <Search className="employee-training-search-icon" aria-hidden />
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={placeholder}
        className="employee-training-search-input"
        aria-label={placeholder}
      />
    </div>
  )

  const renderEmpty = ({ icon: Icon, title, description }) => (
    <div className="employee-training-empty">
      <Icon className="employee-training-empty-icon" aria-hidden />
      <p className="employee-training-empty-title">{title}</p>
      <p className="employee-training-empty-text">{description}</p>
    </div>
  )

  const renderCourseActions = (course) => {
    const enrolled = statusByCourse[course.id]?.status === 'Enrolled'
    const enrollmentId = statusByCourse[course.id]?.enrollmentId

    return (
      <div className="employee-training-course-actions">
        <Button size="sm" variant="outline" className="employee-training-outline-btn" asChild>
          <a href={course.link} target="_blank" rel="noreferrer">
            <ExternalLink className="mr-1 h-4 w-4" />
            View Course
          </a>
        </Button>
        {enrolled ? (
          <Button
            size="sm"
            className="employee-training-primary-btn"
            disabled={completingId === enrollmentId}
            onClick={() => void handleComplete(enrollmentId)}
          >
            {completingId === enrollmentId ? 'Updating…' : 'Mark Complete'}
          </Button>
        ) : (
          <Button
            size="sm"
            className="employee-training-primary-btn"
            disabled={enrollingId === course.id}
            onClick={() => void handleEnroll(course.id)}
          >
            {enrollingId === course.id ? 'Enrolling…' : 'Enroll'}
          </Button>
        )}
      </div>
    )
  }

  const renderEnrollmentPanel = () => (
    <section className="employee-training-section" role="tabpanel" aria-label="Enrollment">
      <header className="employee-training-section-head">
        <div className="employee-training-section-head-main">
          <div className="employee-training-section-icon" aria-hidden>
            <GraduationCap className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="employee-training-section-title">Courses Available</h2>
            
          </div>
        </div>
        <span className="employee-training-section-count">
          {loading || loadingEnrollments ? '…' : `${enrollmentTabCourses.length} shown`}
        </span>
      </header>

      <div className="employee-training-section-toolbar">{renderSearch('Search Courses To Enroll ')}</div>

      <div className="employee-training-section-body">
        {loading || loadingEnrollments ? (
          <p className="employee-training-loading">Loading Courses…</p>
        ) : enrollmentTabCourses.length === 0 ? (
          renderEmpty({
            icon: GraduationCap,
            title: 'No courses to show',
            
          })
        ) : (
          <div className="employee-training-course-grid">
            {enrollmentTabCourses.map((course) => (
              <InteractiveCard
                key={course.id}
                selectable={false}
                className={portalCardClass({
                  className: 'employee-training-course-card p-5',
                })}
              >
                <div className="employee-training-course-card-top">
                  <Badge variant="secondary" className="employee-training-platform-badge">
                    {course.platform || 'Platform'}
                  </Badge>
                  {statusByCourse[course.id]?.status === 'Enrolled' ? (
                    <Badge variant="default" className="employee-training-status-badge">
                      In Progress
                    </Badge>
                  ) : null}
                </div>
                <h3 className="employee-training-course-title">{course.title}</h3>
                <p className="employee-training-course-topic">Topic: {course.topic}</p>
                {renderCourseActions(course)}
              </InteractiveCard>
            ))}
          </div>
        )}
      </div>
    </section>
  )

  const renderCompletedPanel = () => (
    <section className="employee-training-section" role="tabpanel" aria-label="Completed">
      <header className="employee-training-section-head">
        <div className="employee-training-section-head-main">
          <div className="employee-training-section-icon employee-training-section-icon--completed" aria-hidden>
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="employee-training-section-title">Completed Courses</h2>
            
          </div>
        </div>
        <span className="employee-training-section-count">
          {loadingEnrollments ? '…' : `${completedCards.length} total`}
        </span>
      </header>

      <div className="employee-training-section-toolbar">{renderSearch('Search completed courses…')}</div>

      <div className="employee-training-section-body">
        {loadingEnrollments ? (
          <p className="employee-training-loading">Loading Completed Courses…</p>
        ) : completedCards.length === 0 ? (
          renderEmpty({
            icon: CheckCircle2,
            title: 'No completed courses yet',
            description: 'Finish a course and mark it complete to see it here.',
          })
        ) : (
          <div className="employee-training-course-grid">
            {completedCards.map((e) => {
              const link = courses.find((c) => c.id === e.courseId)?.link
              return (
                <InteractiveCard
                  key={e.id}
                  selectable={false}
                  className={portalCardClass({
                    className: 'employee-training-course-card employee-training-course-card--completed p-5',
                  })}
                >
                  <div className="employee-training-course-card-top">
                    <Badge variant="success" className="employee-training-status-badge">
                      Completed
                    </Badge>
                  </div>
                  <h3 className="employee-training-course-title">{e.courseTitle}</h3>
                  <p className="employee-training-course-topic">Topic: {e.topic}</p>
                  <div className="employee-training-course-actions">
                    {link ? (
                      <Button size="sm" variant="outline" className="employee-training-outline-btn" asChild>
                        <a href={link} target="_blank" rel="noreferrer">
                          <ExternalLink className="mr-1 h-4 w-4" />
                          View course
                        </a>
                      </Button>
                    ) : (
                      <span className="employee-training-link-unavailable">Course Link Unavailable</span>
                    )}
                  </div>
                </InteractiveCard>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )

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
        {tab === 'enrollment' ? renderEnrollmentPanel() : renderCompletedPanel()}
      </div>
    </div>
  )
}
