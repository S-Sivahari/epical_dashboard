import type { TopNotice } from '@components/pdk/TopDismissNotice'

type SetNotice = (notice: TopNotice | null) => void

export function showPortalError(setNotice: SetNotice, title: string, message: string) {
  setNotice({ kind: 'error', title, details: [message] })
}

export function showPortalSuccess(setNotice: SetNotice, title: string, message: string) {
  setNotice({ kind: 'success', title, details: [message] })
}
