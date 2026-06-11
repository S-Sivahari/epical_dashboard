import api from '@/services/api'

export async function downloadWithAuth(url: string, filename?: string): Promise<void> {
  const { data } = await api.get(url, { responseType: 'blob' })
  const blob = data as Blob
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = filename || 'download'
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(objectUrl)
}

export async function openWithAuth(url: string): Promise<void> {
  const { data } = await api.get(url, { responseType: 'blob' })
  const blob = data as Blob
  const objectUrl = URL.createObjectURL(blob)
  window.open(objectUrl, '_blank', 'noopener,noreferrer')
  setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
}
