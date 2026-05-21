import { useState } from 'react'
import { Breadcrumb } from '@components/layout/Breadcrumb'
import { PageHeader } from '@components/layout/PageHeader'
import { PageWrapper } from '@components/layout/PageWrapper'
import { LeaveRequests } from './LeaveRequests'
import { CompanyCalendar } from './CompanyCalendar'
import { CompensationManagement } from './CompensationManagement'

type TabType = 'requests' | 'calendar' | 'compensation'

const tabs: Array<{ id: TabType; label: string; icon: string }> = [
  { id: 'requests', label: 'Leave Requests', icon: '📋' },
  { id: 'calendar', label: 'Company Calendar', icon: '📅' },
  { id: 'compensation', label: 'Compensation Management', icon: '🎯' },
]

export function LeaveManagementContainer() {
  const [activeTab, setActiveTab] = useState<TabType>('requests')

  return (
    <PageWrapper>
      <PageHeader
        title="Leave Management"
        breadcrumb={<Breadcrumb items={[{ label: 'Leaves', to: '/admin/leaves' }]} />}
      />

      {/* Tab Navigation */}
      <div className="mb-6 border-b border-border">
        <div className="flex space-x-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted hover:text-ink hover:border-border'
              }`}
            >
              <span className="text-lg">{tab.icon}</span>
              {tab.label}
            </button>
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
