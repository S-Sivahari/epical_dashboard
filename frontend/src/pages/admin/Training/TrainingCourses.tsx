import { useEffect, useState } from 'react'
import { PageHeader } from '@components/layout/PageHeader'
import { PageWrapper } from '@components/layout/PageWrapper'
import { Breadcrumb } from '@components/layout/Breadcrumb'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import { Badge } from '@components/ui/Badge'
import { DataTable, type Column } from '@components/tables/DataTable'
import { formatDate } from '@/utils/formatDate'
import { toast } from 'sonner'
import { Modal } from '@components/ui/Modal'
import {
  listCourses,
  createCourse,
  updateCourse,
  deleteCourse,
  listEnrollments,
  type Course,
  type CourseEnrollment,
} from '@services/trainingService'
import { X, Search, PlusCircle, Pencil } from 'lucide-react'

export function TrainingCourses() {
  const [tab, setTab] = useState<'courses' | 'enrollment' | 'completed'>('courses')
  const [title, setTitle] = useState('')
  const [topic, setTopic] = useState('')
  const [platform, setPlatform] = useState('')
  const [link, setLink] = useState('')
  const [search, setSearch] = useState('')
  const [courses, setCourses] = useState<Course[]>([])
  const [loadingCourses, setLoadingCourses] = useState(false)
  const [savingCourse, setSavingCourse] = useState(false)
  const [removingCourse, setRemovingCourse] = useState<string | null>(null)
  const [editingCourse, setEditingCourse] = useState<Course | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editTopic, setEditTopic] = useState('')
  const [editPlatform, setEditPlatform] = useState('')
  const [editLink, setEditLink] = useState('')
  const [updatingCourse, setUpdatingCourse] = useState(false)

  const [enrollments, setEnrollments] = useState<CourseEnrollment[]>([])
  const [loadingEnrollments, setLoadingEnrollments] = useState(false)
  const [courseFilter, setCourseFilter] = useState('')
  const [employeeFilter, setEmployeeFilter] = useState('')

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

  const loadCourses = async () => {
    setLoadingCourses(true)
    try {
      const data = await listCourses(search)
      setCourses(data)
    } catch (e) {
      toast.error('Failed to load courses')
    } finally {
      setLoadingCourses(false)
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
    if (tab !== 'courses') {
      void loadEnrollments()
    }
  }, [tab, courseFilter, employeeFilter])

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

  const handleCreateCourse = async () => {
    if (!title || !topic || !platform || !link) {
      toast.error('Fill all fields')
      return
    }
    setSavingCourse(true)
    try {
      const created = await createCourse({ title, topic, platform, link })
      setCourses((prev) => [created, ...prev])
      setTitle('')
      setTopic('')
      setPlatform('')
      setLink('')
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Failed to add course')
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
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Failed to remove course')
    } finally {
      setRemovingCourse(null)
    }
  }

  const openEditCourse = (course: Course) => {
    setEditingCourse(course)
    setEditTitle(course.title)
    setEditTopic(course.topic)
    setEditPlatform(course.platform)
    setEditLink(course.link)
  }

  const handleUpdateCourse = async () => {
    if (!editingCourse) return
    if (!editTitle || !editTopic || !editPlatform || !editLink) {
      toast.error('Fill all fields')
      return
    }
    setUpdatingCourse(true)
    try {
      const updated = await updateCourse(editingCourse.id, {
        title: editTitle,
        topic: editTopic,
        platform: editPlatform,
        link: editLink,
      })
      setCourses((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
      setEnrollments((prev) =>
        prev.map((e) =>
          e.courseId === updated.id
            ? { ...e, courseTitle: updated.title, topic: updated.topic }
            : e
        )
      )
      setEditingCourse(null)
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Failed to update course')
    } finally {
      setUpdatingCourse(false)
    }
  }

  return (
    <PageWrapper>
      <div className="crewiq-dashboard">
        <PageHeader title="" breadcrumb={<Breadcrumb items={[{ label: 'Training' }]} />} />
        <div className="mb-4 flex flex-wrap gap-2 border-b border-border pb-3">
          {(
            [
              ['courses', 'Courses'],
              ['enrollment', 'Enrollment'],
              ['completed', 'Completed'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`rounded-lg px-3 py-2 text-sm font-medium ${
                tab === key ? 'bg-primary/20 text-primary ring-1 ring-primary/30' : 'text-muted hover:bg-surface'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'courses' ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-white p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-2 text-ink font-semibold">
                <PlusCircle className="h-4 w-4 text-emerald-600" />
                Add New Course
              </div>
              <div className="grid gap-3 md:grid-cols-4 md:items-end">
                <Input label="Course Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Enter course name" />
                <Input label="Topic" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Sales, React" />
                <Input label="Platform" value={platform} onChange={(e) => setPlatform(e.target.value)} placeholder="e.g. Udemy, Coursera" />
                <div className="flex gap-2">
                  <Input className="flex-1" label="Course Link" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://..." />
                  <Button onClick={() => void handleCreateCourse()} disabled={savingCourse}>
                    {savingCourse ? 'Adding...' : 'Add'}
                  </Button>
                </div>
              </div>
            </div>

          <div className="space-y-2">
            <div className="relative w-full max-w-xl">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search added courses by name, platform or topic..."
                className="pl-10 rounded-full shadow-sm"
              />
            </div>
            <p className="font-semibold text-ink">Added Courses</p>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {loadingCourses ? (
                <p className="text-sm text-muted">Loading courses...</p>
              ) : courses.length === 0 ? (
                <p className="text-sm text-muted">No courses yet.</p>
              ) : (
                courses.map((c) => (
                  <div key={c.id} className="rounded-xl border border-border bg-white p-4 shadow-sm space-y-2">
                    <p className="font-semibold text-ink">{c.title}</p>
                    <p className="text-sm text-muted">Platform: {c.platform}</p>
                    <p className="text-sm text-muted">Topic: {c.topic}</p>
                    <div className="flex flex-wrap gap-2 pt-2">
                      <Button size="sm" variant="warning" asChild>
                        <a href={c.link} target="_blank" rel="noreferrer">
                          View Course
                        </a>
                      </Button>
                      <Button size="sm" variant="info" onClick={() => openEditCourse(c)}>
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={removingCourse === c.id}
                        onClick={() => handleDeleteCourse(c.id)}
                      >
                        {removingCourse === c.id ? 'Removing...' : 'Remove'}
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}

      {tab !== 'courses' ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="w-48">
              <label className="block text-xs font-medium text-muted mb-1">Course</label>
              <select
                value={courseFilter}
                onChange={(e) => setCourseFilter(e.target.value)}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
              >
                <option value="">All</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-56">
              <label className="block text-xs font-medium text-muted mb-1">Employee</label>
              <Input
                value={employeeFilter}
                onChange={(e) => setEmployeeFilter(e.target.value)}
                placeholder="Search by name or ID"
              />
            </div>
            <Button variant="ghost" size="sm" onClick={() => { setCourseFilter(''); setEmployeeFilter(''); }}>
              <X className="h-4 w-4 mr-1" /> Clear
            </Button>
          </div>

          <DataTable
            columns={tab === 'completed' ? completedColumns : enrollmentColumns}
            data={enrollments}
            loading={loadingEnrollments}
            empty={
              <p className="text-sm text-muted px-2 py-4">
                {tab === 'completed' ? 'No completed enrollments yet.' : 'No active enrollments match your filters.'}
              </p>
            }
          />
        </div>
      ) : null}

      <Modal
        isOpen={!!editingCourse}
        onClose={() => setEditingCourse(null)}
        title="Edit Course"
        size="lg"
      >
        <div className="grid gap-3 md:grid-cols-2">
          <Input label="Course Title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
          <Input label="Topic" value={editTopic} onChange={(e) => setEditTopic(e.target.value)} />
          <Input label="Platform" value={editPlatform} onChange={(e) => setEditPlatform(e.target.value)} />
          <Input label="Course Link" value={editLink} onChange={(e) => setEditLink(e.target.value)} />
          <div className="md:col-span-2 flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setEditingCourse(null)}>
              Cancel
            </Button>
            <Button onClick={() => void handleUpdateCourse()} disabled={updatingCourse}>
              {updatingCourse ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </Modal>
      </div>
    </PageWrapper>
  )
}
