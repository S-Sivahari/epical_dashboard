import { useEffect, useState } from 'react'
import { getNotesAccess } from '@/services/notesService'
import type { NotesAccess } from '@/types/notes'

export function useEmployeeNotesAccess() {
  const [access, setAccess] = useState<NotesAccess | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void getNotesAccess()
      .then((result) => {
        if (!cancelled) setAccess(result)
      })
      .catch(() => {
        if (!cancelled) {
          setAccess({
            role: 'employee',
            canAccessToday: false,
            showNotesNav: false,
            delegatedDates: [],
          })
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return {
    access,
    loading,
    showNotesNav: access?.showNotesNav ?? false,
  }
}
