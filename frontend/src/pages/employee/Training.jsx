import { useState } from 'react'
import { motion } from 'framer-motion'
import { Search, BookOpen, CheckCircle2 } from 'lucide-react'
import { Button } from '@components/employee/ui/button'
import { Input } from '@components/employee/ui/input'
import { Progress } from '@components/employee/ui/progress'
import { Badge } from '@components/employee/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@components/employee/ui/dialog'
import { KPIStatCard } from '@components/employee/shared/KPIStatCard'
import { courses as initialCourses } from '@pages/employee/data/mockData'
import { useToast } from '@components/employee/shared/ToastProvider'

export default function Training() {
  const [courses, setCourses] = useState(initialCourses)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const { toast } = useToast()

  const enrolled = courses.filter((c) => c.enrolled)
  const completed = courses.filter((c) => c.progress === 100)
  const filtered = courses.filter(
    (c) => !search || c.title.toLowerCase().includes(search.toLowerCase()) || c.category.toLowerCase().includes(search.toLowerCase())
  )

  const handleEnroll = (id) => {
    setCourses((prev) => prev.map((c) => (c.id === id ? { ...c, enrolled: true } : c)))
    toast({ title: 'Enrolled!', description: 'You have been enrolled in the course.' })
    setSelected(null)
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <KPIStatCard title="Enrolled Courses" value={String(enrolled.length)} icon={BookOpen} />
        <KPIStatCard title="Completed" value={String(completed.length)} icon={CheckCircle2} />
        <KPIStatCard title="In Progress" value={String(enrolled.filter((c) => c.progress > 0 && c.progress < 100).length)} icon={BookOpen} />
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search courses..." className="pl-9" />
      </div>

      <div>
        <h3 className="mb-4 font-heading text-lg font-semibold">Suggested Courses</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((course) => (
            <motion.div
              key={course.id}
              whileHover={{ y: -4 }}
              className="rounded-xl border border-border bg-card p-5 shadow-card"
            >
              <div className="flex items-start justify-between">
                <Badge variant="secondary">{course.category}</Badge>
                {course.enrolled && <Badge variant="success">Enrolled</Badge>}
              </div>
              <h4 className="mt-3 font-heading font-semibold">{course.title}</h4>
              <p className="mt-1 text-sm text-muted">{course.duration}</p>
              {course.enrolled && (
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-muted mb-1">
                    <span>Progress</span>
                    <span>{course.progress}%</span>
                  </div>
                  <Progress value={course.progress} />
                </div>
              )}
              <div className="mt-4 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setSelected(course)}>Details</Button>
                {!course.enrolled && (
                  <Button size="sm" onClick={() => handleEnroll(course.id)}>Enroll</Button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selected?.title}</DialogTitle>
            <DialogDescription>
              {selected?.category} · {selected?.duration}
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted">
            Comprehensive course covering industry best practices and hands-on exercises.
          </p>
          {!selected?.enrolled && (
            <Button onClick={() => handleEnroll(selected.id)} className="w-full">Enroll Now</Button>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
