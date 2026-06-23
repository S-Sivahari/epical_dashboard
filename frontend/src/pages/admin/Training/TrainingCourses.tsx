import { useEffect, useState } from 'react'
import { PageWrapper } from '@components/layout/PageWrapper'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import { Badge } from '@components/ui/Badge'
import { DataTable, type Column } from '@components/tables/DataTable'
import { formatDate } from '@/utils/formatDate'
import { toast } from 'sonner'
import {
  listCourses,
  createCourse,
  updateCourse,
  deleteCourse,
  listEnrollments,
  type Course,
  type CourseEnrollment,
} from '@services/trainingService'
import {
  X,
  Search,
  PlusCircle,
  Pencil,
  GraduationCap,
  Users,
  Award,
  ExternalLink,
} from 'lucide-react'

type TabId = 'courses' | 'enrollment' | 'completed'

const tabs: Array<{ id: TabId; label: string; icon: typeof GraduationCap }> = [
  { id: 'courses', label: 'Courses', icon: GraduationCap },
  { id: 'enrollment', label: 'Enrollment', icon: Users },
  { id: 'completed', label: 'Completed', icon: Award },
]

export function TrainingCourses() {
  const [tab, setTab] = useState<TabId>('courses')
  const [title, setTitle] = useState('')
  const [topic, setTopic] = useState('')
  const [platform, setPlatform] = useState('')
  const [link, setLink] = useState('')
  const [search, setSearch] = useState('')
  const [courses, setCourses] = useState<Course[]>([])
  const [loadingCourses, setLoadingCourses] = useState(false)
  const [savingCourse, setSavingCourse] = useState(false)
  const [removingCourse, setRemovingCourse] = useState<string | null>(null)
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null)

  const [enrollments, setEnrollments] = useState<CourseEnrollment[]>([])
  const [loadingEnrollments, setLoadingEnrollments] = useState(false)
  const [courseFilter, setCourseFilter] = useState('')
  const [employeeFilter, setEmployeeFilter] = useState('')
  const [enrolledTotal, setEnrolledTotal] = useState(0)
  const [completedTotal, setCompletedTotal] = useState(0)

  const enrollmentColumns: Column<CourseEnrollment>[] = [
    { key: 'employeeId', header: 'Employee ID' },
    { key: 'employeeName', header: 'Name' },
    { key: 'courseTitle', header: 'Course' },
    { key: 'topic', header: 'Topic' },
    {
      key: 'enrolledAt',
      header: 'Enrolled date',
      render: (r) => formatDate(r.enrolledAt),
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => (
        <Badge variant={r.status === 'Completed' ? 'success' : 'info'}>{r.status}</Badge>
      ),
    },
  ]

  const completedColumns: Column<CourseEnrollment>[] = [
    { key: 'employeeId', header: 'Employee ID' },
    { key: 'employeeName', header: 'Name' },
    { key: 'courseTitle', header: 'Course' },
    { key: 'topic', header: 'Topic' },
    {
      key: 'enrolledAt',
      header: 'Enrolled date',
      render: (r) => formatDate(r.enrolledAt),
    },
    {
      key: 'completedAt',
      header: 'Completed date',
      render: (r) => (r.completedAt ? formatDate(r.completedAt) : '—'),
    },
    {
      key: 'status',
      header: 'Status',
      render: () => <Badge variant="success">Completed</Badge>,
    },
  ]

  const loadCourses = async () => {
    setLoadingCourses(true)
    try {
      const data = await listCourses(search)
      setCourses(data)
    } catch {
      toast.error('Failed to load courses')
    } finally {
      setLoadingCourses(false)
    }
  }

  const refreshEnrollmentTotals = async () => {
    try {
      const [enrolled, completed] = await Promise.all([
        listEnrollments({ status: 'Enrolled' }),
        listEnrollments({ status: 'Completed' }),
      ])
      setEnrolledTotal(enrolled.length)
      setCompletedTotal(completed.length)
    } catch {
      // ignore — metrics are supplementary
    }
  }

  const loadEnrollments = async () => {
    setLoadingEnrollments(true)
    try {
      const data = await listEnrollments({
        courseId: courseFilter || undefined,
        employee: employeeFilter || undefined,
        status: tab === 'enrollment' ? 'Enrolled' : tab === 'completed' ? 'Completed' : undefined,
      })
      setEnrollments(data)
    } catch {
      toast.error('Failed to load enrollments')
    } finally {
      setLoadingEnrollments(false)
    }
  }

  useEffect(() => {
    void loadCourses()
  }, [search])

  useEffect(() => {
    void refreshEnrollmentTotals()
  }, [])

  useEffect(() => {
    if (tab !== 'courses') {
      void loadEnrollments()
    }
  }, [tab, courseFilter, employeeFilter])

  const resetCourseForm = () => {
    setTitle('')
    setTopic('')
    setPlatform('')
    setLink('')
    setEditingCourseId(null)
  }

  const handleSaveCourse = async () => {
    if (!title || !topic || !platform || !link) {
      toast.error('Fill all fields')
      return
    }
    setSavingCourse(true)
    try {
      if (editingCourseId) {
        const updated = await updateCourse(editingCourseId, { title, topic, platform, link })
        setCourses((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
        setEnrollments((prev) =>
          prev.map((e) =>
            e.courseId === updated.id ? { ...e, courseTitle: updated.title, topic: updated.topic } : e,
          ),
        )
        toast.success('Course updated')
      } else {
        const created = await createCourse({ title, topic, platform, link })
        setCourses((prev) => [created, ...prev])
        toast.success('Course added')
      }
      resetCourseForm()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } }
      toast.error(
        err?.response?.data?.error ||
          (editingCourseId ? 'Failed To Update Course' : 'Failed To Add Course'),
      )
    } finally {
      setSavingCourse(false)
    }
  }

  const handleDeleteCourse = async (id: string) => {
    setRemovingCourse(id)
    try {
      await deleteCourse(id)
      setCourses((prev) => prev.filter((c) => c.id !== id))
      setEnrollments((prev) => prev.filter((e) => e.courseId !== id))
      if (editingCourseId === id) resetCourseForm()
      void refreshEnrollmentTotals()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } }
      toast.error(err?.response?.data?.error || 'Failed to remove course')
    } finally {
      setRemovingCourse(null)
    }
  }

  const openEditCourse = (course: Course) => {
    setTab('courses')
    setEditingCourseId(course.id)
    setTitle(course.title)
    setTopic(course.topic)
    setPlatform(course.platform)
    setLink(course.link)
  }

  const activeTabMeta = tabs.find((t) => t.id === tab)!

  const enrollmentTable = (
    <div className="admin-training-table-wrap">
      <DataTable
        columns={tab === 'completed' ? completedColumns : enrollmentColumns}
        data={enrollments}
        loading={loadingEnrollments}
        empty={
          <div className="admin-training-empty flex min-h-[160px] flex-col items-center justify-center px-4 py-6 text-center">
            <Users className="mb-2 h-8 w-8 admin-training-text-brand-muted" aria-hidden />
            <p className="text-sm font-semibold admin-training-text-brand">
              {tab === 'completed' ? 'No completed enrollments yet' : 'No active enrollments'}
            </p>
            <p className="mt-1 text-sm text-slate-600">Try adjusting your filters or add more courses.</p>
          </div>
        }
      />
    </div>
  )

  return (
    <PageWrapper fillViewport className="admin-hub-page-wrap admin-training-page-wrap relative z-10 !py-2 font-body">
      <div className="crewiq-dashboard admin-training-view relative flex min-h-0 flex-1 flex-col">
        <div className="dashboard-page-bg" aria-hidden>
          <div className="dashboard-page-bg-gradient" />
          <div className="dashboard-page-bg-pattern" />
        </div>

        <div className="admin-training-shell relative z-10 flex min-h-0 flex-1 animate-fadeIn flex-col">
          <header className="admin-training-hub-header shrink-0">
            <div className="admin-training-hero-top">
              <div className="min-w-0">
                <h1 className="admin-training-hero-title font-display">Training & Courses Hub</h1>
              </div>
              <nav className="admin-training-tab-rail" aria-label="Training views">
                {tabs.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    className={
                      tab === t.id
                        ? 'admin-training-tab-btn admin-training-tab-btn--active'
                        : 'admin-training-tab-btn admin-training-tab-btn--inactive'
                    }
                  >
                    <t.icon className="admin-training-tab-icon shrink-0" aria-hidden />
                    <span className="admin-training-tab-label">{t.label}</span>
                    <span className="admin-training-tab-count tabular-nums">
                      {t.id === 'courses'
                        ? courses.length
                        : t.id === 'enrollment'
                          ? enrolledTotal
                          : completedTotal}
                    </span>
                  </button>
                ))}
              </nav>
            </div>
            <div className="admin-training-metrics-band" role="group" aria-label="Training metrics">
              <div className="admin-training-metric-tile">
                <p className="admin-training-metric-label">Total Courses</p>
                <p className="admin-training-metric-value font-display">{courses.length}</p>
              </div>
              <div className="admin-training-metric-tile">
                <p className="admin-training-metric-label">Active Enrollments</p>
                <p className="admin-training-metric-value font-display">{enrolledTotal}</p>
              </div>
              <div className="admin-training-metric-tile">
                <p className="admin-training-metric-label">Completed</p>
                <p className="admin-training-metric-value font-display">{completedTotal}</p>
              </div>
            </div>
          </header>

          {tab === 'courses' && (
            <div className="admin-training-body-grid admin-training-body-grid--fill">
              <aside className="admin-training-sidebar">
                <p className="admin-training-sidebar-title">
                  {editingCourseId ? 'Edit Course' : 'Add New Course'}
                </p>
                <div className="admin-training-sidebar-fields">
                  <Input
                    label="Course Title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter course name"
                  />
                  <Input
                    label="Topic"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="e.g. Sales, React"
                  />
                  <Input
                    label="Platform"
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value)}
                    placeholder="e.g. Udemy, Coursera"
                  />
                  <Input
                    label="Course Link"
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    placeholder="https://..."
                  />
                </div>
                <div className="admin-training-sidebar-actions">
                  <Button
                    className="admin-training-primary-btn w-full border-0"
                    onClick={() => void handleSaveCourse()}
                    disabled={savingCourse}
                  >
                    {editingCourseId ? (
                      <Pencil className="h-4 w-4" />
                    ) : (
                      <PlusCircle className="h-4 w-4" />
                    )}
                    {savingCourse
                      ? editingCourseId
                        ? 'Saving...'
                        : 'Adding...'
                      : editingCourseId
                        ? 'Save Changes'
                        : 'Add Course'}
                  </Button>
                  {editingCourseId && (
                    <Button variant="ghost" className="w-full admin-training-text-brand" onClick={resetCourseForm}>
                      Cancel edit
                    </Button>
                  )}
                </div>
              </aside>

              <div className="admin-training-main-panel">
                <div className="admin-training-panel-fixed admin-training-panel-header">
                  <div>
                    <h2 className="font-display text-base font-extrabold admin-training-text-brand">
                      Course Catalog
                    </h2>
                    <p className="text-sm font-medium text-slate-600">
                      {loadingCourses
                        ? 'Loading...'
                        : `${courses.length} course${courses.length === 1 ? '' : 's'} available`}
                    </p>
                  </div>
                </div>

                <div className="admin-training-panel-fixed relative w-full min-w-0">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 admin-training-text-brand-muted"
                    aria-hidden
                  />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by name, platform or topic..."
                    className="pl-9"
                  />
                </div>

                <div
                  className="admin-training-catalog-scroll"
                  role="region"
                  aria-label="Course catalog list"
                >
                  {loadingCourses ? (
                    <div className="admin-training-empty flex min-h-[140px] items-center justify-center rounded-xl">
                      <p className="text-sm font-medium admin-training-text-brand-muted">Loading courses...</p>
                    </div>
                  ) : courses.length === 0 ? (
                    <div className="admin-training-empty flex min-h-[160px] flex-col items-center justify-center rounded-xl px-4 text-center">
                      <GraduationCap className="mb-2 h-8 w-8 admin-training-text-brand-muted" aria-hidden />
                      <p className="text-sm font-semibold admin-training-text-brand">No courses yet</p>
                      <p className="mt-1 text-sm text-slate-600">Use the sidebar form to add your first course.</p>
                    </div>
                  ) : (
                    <div className="admin-training-course-grid">
                      {courses.map((c) => (
                        <div
                          key={c.id}
                          className={
                            editingCourseId === c.id
                              ? 'admin-training-course-card admin-training-course-card--editing space-y-2 rounded-xl p-4'
                              : 'admin-training-course-card space-y-2 rounded-xl p-4'
                          }
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-display text-base font-bold admin-training-text-brand line-clamp-2">
                              {c.title}
                            </p>
                            <Badge variant="neutral" className="shrink-0 text-xs">
                              {c.platform}
                            </Badge>
                          </div>
                          <p className="text-sm font-medium text-slate-600">Topic: {c.topic}</p>
                          <div className="flex flex-wrap gap-2 pt-2">
                            <Button size="sm" variant="secondary" className="admin-training-secondary-btn" asChild>
                              <a href={c.link} target="_blank" rel="noreferrer">
                                <ExternalLink className="h-3.5 w-3.5" />
                                View
                              </a>
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              className="admin-training-secondary-btn"
                              onClick={() => openEditCourse(c)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              className="admin-training-danger-btn"
                              disabled={removingCourse === c.id}
                              onClick={() => void handleDeleteCourse(c.id)}
                            >
                              {removingCourse === c.id ? 'Removing...' : 'Remove'}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {tab !== 'courses' && (
            <div className="admin-training-body-grid admin-training-body-grid--fill">
              <aside className="admin-training-sidebar">
                <p className="admin-training-sidebar-title">{activeTabMeta.label}</p>
                <div className="admin-training-sidebar-fields">
                <div>
                  <label className="mb-1 block text-sm font-semibold admin-training-text-brand">
                    Course
                  </label>
                  <select
                    value={courseFilter}
                    onChange={(e) => setCourseFilter(e.target.value)}
                    className="admin-training-select w-full rounded-lg border px-3 py-2 text-base font-medium"
                  >
                    <option value="">All courses</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                </div>
                <Input
                  label="Employee"
                  value={employeeFilter}
                  onChange={(e) => setEmployeeFilter(e.target.value)}
                  placeholder="Search by name or ID"
                />
                {(courseFilter || employeeFilter) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full admin-training-text-brand"
                    onClick={() => {
                      setCourseFilter('')
                      setEmployeeFilter('')
                    }}
                  >
                    <X className="h-4 w-4 mr-1" /> Clear filters
                  </Button>
                )}
                </div>
              </aside>

              <div className="admin-training-main-panel">
                <div className="admin-training-panel-fixed admin-training-panel-header">
                  <div>
                    <h2 className="font-display text-base font-extrabold admin-training-text-brand">
                      {tab === 'enrollment' ? 'Active Enrollments' : 'Completed Training'}
                    </h2>
                    <p className="text-sm font-medium text-slate-600">
                      {loadingEnrollments
                        ? 'Loading...'
                        : `${enrollments.length} record${enrollments.length === 1 ? '' : 's'} in this view`}
                    </p>
                  </div>
                </div>
                {enrollmentTable}
              </div>
            </div>
          )}
        </div>

      </div>
    </PageWrapper>
  )
}
