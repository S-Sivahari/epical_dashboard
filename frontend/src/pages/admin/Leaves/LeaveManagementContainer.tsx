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
    employeeName: '',
    employeeId: '',
    status: 'Pending',
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
        name: leaveFilters.employeeName || undefined,
        employeeId: leaveFilters.employeeId || undefined,
      }
    }
    if (activeTab === 'calendar') {
      return { ...base, status: 'Approved', view: 'Company Calendar' }
    }
    return { ...base, search: compensationSearch || undefined }
  }, [activeTab, leaveFilters, compensationSearch])

  const handleExport = async (format: 'pdf' | 'excel') => {
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

      if (activeTab === 'calendar') {
        const approvedLeaves = leaves.filter((l) => l.status === 'Approved')
        if (!approvedLeaves.length) {
          toast.error('No approved leaves to export')
          return
        }
        if (format === 'pdf') {
          exportLeavesToPDF(approvedLeaves, filename, exportFilterMeta, generatedBy)
        } else {
          exportLeavesToExcel(approvedLeaves, filename, exportFilterMeta, generatedBy)
        }
        toast.success(`Exported ${approvedLeaves.length} approved leave(s)`)
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
    <PageWrapper className={activeTab === 'calendar' ? 'max-w-none pl-0 sm:pl-0 lg:pl-0 pr-6 sm:pr-6 lg:pr-6 w-full' : ''}>
      <div className={`mb-6 ${
        activeTab === 'calendar' ? 'pl-6 sm:pl-6 lg:pl-6' : ''
      }`}>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 w-full">
          <div className="flex flex-row items-center gap-2 flex-wrap">
            {tabs.map((tab) => (
              <Button
                key={tab.id}
                variant={activeTab === tab.id ? 'primary' : 'secondary'}
                onClick={() => setActiveTab(tab.id)}
                size="sm"
                className="whitespace-nowrap"
              >
                {tab.label}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void handleExport('pdf')}
              loading={exporting === 'pdf'}
              className="whitespace-nowrap"
            >
              <Download className="mr-1.5 h-4 w-4" />
              Export PDF
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void handleExport('excel')}
              loading={exporting === 'excel'}
              className="whitespace-nowrap"
            >
              <Download className="mr-1.5 h-4 w-4" />
              Export Excel
            </Button>
          </div>
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
