import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Bot, ChevronUp, Minimize2, Send, Sparkles, X } from 'lucide-react'
import { useDashboardStore } from '@store/dashboardStore'
import { ROUTES } from '@constants/routes'
import { cn } from '@/utils/cn'

const suggestions = [
  'Summarize today\'s dashboard activity',
  'How many pending leave requests?',
  'Show payroll status overview',
  'Find employees in Engineering',
  'Generate attendance report',
]

const responses: Record<string, { text: string; route?: string }> = {
  'summarize': {
    text: 'Today: pending leave requests need review, attendance is tracking well, and active projects have logged hours this week. Payroll delivery is in progress.',
    route: ROUTES.DASHBOARD,
  },
  'leave': {
    text: 'Check the Leave Management section for pending approvals. You can approve or reject with balance validation.',
    route: ROUTES.LEAVES,
  },
  'payroll': {
    text: 'Visit Payslip Management to upload payroll, generate payslips, and send them to employee dashboards.',
    route: ROUTES.PAYSLIPS,
  },
  'employees': {
    text: 'Open Manage Employees to search, filter, and view profiles across departments.',
    route: ROUTES.EMPLOYEES,
  },
  'attendance': {
    text: 'Analytics page shows KPI trends. Projects/Timesheets has detailed hour logs and exports.',
    route: ROUTES.ANALYTICS,
  },
}

function getResponse(query: string) {
  const q = query.toLowerCase()
  if (q.includes('summar')) return responses.summarize
  if (q.includes('leave') || q.includes('pending')) return responses.leave
  if (q.includes('payroll') || q.includes('payslip')) return responses.payroll
  if (q.includes('employee') || q.includes('find')) return responses.employees
  if (q.includes('attendance') || q.includes('report')) return responses.attendance
  return {
    text: 'I can help you search employees, explain analytics, find payroll info, and summarize dashboard activity. Try one of the suggested prompts below.',
  }
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  route?: string
}

export function AIAssistantPanel() {
  const navigate = useNavigate()
  const { aiAssistantOpen, aiAssistantMinimized, setAiAssistantOpen, setAiAssistantMinimized } =
    useDashboardStore()
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Hi! I\'m your EMPWR assistant. Ask me about employees, payroll, leaves, or analytics.',
    },
  ])
  const [input, setInput] = useState('')

  function sendMessage(text: string) {
    if (!text.trim()) return
    const response = getResponse(text)
    setMessages((m) => [
      ...m,
      { role: 'user', content: text },
      { role: 'assistant', content: response.text, route: response.route },
    ])
    setInput('')
  }

  if (!aiAssistantOpen) {
    return (
      <motion.button
        type="button"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        onClick={() => setAiAssistantOpen(true)}
        className="cmd-ai-fab fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full px-4 py-2.5 shadow-xl lg:left-auto lg:right-24 lg:translate-x-0"
      >
        <Sparkles className="h-4 w-4" />
        <span className="text-sm font-semibold">AI Assistant</span>
      </motion.button>
    )
  }

  return (
    <motion.div
      layout
      className={cn(
        'cmd-ai-panel fixed z-50 flex flex-col overflow-hidden shadow-2xl',
        aiAssistantMinimized
          ? 'bottom-6 right-6 h-12 w-64 rounded-2xl'
          : 'bottom-6 right-6 h-[min(480px,70vh)] w-[min(380px,calc(100vw-2rem))] rounded-2xl',
      )}
    >
      <div className="cmd-ai-header flex shrink-0 items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/20">
            <Bot className="h-4 w-4 text-white" />
          </div>
          {!aiAssistantMinimized && (
            <div>
              <p className="text-sm font-semibold text-white">EMPWR Assistant</p>
              <p className="text-[10px] text-white/70">Powered by intelligent insights</p>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setAiAssistantMinimized(!aiAssistantMinimized)}
            className="rounded-lg p-1.5 text-white/80 hover:bg-white/10"
          >
            {aiAssistantMinimized ? <ChevronUp className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => setAiAssistantOpen(false)}
            className="rounded-lg p-1.5 text-white/80 hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {!aiAssistantMinimized && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={cn(
                    'max-w-[90%] rounded-2xl px-3 py-2 text-sm',
                    msg.role === 'user'
                      ? 'ml-auto bg-gradient-to-br from-[var(--emerald-primary)] to-[var(--emerald-fresh)] text-white'
                      : 'bg-[var(--emerald-surface)] text-[var(--text-primary)] border border-[var(--border-green)]',
                  )}
                >
                  {msg.content}
                  {msg.route && msg.role === 'assistant' && (
                    <button
                      type="button"
                      onClick={() => navigate(msg.route!)}
                      className="mt-2 block text-xs font-semibold text-[var(--emerald-primary)] hover:underline"
                    >
                      Go to page →
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="shrink-0 border-t border-[var(--border-subtle)] px-3 py-2">
              <div className="mb-2 flex flex-wrap gap-1">
                {suggestions.slice(0, 3).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => sendMessage(s)}
                    className="rounded-full bg-[var(--emerald-sage)] px-2 py-0.5 text-[10px] font-medium text-[var(--emerald-dark)] hover:bg-[var(--emerald-mint)] hover:text-[var(--emerald-dark)]"
                  >
                    {s}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendMessage(input)}
                  placeholder="Ask anything..."
                  className="cmd-ai-input flex-1 rounded-xl px-3 py-2 text-sm outline-none"
                />
                <button
                  type="button"
                  onClick={() => sendMessage(input)}
                  className="cmd-ai-send flex h-9 w-9 items-center justify-center rounded-xl"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
