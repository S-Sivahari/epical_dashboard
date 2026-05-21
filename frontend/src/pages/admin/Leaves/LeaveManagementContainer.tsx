import { useState } from 'react'
import { PageWrapper } from '@components/layout/PageWrapper'
import { Button } from '@components/ui/Button'
import { LeaveRequests } from './LeaveRequests'
import { CompanyCalendar } from '@pages/admin/Calendar/CompanyCalendar_merged'
import { CompensationManagement } from './CompensationManagement'

type TabType = 'requests' | 'calendar' | 'compensation'

const tabs: Array<{ id: TabType; label: string }> = [
  { id: 'requests', label: 'Leave Requests' },
  { id: 'calendar', label: 'Company Calendar' },
  { id: 'compensation', label: 'Compensation Management' },
]

export function LeaveManagementContainer() {
  const [activeTab, setActiveTab] = useState<TabType>('requests')

  return (
    <PageWrapper>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">Manage Leaves</h1>
          <p className="text-sm text-muted">Leaves</p>
        </div>
        <div className="flex gap-2 sm:flex-col lg:flex-row">
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
      </div>

      {/* Tab Content */}
      <div className="animate-fadeIn">
        {activeTab === 'requests' && <LeaveRequests />}
        {activeTab === 'calendar' && <CompanyCalendar />}
        {activeTab === 'compensation' && <CompensationManagement />}
      </div>
    </PageWrapper>
  )
}