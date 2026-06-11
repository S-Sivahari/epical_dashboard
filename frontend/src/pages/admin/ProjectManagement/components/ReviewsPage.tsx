import { useState, useEffect } from 'react'
import { LayoutGrid, List, Search } from 'lucide-react'
import { Spinner } from '@components/ui/Spinner'
import api from '@/services/api'
import { toast } from 'sonner'

type ViewMode = 'card' | 'list'

interface Review {
  id: string
  projectName: string
  libraryName: string
  cellName: string
  employeeName: string
  currentStage: string
  reviewType: string
  status: 'Pending' | 'Approved' | 'Rejected' | 'Rework'
  submittedAt: string
}

export function ReviewsPage() {
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem('projectManagement.reviews.viewMode')
    return (saved as ViewMode) || 'card'
  })
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetchReviews()
  }, [])

  useEffect(() => {
    localStorage.setItem('projectManagement.reviews.viewMode', viewMode)
  }, [viewMode])

  const fetchReviews = async () => {
    try {
      setLoading(true)
      const res = await api.get('/project-management/reviews/admin')
      // Map backend review data to frontend structure
      const mappedReviews = res.data.map((review: any) => ({
        id: review._id,
        projectName: review.projectId?.name || 'Unknown',
        libraryName: review.libraryId?.name || 'Unknown',
        cellName: review.cellId?.name || 'Unknown',
        employeeName: review.submittedBy || 'Unknown',
        currentStage: review.reviewType || 'Standard',
        reviewType: review.reviewType || 'Standard',
        status: review.status || 'Pending',
        submittedAt: new Date(review.submittedAt).toLocaleDateString(),
      }))
      setReviews(mappedReviews)
    } catch (err) {
      console.error('Failed to fetch reviews:', err)
      toast.error('Failed to load reviews')
      setReviews([])
    } finally {
      setLoading(false)
    }
  }

  const filteredReviews = reviews.filter((review) =>
    review.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    review.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    review.cellName.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Review Queue</h2>
          <p className="mt-1 text-sm text-slate-600">Workflow approval and review management</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search reviews..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-10 w-full rounded-lg border border-border bg-white pl-9 pr-3 text-sm font-semibold focus:border-[var(--emerald-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--emerald-dark)]/20"
          />
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-border bg-white p-1">
          <button
            onClick={() => setViewMode('card')}
            className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-semibold transition-all ${
              viewMode === 'card' ? 'bg-[var(--emerald-dark)] text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <LayoutGrid className="h-4 w-4" />
            Card View
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-semibold transition-all ${
              viewMode === 'list' ? 'bg-[var(--emerald-dark)] text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <List className="h-4 w-4" />
            List View
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner size="lg" />
        </div>
      ) : filteredReviews.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center">
          <p className="text-sm font-semibold text-slate-600">No reviews found</p>
        </div>
      ) : viewMode === 'card' ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredReviews.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </div>
      ) : (
        <ReviewTable reviews={filteredReviews} />
      )}
    </div>
  )
}

function ReviewCard({ review }: { review: Review }) {
  return (
    <div className="rounded-xl border border-border bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="mb-3 flex items-start justify-between">
        <h3 className="text-lg font-bold text-slate-900">{review.cellName}</h3>
        <span className={`rounded-lg px-2 py-1 text-xs font-bold ${
          review.status === 'Approved' ? 'bg-emerald-50 text-emerald-700' :
          review.status === 'Rejected' ? 'bg-red-50 text-red-700' :
          review.status === 'Rework' ? 'bg-orange-50 text-orange-700' :
          'bg-yellow-50 text-yellow-700'
        }`}>
          {review.status}
        </span>
      </div>
      
      <div className="mb-4 space-y-2 text-xs">
        <div className="flex justify-between">
          <span className="font-semibold text-slate-600">Project:</span>
          <span className="font-bold text-slate-900">{review.projectName}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-semibold text-slate-600">Library:</span>
          <span className="font-bold text-slate-900">{review.libraryName}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-semibold text-slate-600">Employee:</span>
          <span className="font-bold text-slate-900">{review.employeeName}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-semibold text-slate-600">Stage:</span>
          <span className="font-bold text-slate-900">{review.currentStage}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-semibold text-slate-600">Review Type:</span>
          <span className="font-bold text-slate-900">{review.reviewType}</span>
        </div>
      </div>

      <div className="flex gap-2">
        <button className="flex-1 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-600">
          Approve
        </button>
        <button className="flex-1 rounded-lg bg-red-500 px-3 py-2 text-xs font-bold text-white hover:bg-red-600">
          Reject
        </button>
      </div>
    </div>
  )
}

function ReviewTable({ reviews }: { reviews: Review[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
      <table className="w-full">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-600">Project</th>
            <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-600">Library</th>
            <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-600">Cell</th>
            <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-600">Employee</th>
            <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-600">Stage</th>
            <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-600">Review Type</th>
            <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-600">Status</th>
            <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-600">Submitted</th>
            <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-600">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {reviews.map((review) => (
            <tr key={review.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 text-sm font-bold text-slate-900">{review.projectName}</td>
              <td className="px-4 py-3 text-sm font-semibold text-slate-600">{review.libraryName}</td>
              <td className="px-4 py-3 text-sm font-semibold text-slate-600">{review.cellName}</td>
              <td className="px-4 py-3 text-sm font-semibold text-slate-600">{review.employeeName}</td>
              <td className="px-4 py-3 text-sm font-semibold text-slate-600">{review.currentStage}</td>
              <td className="px-4 py-3 text-sm font-semibold text-slate-600">{review.reviewType}</td>
              <td className="px-4 py-3">
                <span className={`rounded-lg px-2 py-1 text-xs font-bold ${
                  review.status === 'Approved' ? 'bg-emerald-50 text-emerald-700' :
                  review.status === 'Rejected' ? 'bg-red-50 text-red-700' :
                  review.status === 'Rework' ? 'bg-orange-50 text-orange-700' :
                  'bg-yellow-50 text-yellow-700'
                }`}>
                  {review.status}
                </span>
              </td>
              <td className="px-4 py-3 text-sm font-semibold text-slate-600">{review.submittedAt}</td>
              <td className="px-4 py-3">
                <div className="flex gap-2">
                  <button className="rounded-lg bg-emerald-500 px-2 py-1 text-xs font-bold text-white hover:bg-emerald-600">
                    Approve
                  </button>
                  <button className="rounded-lg bg-red-500 px-2 py-1 text-xs font-bold text-white hover:bg-red-600">
                    Reject
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
