import { create } from 'zustand'

type ModalId = string | null

interface UiState {
  sidebarOpen: boolean
  activeModal: ModalId
  notifications: number
  toggleSidebar: () => void
  setSidebarOpen: (v: boolean) => void
  openModal: (id: string) => void
  closeModal: () => void
}

export const useUiStore = create<UiState>((set) => ({
  sidebarOpen: true,
  activeModal: null,
  notifications: 3,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  openModal: (activeModal) => set({ activeModal }),
  closeModal: () => set({ activeModal: null }),
}))
