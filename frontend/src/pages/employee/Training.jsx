import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Search, BookOpen, CheckCircle2, ExternalLink } from 'lucide-react'
import { Button } from '@components/employee/ui/button'
import { Input } from '@components/employee/ui/input'
import { Badge } from '@components/employee/ui/badge'
import { KPIStatCard } from '@components/employee/shared/KPIStatCard'
import { useToast } from '@components/employee/shared/ToastProvider'
import { listCourses, listEnrollments, enrollEmployee, markComplete } from '@services/trainingService'
import { useAuthStore } from '@store/authStore'

export default function Training() {
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [enrollments, setEnrollments] = useState([])
  const [loadingEnrollments, setLoadingEnrollments] = useState(false)
  const [enrollingId, setEnrollingId] = useState(null)
  const [completingId, setCompletingId] = useState(null)
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
    const loadEnrollments = async () => {
      setLoadingEnrollments(true)
      try {
        const data = await listEnrollments({ employee: user.id })
        setEnrollments(data)
      } catch {
        toast({ title: 'Error', description: 'Failed to load enrollments' })
      } finally {
        setLoadingEnrollments(false)
      }
    }
    void loadEnrollments()
  }, [toast, user?.id])

  const filtered = courses.filter((c) => {
    const term = search.trim().toLowerCase()
    if (!term) return true
    return (
      c.title.toLowerCase().includes(term) ||
      (c.topic || '').toLowerCase().includes(term) ||
      (c.platform || '').toLowerCase().includes(term)
    )
  })

  const enrolledCount = enrollments.filter((e) => e.status === 'Enrolled').length
  const completedCount = enrollments.filter((e) => e.status === 'Completed').length
  const statusByCourse = {}
  enrollments.forEach((e) => {
    statusByCourse[e.courseId] = { status: e.status, enrollmentId: e.id }
  })

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
      setEnrollments((prev) => [record, ...prev])
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
      setEnrollments((prev) => prev.map((e) => (e.id === enrollmentId ? updated : e)))
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
        <KPIStatCard title="Available Courses" value={String(courses.length)} icon={BookOpen} />
        <KPIStatCard title="Enrolled" value={String(enrolledCount)} icon={BookOpen} />
        <KPIStatCard title="Completed" value={String(completedCount)} icon={CheckCircle2} />
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search courses..." className="pl-9" />
      </div>

      <div>
        <h3 className="mb-4 font-heading text-lg font-semibold">Available Courses</h3>
        {loading || loadingEnrollments ? (
          <p className="text-sm text-muted">Loading courses...</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted">No courses available yet.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((course) => (
              <motion.div
                key={course.id}
                whileHover={{ y: -4 }}
                className="rounded-xl border border-border bg-card p-5 shadow-card"
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
                  {statusByCourse[course.id]?.status === 'Completed' ? (
                    <Badge variant="success">Completed</Badge>
                  ) : statusByCourse[course.id]?.status === 'Enrolled' ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={completingId === statusByCourse[course.id]?.enrollmentId}
                      onClick={() => void handleComplete(statusByCourse[course.id].enrollmentId)}
                    >
                      {completingId === statusByCourse[course.id]?.enrollmentId ? 'Updating...' : 'Mark Complete'}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={enrollingId === course.id}
                      onClick={() => void handleEnroll(course.id)}
                    >
                      {enrollingId === course.id ? 'Enrolling...' : 'Enroll'}
                    </Button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
