import { useState, useEffect, useCallback } from 'react'
import { PageWrapper } from '@components/layout/PageWrapper'
import { 
  LayoutGrid, Folder, Layers, UserCheck, FileSpreadsheet, 
  History, FolderOpen
} from 'lucide-react'
import api from '@/services/api'
import { toast } from 'sonner'

// Import sub-pages
import { ProjectsDashboard } from './components/ProjectsDashboard'
import { ProjectsPage } from './components/ProjectsPage'
import { LibrariesPage } from './components/LibrariesPage'
import { CellsPage } from './components/CellsPage'
import { ReviewsPage } from './components/ReviewsPage'
import { ChecklistsPage } from './components/ChecklistsPage'
import { AuditLogsPage } from './components/AuditLogsPage'

export function ProjectManagementModule() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'projects' | 'libraries' | 'cells' | 'reviews' | 'checklists' | 'audit'>('dashboard')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [metrics, setMetrics] = useState<any>(null)
  
  // Fetch metrics for dashboard
  const fetchMetrics = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await api.get('/project-management/dashboard/metrics')
      setMetrics(res.data)
    } catch (err: any) {
      console.error('Failed to load metrics:', err)
      setError(err?.message || 'Failed to load dashboard metrics')
      toast.error('Failed to load dashboard metrics')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'dashboard') {
      fetchMetrics()
    }
  }, [activeTab, fetchMetrics])

  const tabs = [
    { id: 'dashboard' as const, label: 'Dashboard', icon: LayoutGrid },
    { id: 'projects' as const, label: 'Projects', icon: FolderOpen },
    { id: 'libraries' as const, label: 'Libraries', icon: Folder },
    { id: 'cells' as const, label: 'Cells & Views', icon: Layers },
    { id: 'reviews' as const, label: 'Reviews', icon: UserCheck },
    { id: 'checklists' as const, label: 'Checklists', icon: FileSpreadsheet },
    { id: 'audit' as const, label: 'Audit', icon: History },
  ]

  return (
    <PageWrapper fillViewport>
      <div className="flex h-full flex-col">
        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-border bg-white px-6 py-3">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                  isActive
                    ? 'bg-[var(--emerald-dark)] text-white shadow-md'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto bg-slate-50 p-6">
          {activeTab === 'dashboard' && (
            <ProjectsDashboard 
              metrics={metrics} 
              loading={loading} 
              error={error}
              onRefresh={fetchMetrics}
            />
          )}
          {activeTab === 'projects' && <ProjectsPage />}
          {activeTab === 'libraries' && <LibrariesPage />}
          {activeTab === 'cells' && <CellsPage />}
          {activeTab === 'reviews' && <ReviewsPage />}
          {activeTab === 'checklists' && <ChecklistsPage />}
          {activeTab === 'audit' && <AuditLogsPage />}
        </div>
      </div>
    </PageWrapper>
  )
}
