/** Chip logo — PNG keeps edges sharp in PDF exports (JPEG smears fine detail). */
export const EXPORT_LOGO_PATH = '/pic/epical-chip-logo.png?v=3'
export const PDF_LOGO_MAX_WIDTH = 72
/** Compact logo for employee detail / directory PDF headers */
export const PDF_LOGO_MAX_WIDTH_COMPACT = 38

export interface ExportLogoAsset {
  dataUrl: string
  width: number
  height: number
}

export function logoImageFormat(dataUrl: string): 'PNG' | 'JPEG' {
  return dataUrl.includes('image/png') ? 'PNG' : 'JPEG'
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
    const res = await fetch(EXPORT_LOGO_PATH)
    if (!res.ok) return null
    const buffer = await res.arrayBuffer()
    const contentType = res.headers.get('content-type') ?? 'image/png'
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
  doc.addImage(logo.dataUrl, logoImageFormat(logo.dataUrl), leftX, topY, width, height)
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
