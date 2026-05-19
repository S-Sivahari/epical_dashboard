import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

export function exportAnalyticsPdf(filename: string) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt' })
  doc.setFontSize(16)
  doc.text('Analytics Report', 40, 60)
  doc.setFontSize(10)
  doc.text(`Generated: ${new Date().toLocaleString()}`, 40, 80)
  doc.save(filename)
}

export function exportToPDF<T extends Record<string, unknown>>(
  data: T[],
  filename: string,
  headers: { key: keyof T; label: string }[],
) {
  if (!data.length) return

  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt' })
  const head = [headers.map((h) => h.label)]
  const body = data.map((row) =>
    headers.map((h) => {
      const value = row[h.key]
      return value === null || value === undefined ? '' : String(value)
    }),
  )

  autoTable(doc, {
    head,
    body,
    startY: 50,
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [16, 185, 129] },
  })

  doc.save(`${filename}.pdf`)
}
