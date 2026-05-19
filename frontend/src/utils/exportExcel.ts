import * as XLSX from 'xlsx'

/**
 * Exports data to an Excel (.xlsx) file.
 */
export function exportToExcel<T extends Record<string, any>>(
  data: T[],
  filename: string,
  headers: { key: keyof T; label: string }[]
) {
  if (!data.length) return

  // Transform data to use labels as headers
  const transformed = data.map((row) => {
    const obj: Record<string, any> = {}
    headers.forEach((h) => {
      obj[h.label] = row[h.key]
    })
    return obj
  })

  const worksheet = XLSX.utils.json_to_sheet(transformed)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Employees')

  XLSX.writeFile(workbook, `${filename}.xlsx`)
}
