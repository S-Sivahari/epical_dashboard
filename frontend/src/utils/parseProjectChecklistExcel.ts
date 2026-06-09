import ExcelJS from 'exceljs'

export interface ProjectChecklistExcelRow {
  cellName: string
  library: string
  cellType: string
  checklistName: string
  itemName: string
  itemOrder: number | string
  response: string
  comment: string
}

function excelCellText(value: ExcelJS.CellValue): string {
  if (value == null) return ''
  if (typeof value === 'object' && 'richText' in value) {
    return (value as ExcelJS.CellRichTextValue).richText.map((part) => part.text).join('').trim()
  }
  if (typeof value === 'object' && 'result' in value) {
    const result = (value as ExcelJS.CellFormulaValue).result
    return result == null ? '' : String(result).trim()
  }
  if (typeof value === 'object' && 'text' in value) {
    return String((value as { text: string }).text).trim()
  }
  return String(value).trim()
}

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/\s+/g, '')
}

function findHeaderRow(sheet: ExcelJS.Worksheet): number {
  let headerRowNumber = 0
  sheet.eachRow((row, rowNumber) => {
    if (headerRowNumber > 0) return
    const normalized: string[] = []
    row.eachCell({ includeEmpty: false }, (cell) => {
      normalized.push(normalizeKey(excelCellText(cell.value)))
    })
    if (normalized.includes('cellname') && normalized.includes('itemname')) {
      headerRowNumber = rowNumber
    }
  })
  return headerRowNumber
}

function isValidDataRow(cellName: string): boolean {
  const trimmed = cellName.trim()
  if (!trimmed || trimmed === '—' || /^-+$/.test(trimmed)) return false
  if (/confidential|system generated report|generated on/i.test(trimmed)) return false
  return true
}

export async function parseProjectChecklistExcel(file: File): Promise<ProjectChecklistExcelRow[]> {
  const buffer = await file.arrayBuffer()
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)

  const sheet = workbook.worksheets[0]
  if (!sheet) throw new Error('Worksheet not found in Excel file')

  const headerRowNumber = findHeaderRow(sheet)
  if (!headerRowNumber) {
    throw new Error(
      'Could not find header row. Expected columns: Cell Name, Item Name, Response, Comment',
    )
  }

  const headerRow = sheet.getRow(headerRowNumber)
  const headers: string[] = []
  headerRow.eachCell((cell, col) => {
    headers[col - 1] = excelCellText(cell.value)
  })

  const columnIndex = (...candidates: string[]): number => {
    for (let i = 0; i < headers.length; i += 1) {
      const headerNorm = normalizeKey(headers[i] ?? '')
      if (!headerNorm) continue
      for (const candidate of candidates) {
        if (headerNorm === normalizeKey(candidate)) return i
      }
    }
    return -1
  }

  const getVal = (row: ExcelJS.Row, ...candidates: string[]): string => {
    const idx = columnIndex(...candidates)
    if (idx < 0) return ''
    return excelCellText(row.getCell(idx + 1).value)
  }

  const rows: ProjectChecklistExcelRow[] = []
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRowNumber) return

    const cellName = getVal(row, 'Cell Name', 'cellName')
    if (!isValidDataRow(cellName)) return

    const itemName = getVal(row, 'Item Name', 'itemName')
    if (!itemName || itemName === '—') return

    rows.push({
      cellName,
      library: getVal(row, 'Library', 'library'),
      cellType: getVal(row, 'Cell Type', 'cellType'),
      checklistName: getVal(row, 'Checklist Name', 'checklistName'),
      itemName,
      itemOrder: getVal(row, 'Item Order', 'itemOrder'),
      response: getVal(row, 'Response', 'response'),
      comment: getVal(row, 'Comment', 'comment'),
    })
  })

  if (!rows.length) {
    throw new Error('No valid checklist rows found in file')
  }

  return rows
}
