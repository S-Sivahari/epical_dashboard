import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Download } from 'lucide-react'
import { PageWrapper } from '@components/layout/PageWrapper'
import { Button } from '@components/ui/Button'
import { LeaveRequests } from './LeaveRequests'
import { CompanyCalendar } from './CompanyCalendar'
import { CompensationManagement } from './CompensationManagement'
import { useLeaves } from '@hooks/useLeaves'
import { useAuthStore } from '@store/authStore'
import { filterLeaves, type LeaveFilters } from '@/utils/leaveFilters'
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
    employeeId: '',
    status: 'Pending',
    leaveType: '',
    dateFrom: '',
    dateTo: '',
  })
  const [compensationExportRows, setCompensationExportRows] = useState<CompensationExportRow[]>([])
  const [compensationSearch, setCompensationSearch] = useState('')
  const [exporting, setExporting] = useState<'pdf' | 'excel' | null>(null)

  const { leaves } = useLeaves()
  const user = useAuthStore((s) => s.user)

  const filteredLeaveRequests = useMemo(() => {
    const status = leaveFilters.status || 'Pending'
    return filterLeaves(
      leaves.filter((l) => l.status === status),
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
        employeeId: leaveFilters.employeeId || undefined,
        leaveType: leaveFilters.leaveType || undefined,
        dateRange: (leaveFilters.dateFrom || leaveFilters.dateTo)
          ? `${leaveFilters.dateFrom || 'Any'} → ${leaveFilters.dateTo || 'Any'}`
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
          exportLeavesToPDF(filteredLeaveRequests, filename, exportFilterMeta, generatedBy)
        } else {
          exportLeavesToExcel(filteredLeaveRequests, filename, exportFilterMeta, generatedBy)
        }
        toast.success(`Exported ${filteredLeaveRequests.length} leave request(s)`)
        return
      }

      if (!compensationExportRows.length) {
        toast.error('No compensation entries to export')
        return
      }
      if (format === 'pdf') {
        exportCompensationToPDF(compensationExportRows, filename, exportFilterMeta, generatedBy)
      } else {
        exportCompensationToExcel(compensationExportRows, filename, exportFilterMeta, generatedBy)
      }
      toast.success(`Exported ${compensationExportRows.length} compensation entr${compensationExportRows.length === 1 ? 'y' : 'ies'}`)
    } finally {
      setExporting(null)
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
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void handleExport('pdf')}
            loading={exporting === 'pdf'}
          >
            <Download className="h-4 w-4" />
            Export PDF
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void handleExport('excel')}
            loading={exporting === 'excel'}
          >
            <Download className="h-4 w-4" />
            Export Excel
          </Button>
        </div>
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
    </PageWrapper>
  )
}
