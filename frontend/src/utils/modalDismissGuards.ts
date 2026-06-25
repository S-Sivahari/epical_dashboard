/** Radix dismisses dialogs when focus moves outside (e.g. switching browser tabs). */
export function preventModalCloseOnTabSwitch(event: { preventDefault: () => void }) {
  event.preventDefault()
}

/** Ignore stray outside interactions while the document tab is hidden. */
export function preventModalCloseWhileHidden(event: { preventDefault: () => void }) {
  if (document.visibilityState === 'hidden') {
    event.preventDefault()
  }
}
