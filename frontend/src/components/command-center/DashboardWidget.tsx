import type { ReactNode } from 'react'
import { ChevronDown, ChevronUp, GripVertical } from 'lucide-react'
import { motion } from 'framer-motion'
import { useDashboardStore, type DashboardWidgetId } from '@store/dashboardStore'
import { cn } from '@/utils/cn'

export function DashboardWidget({
  id,
  children,
  className,
  fullWidth,
}: {
  id: DashboardWidgetId
  children: ReactNode
  className?: string
  fullWidth?: boolean
}) {
  const collapsed = useDashboardStore((s) => s.collapsedWidgets[id])
  const toggleCollapsed = useDashboardStore((s) => s.toggleWidgetCollapsed)
  const moveWidget = useDashboardStore((s) => s.moveWidget)
  const widgetOrder = useDashboardStore((s) => s.widgetOrder)
  const index = widgetOrder.indexOf(id)

  function handleDragStart(e: React.DragEvent) {
    e.dataTransfer.setData('widget-id', id)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const draggedId = e.dataTransfer.getData('widget-id') as DashboardWidgetId
    const fromIndex = widgetOrder.indexOf(draggedId)
    const toIndex = widgetOrder.indexOf(id)
    if (fromIndex >= 0 && toIndex >= 0 && fromIndex !== toIndex) {
      moveWidget(fromIndex, toIndex)
    }
  }

  return (
    <motion.div
      layout
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={cn(
        'cmd-widget group relative',
        fullWidth && 'col-span-full',
        className,
      )}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.4 }}
    >
      <div
        draggable
        onDragStart={handleDragStart}
        className="cmd-widget-handle absolute right-3 top-3 z-10 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100"
        title="Drag to reorder"
      >
        <GripVertical className="h-4 w-4 cursor-grab text-[var(--text-muted)]" aria-hidden />
        <button
          type="button"
          onClick={() => toggleCollapsed(id)}
          className="cmd-bar-icon-btn !h-7 !w-7"
          aria-label={collapsed ? 'Expand section' : 'Collapse section'}
        >
          {collapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
        </button>
      </div>
      {!collapsed && children}
      {collapsed && (
        <button
          type="button"
          onClick={() => toggleCollapsed(id)}
          className="cmd-widget-collapsed flex w-full items-center justify-between rounded-xl px-4 py-3 text-sm font-medium text-[var(--text-secondary)]"
        >
          Section collapsed — click to expand
          <ChevronDown className="h-4 w-4" />
        </button>
      )}
    </motion.div>
  )
}
