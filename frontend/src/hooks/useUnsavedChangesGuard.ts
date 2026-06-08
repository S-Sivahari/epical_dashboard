import { useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

const LEAVE_MESSAGE = 'You have unsaved changes. Leave without saving?'

/** Works with BrowserRouter — no data router required. */
export function useUnsavedChangesGuard(isDirty: boolean) {
  const allowLeaveRef = useRef(false)
  const navigate = useNavigate()

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (isDirty && !allowLeaveRef.current) {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [isDirty])

  useEffect(() => {
    if (!isDirty) return

    const onDocumentClick = (event: MouseEvent) => {
      if (allowLeaveRef.current) return

      const anchor = (event.target as HTMLElement | null)?.closest('a[href]') as
        | HTMLAnchorElement
        | null
      if (!anchor) return

      const href = anchor.getAttribute('href')
      if (!href || href.startsWith('#') || anchor.target === '_blank') return

      const url = new URL(anchor.href, window.location.origin)
      if (url.origin !== window.location.origin) return
      if (url.pathname === window.location.pathname) return

      if (!window.confirm(LEAVE_MESSAGE)) {
        event.preventDefault()
        event.stopPropagation()
      } else {
        allowLeaveRef.current = true
      }
    }

    document.addEventListener('click', onDocumentClick, true)
    return () => document.removeEventListener('click', onDocumentClick, true)
  }, [isDirty])

  useEffect(() => {
    if (!isDirty) return

    window.history.pushState(null, '', window.location.href)

    const onPopState = () => {
      if (allowLeaveRef.current) return
      if (!window.confirm(LEAVE_MESSAGE)) {
        window.history.pushState(null, '', window.location.href)
        return
      }
      allowLeaveRef.current = true
      navigate(-1)
    }

    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [isDirty, navigate])

  const confirmIfDirty = useCallback(() => {
    if (!isDirty || allowLeaveRef.current) return true
    const leave = window.confirm(LEAVE_MESSAGE)
    if (leave) allowLeaveRef.current = true
    return leave
  }, [isDirty])

  const guardedNavigate = useCallback(
    (to: string) => {
      if (confirmIfDirty()) navigate(to)
    },
    [confirmIfDirty, navigate],
  )

  const allowNavigation = useCallback(() => {
    allowLeaveRef.current = true
  }, [])

  return { guardedNavigate, allowNavigation }
}
