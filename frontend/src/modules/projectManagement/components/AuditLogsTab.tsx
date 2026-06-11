import { useEffect, useState, useCallback } from 'react'
import api from '@/services/api'
import { Spinner } from '@components/ui/Spinner'
import { Input } from '@components/ui/Input'
import { Button } from '@components/ui/Button'
import { toast } from 'sonner'
import {
  Search,
  ChevronDown,
  ChevronUp
} from 'lucide-react'

interface AuditLog {
  _id: string
  user: string
  action: string
  targetId: string
  targetType: string
  previousState: any
  newState: any
  timestamp: string
}

export function AuditLogsTab() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null)

  const fetchLogs = useCallback(async (search = '') => {
    try {
      setLoading(true)
      const query = search ? `?search=${encodeURIComponent(search)}` : ''
      const res = await api.get(`/project-management/audit-logs${query}`)
      setLogs(res.data)
    } catch {
      toast.error('Failed to load audit logs')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchLogs(searchQuery.trim())
  }

  const toggleExpand = (logId: string) => {
    if (expandedLogId === logId) {
      setExpandedLogId(null)
    } else {
      setExpandedLogId(logId)
    }
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Search Bar */}
      <form onSubmit={handleSearch} className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex gap-3 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by action, user email, or target..."
            className="pl-9 h-9 text-xs"
          />
        </div>
        <Button type="submit" className="bg-[var(--emerald-dark)] hover:bg-emerald-800 text-white font-bold h-9 px-5 text-xs">
          Search Logs
        </Button>
      </form>

      {/* Logs Table */}
      {loading ? (
        <div className="flex h-64 items-center justify-center bg-white rounded-2xl border border-slate-200/80 shadow-sm">
          <Spinner className="h-8 w-8 text-emerald-600" />
        </div>
      ) : logs.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-400 font-bold text-xs">
          No audit logs matching search parameters.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-bold bg-slate-50/50">
                  <th className="py-3 px-4 w-10"></th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Target Type</th>
                  <th className="py-3 px-4">Target ID</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const expanded = expandedLogId === log._id
                  const hasDetails = log.previousState || log.newState
                  
                  return (
                    <>
                      <tr
                        key={log._id}
                        className={`border-b border-slate-100 hover:bg-slate-50/30 transition-colors ${
                          expanded ? 'bg-slate-50/20' : 'bg-white'
                        }`}
                      >
                        <td className="py-3 px-4">
                          {hasDetails && (
                            <button
                              onClick={() => toggleExpand(log._id)}
                              className="text-slate-400 hover:text-slate-600 transition-colors"
                            >
                              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </button>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-500 font-medium">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-700">{log.user}</td>
                        <td className="py-3 px-4 font-bold text-emerald-700">{log.action}</td>
                        <td className="py-3 px-4">
                          <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-[10px] font-bold">
                            {log.targetType}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-400 select-all font-semibold">
                          {log.targetId}
                        </td>
                      </tr>
                      {expanded && hasDetails && (
                        <tr className="bg-slate-50/40 border-b border-slate-100">
                          <td colSpan={6} className="py-3.5 px-6 font-mono text-[10px] leading-relaxed select-all">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {log.previousState && (
                                <div className="p-3 bg-white border border-slate-100 rounded-xl">
                                  <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block mb-1.5 font-sans">Previous State</span>
                                  <pre className="whitespace-pre-wrap overflow-x-auto text-rose-600">
                                    {JSON.stringify(log.previousState, null, 2)}
                                  </pre>
                                </div>
                              )}
                              {log.newState && (
                                <div className="p-3 bg-white border border-slate-100 rounded-xl">
                                  <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block mb-1.5 font-sans">New State</span>
                                  <pre className="whitespace-pre-wrap overflow-x-auto text-emerald-700">
                                    {JSON.stringify(log.newState, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
