export const EXPORT_LOGO_PATH = '/logo.jpeg'
export const PDF_LOGO_MAX_WIDTH = 72

export interface ExportLogoAsset {
  dataUrl: string
  width: number
  height: number
}

export function scaleExportLogo(width: number, height: number, maxWidth: number) {
  const w = Math.min(maxWidth, width)
  const ratio = height / width
  return { width: w, height: w * ratio }
}

let logoCache: ExportLogoAsset | null = null

export async function fetchExportLogo(): Promise<ExportLogoAsset | null> {
  if (logoCache) return logoCache
  try {
    const res = await fetch(`${EXPORT_LOGO_PATH}?t=${Date.now()}`)
    if (!res.ok) return null
    const buffer = await res.arrayBuffer()
    const contentType = EXPORT_LOGO_PATH.endsWith('.png') ? 'image/png' : 'image/jpeg'
    const blob = new Blob([buffer], { type: contentType })
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
    const dims = await new Promise<{ width: number; height: number }>((resolve) => {
      const img = new Image()
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
      img.onerror = () => resolve({ width: 200, height: 200 })
      img.src = dataUrl
    })
    logoCache = { dataUrl, ...dims }
    return logoCache
  } catch {
    return null
  }
}

/** Draw logo at top-left; returns Y position below logo/header row. */
export function drawPdfLogoLeft(
  doc: { addImage: (imageData: string, format: string, x: number, y: number, w: number, h: number) => void },
  logo: ExportLogoAsset,
  leftX = 40,
  topY = 14,
): number {
  const { width, height } = scaleExportLogo(logo.width, logo.height, PDF_LOGO_MAX_WIDTH)
  const format = EXPORT_LOGO_PATH.endsWith('.png') ? 'PNG' : 'JPEG'
  doc.addImage(logo.dataUrl, format, leftX, topY, width, height)
  return topY + height + 10
}

export function downloadExcelBuffer(buffer: ArrayBuffer, filename: string) {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`
  link.click()
  URL.revokeObjectURL(url)
}
