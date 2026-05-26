export const EXPORT_LOGO_PATH = '/pic/logos.png'
export const PDF_LOGO_MAX_WIDTH = 100
export const EXCEL_LOGO_MAX_WIDTH = 140

export interface ExportLogoAsset {
  dataUrl: string
  buffer: ArrayBuffer
  width: number
  height: number
}

export function scaleExportLogo(width: number, height: number, maxWidth: number) {
  const w = Math.min(maxWidth, width)
  const ratio = height / width
  return { width: w, height: w * ratio }
}

export async function fetchExportLogo(): Promise<ExportLogoAsset | null> {
  try {
    const res = await fetch(EXPORT_LOGO_PATH)
    if (!res.ok) return null
    const buffer = await res.arrayBuffer()
    const blob = new Blob([buffer], { type: 'image/png' })
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
    const dims = await new Promise<{ width: number; height: number }>((resolve) => {
      const img = new Image()
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
      img.onerror = () => resolve({ width: 200, height: 60 })
      img.src = dataUrl
    })
    return { dataUrl, buffer, ...dims }
  } catch {
    return null
  }
}

export function drawPdfLogo(
  doc: { addImage: (imageData: string, format: string, x: number, y: number, w: number, h: number) => void },
  logo: ExportLogoAsset,
  pageWidth: number,
  topY = 12,
): number {
  const { width, height } = scaleExportLogo(logo.width, logo.height, PDF_LOGO_MAX_WIDTH)
  const x = (pageWidth - width) / 2
  doc.addImage(logo.dataUrl, 'PNG', x, topY, width, height)
  return topY + height + 12
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
