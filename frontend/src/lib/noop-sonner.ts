/** No-op replacement for sonner — toasts disabled application-wide. */
const noop = () => undefined

export const toast = Object.assign(noop, {
  success: noop,
  error: noop,
  info: noop,
  warning: noop,
  message: noop,
  promise: noop,
  loading: noop,
  dismiss: noop,
  custom: noop,
})

export function Toaster() {
  return null
}
