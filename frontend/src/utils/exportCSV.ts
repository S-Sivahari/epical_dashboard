/**
 * Exports data to a CSV file and triggers a browser download.
 */
export function exportToCSV<T extends Record<string, any>>(
  data: T[],
  filename: string,
  headers: { key: keyof T; label: string }[]
) {
  if (!data.length) return

  const csvRows: string[] = []

  // Add Headers
  csvRows.push(headers.map((h) => `"${String(h.label)}"`).join(','))

  // Add Data
  for (const row of data) {
    const values = headers.map((h) => {
      const val = row[h.key]
      const escaped = String(val ?? '').replace(/"/g, '""')
      return `"${escaped}"`
    })
    csvRows.push(values.join(','))
  }

  const csvContent = csvRows.join('\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', `${filename}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
