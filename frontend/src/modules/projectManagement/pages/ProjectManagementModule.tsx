import { useState } from 'react'
import { PageWrapper } from '@components/layout/PageWrapper'
import { LayoutGrid, Folder, Layers, UserCheck, FileSpreadsheet, History } from 'lucide-react'

// Import Tab Components
import { DashboardTab } from '../components/DashboardTab'
import { LibrariesTab } from '../components/LibrariesTab'
import { CellsTab } from '../components/CellsTab'
import { ReviewsTab } from '../components/ReviewsTab'
import { ChecklistsTab } from '../components/ChecklistsTab'
import { AuditLogsTab } from '../components/AuditLogsTab'

export function ProjectManagementModule() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'libraries' | 'cells' | 'reviews' | 'checklists' | 'audit'>('dashboard')
  
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
    { id: 'libraries', label: 'Libraries', icon: Folder },
    { id: 'cells', label: 'Cells & Views', icon: Layers },
    { id: 'reviews', label: 'Review Queues', icon: UserCheck },
    { id: 'checklists', label: 'Checklist Templates', icon: FileSpreadsheet },
    { id: 'audit', label: 'Audit Logs', icon: History }
  ]

  return (
    <PageWrapper fillViewport className="p-0 flex flex-row">
      {/* Nested Left PM Sidebar */}
      <div className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between shrink-0 h-full text-slate-300">
        <div className="flex flex-col gap-1.5 p-6 border-b border-slate-800">
          <h1 className="text-sm font-black tracking-tight text-white uppercase">Project Management</h1>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Workflow Engine</p>
        </div>
        
        {/* Navigation Links */}
        <div className="flex-1 py-4 flex flex-col gap-1 overflow-y-auto">
          {tabs.map(tab => {
            const Icon = tab.icon
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-3 px-6 py-3.5 text-xs font-bold transition-all border-l-4 leading-none whitespace-nowrap ${
                  active
                    ? 'border-emerald-500 text-emerald-400 bg-emerald-950/20'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {tab.label}
              </button>
            )
          })}
        </div>
        
        {/* Sidebar Footer */}
        <div className="p-4 border-t border-slate-800 text-[10px] text-slate-500 font-semibold tracking-wider uppercase text-center bg-slate-950/20">
          v1.0.0 Stable
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-8 min-w-0 bg-slate-50/50">
        <div className="max-w-[1600px] mx-auto space-y-6">
          {activeTab === 'dashboard' && <DashboardTab />}
          {activeTab === 'libraries' && <LibrariesTab />}
          {activeTab === 'cells' && <CellsTab />}
          {activeTab === 'reviews' && <ReviewsTab />}
          {activeTab === 'checklists' && <ChecklistsTab />}
          {activeTab === 'audit' && <AuditLogsTab />}
        </div>
      </div>
    </PageWrapper>
  )
}


export default ProjectManagementModule
