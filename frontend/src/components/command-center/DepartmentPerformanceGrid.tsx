import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight, TrendingDown, TrendingUp, Users } from 'lucide-react'
import { GlassCard, SectionHeader, SkeletonBlock } from './shared'
import type { DepartmentStats } from '@hooks/useCommandCenterData'
import { cn } from '@/utils/cn'
import { AnimatedCounter } from './AnimatedCounter'

export function DepartmentPerformanceGrid({
  departments,
  loading,
}: {
  departments: DepartmentStats[]
  loading: boolean
}) {
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <section>
      <SectionHeader
        title="Department Performance"
        subtitle="Click any department for detailed analytics"
        tone="green"
      />
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <SkeletonBlock key={i} className="h-36" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {departments.map((dept, i) => {
            const isOpen = expanded === dept.name
            return (
              <motion.div
                key={dept.name}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={cn(isOpen && 'sm:col-span-2 lg:col-span-2')}
              >
                <GlassCard
                  padding="sm"
                  className={cn('cmd-dept-card cursor-pointer', isOpen && 'cmd-dept-expanded')}
                  hover
                >
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => setExpanded(isOpen ? null : dept.name)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-display text-base font-semibold text-[var(--text-primary)]">{dept.name}</h3>
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-[var(--text-muted)]">
                          <Users className="h-3 w-3" />
                          {dept.employeeCount} employees
                        </p>
                      </div>
                      <ChevronRight className={cn('h-4 w-4 text-[var(--text-muted)] transition-transform', isOpen && 'rotate-90')} />
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2">
                      <div className="cmd-mini-stat rounded-lg p-2">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-subtle)]">Performance</p>
                        <p className="text-lg font-bold text-[var(--text-green)]">{dept.performance}%</p>
                      </div>
                      <div className="cmd-mini-stat rounded-lg p-2">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-subtle)]">Attendance</p>
                        <p className="text-lg font-bold tabular-nums text-[var(--text-blue-dark)]">{dept.attendanceRate}%</p>
                      </div>
                      <div className="cmd-mini-stat rounded-lg p-2">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-subtle)]">Open tasks</p>
                        <p className="text-lg font-bold tabular-nums text-[var(--text-primary)]">{dept.openTasks}</p>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center gap-1.5 text-xs font-medium">
                      {dept.growth >= 0 ? (
                        <TrendingUp className="h-3.5 w-3.5 text-[var(--text-green)]" />
                      ) : (
                        <TrendingDown className="h-3.5 w-3.5 text-[var(--text-blue-dark)]" />
                      )}
                      <span className={dept.growth >= 0 ? 'text-[var(--text-green-fresh)]' : 'text-[var(--text-blue)]'}>
                        {dept.growth >= 0 ? '+' : ''}{dept.growth}% growth
                      </span>
                    </div>
                  </button>

                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-4 border-t border-[var(--border-subtle)] pt-4">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                              <p className="text-xs font-medium text-[var(--text-muted)]">Attendance breakdown</p>
                              <div className="cmd-progress-track mt-2">
                                <motion.div
                                  className="cmd-progress-fill"
                                  initial={{ width: 0 }}
                                  animate={{ width: `${dept.attendanceRate}%` }}
                                  transition={{ duration: 0.8 }}
                                />
                              </div>
                              <p className="mt-1 text-sm tabular-nums">
                                <AnimatedCounter value={dept.attendanceRate} suffix="% present" />
                              </p>
                            </div>
                            <div>
                              <p className="text-xs font-medium text-[var(--text-muted)]">Performance score</p>
                              <div className="cmd-progress-track mt-2">
                                <motion.div
                                  className="cmd-progress-fill"
                                  style={{ background: 'linear-gradient(90deg, #14532D, #166534, #15803D)' }}
                                  initial={{ width: 0 }}
                                  animate={{ width: `${dept.performance}%` }}
                                  transition={{ duration: 0.8, delay: 0.1 }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </GlassCard>
              </motion.div>
            )
          })}
        </div>
      )}
    </section>
  )
}
