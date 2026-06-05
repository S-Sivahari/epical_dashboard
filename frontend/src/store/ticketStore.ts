import { create } from 'zustand'
import type { Ticket, TicketPriority, TicketStatus } from '@/types'
import * as ticketService from '@services/ticketService'

interface TicketState {
  tickets: Ticket[]
  loading: boolean
  initialized: boolean
  error: string | null
  fetchTickets: (filters?: ticketService.TicketFilters) => Promise<void>
  fetchTicketsSilent: (filters?: ticketService.TicketFilters) => Promise<void>
  createTicket: (payload: {
    employeeId: string
    employeeName: string
    title: string
    description?: string
    priority: TicketPriority
  }) => Promise<Ticket>
  uploadAttachment: (id: string, file: File) => Promise<void>
  updateStatus: (id: string, status: TicketStatus, remark?: string) => Promise<void>
  addComment: (id: string, text: string) => Promise<void>
  upsertTicket: (ticket: Ticket) => void
  removeTicket: (id: string) => void
}

let fetchSeq = 0

export const useTicketStore = create<TicketState>((set, get) => ({
  tickets: [],
  loading: false,
  initialized: false,
  error: null,

  fetchTickets: async (filters) => {
    const seq = ++fetchSeq
    set({ loading: true, error: null })
    try {
      const tickets = await ticketService.getTickets(filters)
      if (seq !== fetchSeq) return
      set({ tickets, loading: false, initialized: true })
    } catch (error: any) {
      if (seq !== fetchSeq) return
      set({
        loading: false,
        initialized: true,
        error: error?.response?.data?.error || 'Failed to fetch tickets',
      })
      throw error
    }
  },

  fetchTicketsSilent: async (filters) => {
    try {
      const tickets = await ticketService.getTickets(filters)
      set({ tickets, initialized: true })
    } catch (error) {
      console.error('Failed to refresh tickets:', error)
    }
  },

  createTicket: async (payload) => {
    const ticket = await ticketService.createTicket(payload)
    set({ tickets: [ticket, ...get().tickets], initialized: true })
    return ticket
  },

  uploadAttachment: async (id, file) => {
    const updated = await ticketService.uploadTicketAttachment(id, file)
    get().upsertTicket(updated)
  },

  updateStatus: async (id, status, remark) => {
    const updated = await ticketService.updateTicketStatus(id, status, remark)
    get().upsertTicket(updated)
  },

  addComment: async (id, text) => {
    const updated = await ticketService.addTicketComment(id, text)
    get().upsertTicket(updated)
  },

  upsertTicket: (ticket) => {
    set({
      tickets: get().tickets.some((t) => t.id === ticket.id)
        ? get().tickets.map((t) => (t.id === ticket.id ? ticket : t))
        : [ticket, ...get().tickets],
      initialized: true,
    })
  },

  removeTicket: (id) => {
    set({ tickets: get().tickets.filter((t) => t.id !== id) })
  },
}))
