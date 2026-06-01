import { create } from 'zustand'

type ModalId = string | null

interface UiState {
  sidebarOpen: boolean
  sidebarCollapsed: boolean
  activeModal: ModalId
  notifications: number
  toggleSidebar: () => void
  setSidebarOpen: (v: boolean) => void
  toggleSidebarCollapsed: () => void
  setSidebarCollapsed: (v: boolean) => void
  openModal: (id: string) => void
  closeModal: () => void
}

export const useUiStore = create<UiState>((set) => ({
  sidebarOpen: true,
  sidebarCollapsed: false,
  activeModal: null,
  notifications: 3,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  toggleSidebarCollapsed: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
  openModal: (activeModal) => set({ activeModal }),
  closeModal: () => set({ activeModal: null }),
}))
