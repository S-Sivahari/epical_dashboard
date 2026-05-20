import { create } from 'zustand'

export const useUIStore = create((set) => ({
  sidebarCollapsed: false,
  sidebarMobileOpen: false,
  logoutModalOpen: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebarMobileOpen: (open) => set({ sidebarMobileOpen: open }),
  setLogoutModalOpen: (open) => set({ logoutModalOpen: open }),
}))
