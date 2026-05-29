import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Trash2, FileText, FileSpreadsheet } from 'lucide-react'
import { PageWrapper } from '@components/layout/PageWrapper'
import { Button } from '@components/ui/Button'
import { ConfirmModal } from '@components/modals/ConfirmModal'
import { LeaveRequests } from './LeaveRequests'
import { CompanyCalendar } from './CompanyCalendar'
import { CompensationManagement } from './CompensationManagement'
import { useLeaves } from '@hooks/useLeaves'
import { useLeaveStore } from '@store/leaveStore'
import { useAuthStore } from '@store/authStore'
import { filterLeaves, excludeCancelledLeaves, type LeaveFilters } from '@/utils/leaveFilters'
import {
  exportCompensationToExcel,
  exportCompensationToPDF,
  exportLeavesToExcel,
  exportLeavesToPDF,
  type CompensationExportRow,
} from '@/utils/exportLeaveReport'

type TabType = 'requests' | 'calendar' | 'compensation'

const tabs: Array<{ id: TabType; label: string }> = [
  { id: 'requests', label: 'Leave Requests' },
  { id: 'calendar', label: 'Company Calendar' },
  { id: 'compensation', label: 'Compensation Management' },
]

function buildExportFilename(tab: TabType) {
  const date = new Date().toISOString().slice(0, 10)
  return `Leave_Management_${tab}_${date}`
}

export function LeaveManagementContainer() {
  const [activeTab, setActiveTab] = useState<TabType>('requests')
  const [leaveFilters, setLeaveFilters] = useState<LeaveFilters>({
    selectedEmployees: [],
    status: 'Pending',
    leaveType: '',
    dateFrom: '',
    dateTo: '',
  })
  const [compensationExportRows, setCompensationExportRows] = useState<CompensationExportRow[]>([])
  const [compensationSearch, setCompensationSearch] = useState('')
  const [exporting, setExporting] = useState<'pdf' | 'excel' | null>(null)
  const [deleteAllOpen, setDeleteAllOpen] = useState(false)
  const [deletingAll, setDeletingAll] = useState(false)

  const { leaves } = useLeaves()
  const deleteAllLeaves = useLeaveStore((s) => s.deleteAllLeaves)
  const user = useAuthStore((s) => s.user)

  const filteredLeaveRequests = useMemo(() => {
    const status = leaveFilters.status || 'Pending'
    return filterLeaves(
      excludeCancelledLeaves(leaves).filter((l) => l.status === status),
      { ...leaveFilters, status },
    )
  }, [leaves, leaveFilters])

  const exportFilterMeta = useMemo((): Record<string, string | undefined> => {
    const base: Record<string, string | undefined> = { section: tabs.find((t) => t.id === activeTab)?.label }
    if (activeTab === 'requests') {
      return {
        ...base,
        status: leaveFilters.status,
        name: leaveFilters.selectedEmployees.length > 0
          ? leaveFilters.selectedEmployees.join(', ')
          : undefined,
        leaveType: leaveFilters.leaveType || undefined,
        dateRange: (leaveFilters.dateFrom || leaveFilters.dateTo)
          ? `${leaveFilters.dateFrom || 'Any'} → ${leaveFilters.dateTo || 'Any'} (leave dates)`
          : undefined,
      }
    }
    return { ...base, search: compensationSearch || undefined }
  }, [activeTab, leaveFilters, compensationSearch])

  const handleExport = async (format: 'pdf' | 'excel') => {
    if (activeTab === 'calendar') return
    const filename = buildExportFilename(activeTab)
    const generatedBy = user?.name || 'Admin'

    try {
      setExporting(format)

      if (activeTab === 'requests') {
        if (!filteredLeaveRequests.length) {
          toast.error('No leave requests match the current filters')
          return
        }
        if (format === 'pdf') {
          await exportLeavesToPDF(filteredLeaveRequests, filename, exportFilterMeta, generatedBy)
        } else {
          await exportLeavesToExcel(filteredLeaveRequests, filename, exportFilterMeta, generatedBy)
        }
        return
      }

      if (!compensationExportRows.length) {
        toast.error('No compensation entries to export')
        return
      }
      if (format === 'pdf') {
        await exportCompensationToPDF(compensationExportRows, filename, exportFilterMeta, generatedBy)
      } else {
        await exportCompensationToExcel(compensationExportRows, filename, exportFilterMeta, generatedBy)
      }
    } finally {
      setExporting(null)
    }
  }

  const handleDeleteAllLeaves = async () => {
    setDeletingAll(true)
    try {
      await deleteAllLeaves()
      setDeleteAllOpen(false)
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Failed to delete leave records'
      toast.error(message)
    } finally {
      setDeletingAll(false)
    }
  }

  return (
    <PageWrapper>
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-xl border border-border bg-surface/60 p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-white text-primary shadow-sm'
                  : 'text-muted hover:text-ink'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {activeTab !== 'calendar' && (
          <div className="flex flex-wrap gap-2">
            {activeTab === 'requests' && (
              <Button
                variant="danger"
                size="sm"
                onClick={() => setDeleteAllOpen(true)}
                disabled={deletingAll}
              >
                <Trash2 className="h-4 w-4" />
                Delete All Leaves
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void handleExport('pdf')}
              loading={exporting === 'pdf'}
            >
              <FileText className="h-4 w-4 text-red-600" />
              Export PDF
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void handleExport('excel')}
              loading={exporting === 'excel'}
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              Export Excel
            </Button>
          </div>
        )}
      </div>

      <div className="animate-fadeIn">
        {activeTab === 'requests' && (
          <LeaveRequests filters={leaveFilters} onFiltersChange={setLeaveFilters} />
        )}
        {activeTab === 'calendar' && <CompanyCalendar />}
        {activeTab === 'compensation' && (
          <CompensationManagement
            onExportDataChange={setCompensationExportRows}
            onSearchChange={setCompensationSearch}
          />
        )}
      </div>

      <ConfirmModal
        isOpen={deleteAllOpen}
        title="Delete all leave records?"
        description="This will permanently delete every leave request and all leave history from the database, including pending, approved, rejected, and cancelled records. Related leave notifications will also be removed. This action cannot be undone."
        confirmLabel={deletingAll ? 'Deleting...' : 'Delete all'}
        danger
        onClose={() => {
          if (deletingAll) return
          setDeleteAllOpen(false)
        }}
        onConfirm={handleDeleteAllLeaves}
      />
    </PageWrapper>
  )
}
