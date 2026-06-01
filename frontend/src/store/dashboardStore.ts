import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type DashboardWidgetId =
  | 'executive'
  | 'insights'
  | 'analytics'
  | 'operations'
  | 'departments'
  | 'calendar'
  | 'notifications'
  | 'documents'
  | 'ai-assistant'

export const DEFAULT_WIDGET_ORDER: DashboardWidgetId[] = [
  'executive',
  'insights',
  'analytics',
  'operations',
  'departments',
  'calendar',
  'notifications',
  'documents',
  'ai-assistant',
]

interface DashboardState {
  widgetOrder: DashboardWidgetId[]
  collapsedWidgets: Record<string, boolean>
  commandPaletteOpen: boolean
  aiAssistantOpen: boolean
  aiAssistantMinimized: boolean
  setWidgetOrder: (order: DashboardWidgetId[]) => void
  moveWidget: (fromIndex: number, toIndex: number) => void
  toggleWidgetCollapsed: (id: DashboardWidgetId) => void
  setCommandPaletteOpen: (open: boolean) => void
  toggleCommandPalette: () => void
  setAiAssistantOpen: (open: boolean) => void
  setAiAssistantMinimized: (minimized: boolean) => void
  resetLayout: () => void
}

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set, get) => ({
      widgetOrder: DEFAULT_WIDGET_ORDER,
      collapsedWidgets: {},
      commandPaletteOpen: false,
      aiAssistantOpen: true,
      aiAssistantMinimized: false,
      setWidgetOrder: (widgetOrder) => set({ widgetOrder }),
      moveWidget: (fromIndex, toIndex) => {
        const order = [...get().widgetOrder]
        const [item] = order.splice(fromIndex, 1)
        order.splice(toIndex, 0, item)
        set({ widgetOrder: order })
      },
      toggleWidgetCollapsed: (id) =>
        set((s) => ({
          collapsedWidgets: { ...s.collapsedWidgets, [id]: !s.collapsedWidgets[id] },
        })),
      setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),
      toggleCommandPalette: () => set((s) => ({ commandPaletteOpen: !s.commandPaletteOpen })),
      setAiAssistantOpen: (aiAssistantOpen) => set({ aiAssistantOpen }),
      setAiAssistantMinimized: (aiAssistantMinimized) => set({ aiAssistantMinimized }),
      resetLayout: () =>
        set({
          widgetOrder: DEFAULT_WIDGET_ORDER,
          collapsedWidgets: {},
        }),
    }),
    { name: 'empwr-dashboard-layout' },
  ),
)
