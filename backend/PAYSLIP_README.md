# Payslip Generator - Node.js Port

This is the Node.js replacement for the Python payslip generator (`payslip_app.py`).

## What Changed?

### Before (Python):
- Used `openpyxl` to read Excel files
- Used `python-docx` to generate Word documents
- Required PyInstaller to create .exe launcher
- Separate desktop application

### After (Node.js):
- Uses `xlsx` npm package to read Excel files
- Uses `docx` npm package to generate Word documents
- Integrated directly into backend API
- No external dependencies besides npm packages

## Setup

### 1. Install Dependencies
Dependencies are already installed. If needed, run:

```bash
npm install xlsx docx pdf-lib pdfkit
```

### 2. Prepare Your Master Excel File

Your Excel file should have these sheets:
- **Company** - Company information (name, address, CIN, GSTIN, etc.)
- **Salary Structure** - Default salary components
- **Employees** - Employee data

## API Endpoints

### Generate Payslip for Single Employee

```bash
POST /api/payslips/generate
Content-Type: application/json

{
  "excelPath": "D:/path/to/master.xlsx",
  "empId": "E-1001",
  "outputDir": "D:/path/to/output"  // optional
}
```

**Response:**
```json
{
  "message": "Payslip generated successfully",
  "empId": "E-1001",
  "name": "John Doe",
  "filePath": "D:/path/to/output/Payslip_E-1001_1716345600000.docx",
  "fileName": "Payslip_E-1001_1716345600000.docx"
}
```

### Generate Payslips for All Employees

```bash
POST /api/payslips/generate-all
Content-Type: application/json

{
  "excelPath": "D:/path/to/master.xlsx",
  "outputDir": "D:/path/to/output"  // optional, defaults to ./payslips
}
```

**Response:**
```json
{
  "message": "Payslips generated successfully",
  "outputDir": "D:/path/to/output",
  "totalGenerated": 25,
  "totalFailed": 0,
  "results": [
    {
      "empId": "E-1001",
      "name": "John Doe",
      "status": "success",
      "fileName": "Payslip_E-1001_1716345600000.docx",
      "filePath": "D:/path/to/output/Payslip_E-1001_1716345600000.docx"
    }
  ]
}
```

## File Structure

```
backend/
├── src/
│   ├── services/
│   │   └── payslipGenerator.ts      ← Core payslip logic
│   ├── controllers/
│   │   └── payslipController.ts     ← API handlers
│   ├── routes/
│   │   └── payslipRoutes.ts         ← Endpoints
│   └── server.ts                     ← Routes registered here
```

## Key Functions

### `readMasterExcel(filePath)`
Reads company info, salary structure, and employee data from Excel.

```typescript
const { company, structure, employees } = readMasterExcel('path/to/file.xlsx')
```

### `buildPayslip(company, structure, emp)`
Generates a Word document for a single employee.

```typescript
const doc = buildPayslip(company, salaryStructure, employeeData)
await savePayslipAsDocx(doc, 'output.docx')
```

### `savePayslipAsDocx(doc, path)`
Saves the generated document to a .docx file.

## Customization

### Theme Colors

Edit `COLORS` object in `payslipGenerator.ts`:

```typescript
const COLORS = {
  PRIMARY: '0E5E4E',        // Dark green
  PRIMARY_DK: '0A4136',     // Darker green
  PRIMARY_LT: 'C9E4DC',     // Light green
  HEADER_TXT: 'FFFFFF',     // White
  BORDER: 'B7C9BC',         // Grey-green
  ROW_ALT: 'F4F9F6',        // Very light green
  LABEL_BG: 'EAF3EE',       // Pale green
  TEXT: '1F2937',           // Near-black
  MUTED: '6B7280',          // Grey
}
```

### Earnings & Deductions Mapping

In `buildEarningsData()` and `buildDeductionsData()`:

```typescript
const empToStruct = {
  'Basic Salary': 'Basic Salary',
  'HRA': 'House Rent Allowance',
  // Add your mappings here
}
```

## Testing

### Using cURL

```bash
# Generate single payslip
curl -X POST http://localhost:3000/api/payslips/generate \
  -H "Content-Type: application/json" \
  -d '{
    "excelPath": "D:/EPICAL LAYOUTS/project_code/payslip_data.xlsx",
    "empId": "E-1001"
  }'

# Generate all payslips
curl -X POST http://localhost:3000/api/payslips/generate-all \
  -H "Content-Type: application/json" \
  -d '{
    "excelPath": "D:/EPICAL LAYOUTS/project_code/payslip_data.xlsx"
  }'
```

### Using Postman

1. Create a new POST request
2. URL: `http://localhost:3000/api/payslips/generate`
3. Body (JSON):
   ```json
   {
     "excelPath": "D:/EPICAL LAYOUTS/project_code/payslip_data.xlsx",
     "empId": "E-1001"
   }
   ```
4. Send

## Migration from Python

### Old Python Way:
```bash
python payslip_app.py
# GUI appears → Select Excel file → Generate
```

### New Node.js Way:
```bash
# 1. Backend is already running
npm run dev

# 2. Call API endpoint
curl -X POST http://localhost:3000/api/payslips/generate \
  -H "Content-Type: application/json" \
  -d '{"excelPath": "path/to/file.xlsx", "empId": "E-1001"}'

# 3. Files are generated and returned in response
```

## Features

✅ **No Python dependency** - Pure Node.js  
✅ **REST API integration** - Call from frontend or external tools  
✅ **Batch generation** - Generate all payslips at once  
✅ **Styled output** - Matches original Python design  
✅ **Error handling** - Returns meaningful error messages  
✅ **Configurable output** - Specify custom output directory  

## Future Enhancements

- [ ] PDF export (convert .docx to .pdf)
- [ ] Email payslips directly
- [ ] Support for multiple salary templates
- [ ] Payslip history tracking
- [ ] Bulk upload & generation

## Troubleshooting

**Error: Excel file not found**
- Make sure the path is absolute and correct
- Use forward slashes: `D:/folder/file.xlsx` not `D:\folder\file.xlsx`

**Error: Employee not found**
- Verify the empId matches exactly (case-sensitive)
- Check the Excel file has employees in the "Employees" sheet

**Error: No employees found in Excel**
- Ensure the Excel file has a sheet named "Employees"
- Check that employees have values in the "Emp ID" column

## Support

If you encounter issues:
1. Check backend logs: `npm run dev` output
2. Verify Excel file format matches template
3. Check file paths are absolute and accessible
4. Review TypeScript types in `payslipGenerator.ts`
