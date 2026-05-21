// Example: Call Payslip API from Frontend (React)

import axios from 'axios'

const API_BASE = 'http://localhost:3000/api'

// ============================================================================
// Generate Single Payslip
// ============================================================================
export async function generateSinglePayslip(excelPath: string, empId: string) {
  try {
    const response = await axios.post(`${API_BASE}/payslips/generate`, {
      excelPath, // Full path to master Excel file
      empId, // Employee ID (e.g., "E-1001")
      outputDir: 'D:/payslips', // Optional: where to save
    })

    console.log('✓ Payslip generated:', response.data)
    return response.data
  } catch (error: any) {
    console.error('✗ Error:', error.response?.data || error.message)
    throw error
  }
}

// ============================================================================
// Generate All Payslips
// ============================================================================
export async function generateAllPayslips(excelPath: string) {
  try {
    const response = await axios.post(`${API_BASE}/payslips/generate-all`, {
      excelPath, // Full path to master Excel file
      outputDir: 'D:/payslips', // Optional: where to save
    })

    console.log('✓ Payslips generated:', response.data)
    console.log(`Generated: ${response.data.totalGenerated}, Failed: ${response.data.totalFailed}`)

    // List results
    response.data.results.forEach((r: any) => {
      console.log(`  ${r.empId} (${r.name}): ${r.status}`)
    })

    return response.data
  } catch (error: any) {
    console.error('✗ Error:', error.response?.data || error.message)
    throw error
  }
}

// ============================================================================
// React Component Example
// ============================================================================
export function PayslipGenerator() {
  const [empId, setEmpId] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [result, setResult] = React.useState<any>(null)

  const handleGenerateSingle = async () => {
    setLoading(true)
    try {
      const excelPath = 'D:/EPICAL LAYOUTS/project_code/payslip_master.xlsx' // Update path
      const data = await generateSinglePayslip(excelPath, empId)
      setResult(data)
      toast.success(`Payslip generated: ${data.fileName}`)
    } catch (error) {
      toast.error('Failed to generate payslip')
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateAll = async () => {
    setLoading(true)
    try {
      const excelPath = 'D:/EPICAL LAYOUTS/project_code/payslip_master.xlsx' // Update path
      const data = await generateAllPayslips(excelPath)
      setResult(data)
      toast.success(`Generated ${data.totalGenerated} payslips`)
    } catch (error) {
      toast.error('Failed to generate payslips')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-4">Generate Payslips</h1>

      {/* Single Payslip */}
      <div className="mb-6 p-4 border rounded-lg">
        <h2 className="text-xl font-bold mb-3">Generate Single Payslip</h2>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Enter Employee ID (e.g., E-1001)"
            value={empId}
            onChange={(e) => setEmpId(e.target.value)}
            className="px-3 py-2 border rounded flex-1"
          />
          <button
            onClick={handleGenerateSingle}
            disabled={loading || !empId}
            className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
          >
            {loading ? 'Generating...' : 'Generate'}
          </button>
        </div>
      </div>

      {/* Batch Generation */}
      <div className="mb-6 p-4 border rounded-lg">
        <h2 className="text-xl font-bold mb-3">Generate All Payslips</h2>
        <button
          onClick={handleGenerateAll}
          disabled={loading}
          className="px-4 py-2 bg-green-500 text-white rounded disabled:opacity-50"
        >
          {loading ? 'Generating...' : 'Generate All'}
        </button>
      </div>

      {/* Results */}
      {result && (
        <div className="p-4 border rounded-lg bg-blue-50">
          <h3 className="font-bold mb-2">Result:</h3>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  )
}
