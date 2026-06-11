import { useState, useEffect } from 'react'
import { Clock, List, Search } from 'lucide-react'
import { Spinner } from '@components/ui/Spinner'
import api from '@/services/api'
import { toast } from 'sonner'

type ViewMode = 'timeline' | 'table'

interface AuditLog {
  id: string
  timestamp: string
  user: string
  action: string
  target: string
  oldValue: string
  newValue: string
  ipAddress?: string
}

export function AuditLogsPage() {
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem('projectManagement.audit.viewMode')
    return (saved as ViewMode) || 'timeline'
  })
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetchAuditLogs()
  }, [])

  useEffect(() => {
    localStorage.setItem('projectManagement.audit.viewMode', viewMode)
  }, [viewMode])

  const fetchAuditLogs = async () => {
    try {
      setLoading(true)
      const res = await api.get('/project-management/audit-logs')
      // Map backend audit log data to frontend structure
      const mappedLogs = res.data.map((log: any) => ({
        id: log._id,
        timestamp: new Date(log.timestamp).toLocaleString(),
        user: log.user || 'System',
        action: log.action || 'Unknown action',
        target: `${log.targetType}: ${log.targetId}`,
        oldValue: log.oldValue || '',
        newValue: log.newValue || '',
        ipAddress: log.metadata?.ipAddress || '',
      }))
      setLogs(mappedLogs)
    } catch (err) {
      console.error('Failed to fetch audit logs:', err)
      toast.error('Failed to load audit logs')
      setLogs([])
    } finally {
      setLoading(false)
    }
  }

  const filteredLogs = logs.filter((log) =>
    log.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.target.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Audit Logs</h2>
          <p className="mt-1 text-sm text-slate-600">System tracking and activity history</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search audit logs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-10 w-full rounded-lg border border-border bg-white pl-9 pr-3 text-sm font-semibold focus:border-[var(--emerald-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--emerald-dark)]/20"
          />
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-border bg-white p-1">
          <button
            onClick={() => setViewMode('timeline')}
            className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-semibold transition-all ${
              viewMode === 'timeline' ? 'bg-[var(--emerald-dark)] text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Clock className="h-4 w-4" />
            Timeline View
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-semibold transition-all ${
              viewMode === 'table' ? 'bg-[var(--emerald-dark)] text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <List className="h-4 w-4" />
            Table View
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner size="lg" />
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center">
          <p className="text-sm font-semibold text-slate-600">No audit logs found</p>
        </div>
      ) : viewMode === 'timeline' ? (
        <TimelineView logs={filteredLogs} />
      ) : (
        <TableView logs={filteredLogs} />
      )}
    </div>
  )
}

function TimelineView({ logs }: { logs: AuditLog[] }) {
  return (
    <div className="space-y-4">
      {logs.map((log, index) => (
        <div key={log.id} className="relative">
          {index !== logs.length - 1 && (
            <div className="absolute left-4 top-10 h-full w-0.5 bg-slate-200" />
          )}
          <div className="flex gap-4">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[var(--emerald-dark)] text-white">
              <Clock className="h-4 w-4" />
            </div>
            <div className="flex-1 rounded-xl border border-border bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-start justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-900">{log.action}</p>
                  <p className="text-xs font-semibold text-slate-600">{log.user}</p>
                </div>
                <span className="text-xs font-semibold text-slate-500">{log.timestamp}</span>
              </div>
              <div className="space-y-1 text-xs">
                <p className="text-slate-600">
                  <span className="font-semibold">Target:</span> {log.target}
                </p>
                {log.oldValue && (
                  <p className="text-slate-600">
                    <span className="font-semibold">Old Value:</span> {log.oldValue}
                  </p>
                )}
                {log.newValue && (
                  <p className="text-slate-600">
                    <span className="font-semibold">New Value:</span> {log.newValue}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function TableView({ logs }: { logs: AuditLog[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-600">Timestamp</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-600">User</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-600">Action</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-600">Target</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-600">Old Value</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-600">New Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-sm font-semibold text-slate-600">{log.timestamp}</td>
                <td className="px-4 py-3 text-sm font-bold text-slate-900">{log.user}</td>
                <td className="px-4 py-3 text-sm font-semibold text-slate-600">{log.action}</td>
                <td className="px-4 py-3 text-sm font-semibold text-slate-600">{log.target}</td>
                <td className="px-4 py-3 text-sm font-semibold text-slate-600">{log.oldValue || '—'}</td>
                <td className="px-4 py-3 text-sm font-semibold text-slate-600">{log.newValue || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
