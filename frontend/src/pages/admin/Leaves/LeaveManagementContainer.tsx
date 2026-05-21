import { useState } from 'react'
import { PageWrapper } from '@components/layout/PageWrapper'
import { Button } from '@components/ui/Button'
import { LeaveRequests } from './LeaveRequests'
import { CompanyCalendar } from './CompanyCalendar'
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
    <PageWrapper className={activeTab === 'calendar' ? 'max-w-none pl-0 sm:pl-0 lg:pl-0 pr-6 sm:pr-6 lg:pr-6 w-full' : ''}>
      <div className={`mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 ${
        activeTab === 'calendar' ? 'pl-6 sm:pl-6 lg:pl-6' : ''
      }`}>
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