import { useState } from 'react'
import { Download, FileText, Loader } from 'lucide-react'
import { Breadcrumb } from '@components/layout/Breadcrumb'
import { PageHeader } from '@components/layout/PageHeader'
import { PageWrapper } from '@components/layout/PageWrapper'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import { DataTable, type Column } from '@components/tables/DataTable'
import { useEmployees } from '@hooks/useEmployees'
import { Avatar } from '@components/ui/Avatar'
import { stringToHueColor } from '@/utils/stringColor'
import api from '@services/api'
import { toast } from 'sonner'
import type { Employee } from '@/types'

interface PayslipRecord {
  id: string
  employeeId: string
  employeeName: string
  department: string
  designation: string
  lastGenerated?: string
}

export function PayslipManagement() {
  const { employees, loading } = useEmployees()
  const [generatingId, setGeneratingId] = useState<string | null>(null)
  const [excelPath, setExcelPath] = useState('')
  const [generatingAll, setGeneratingAll] = useState(false)

  const payslipRecords: PayslipRecord[] = employees.map((emp) => ({
    id: emp.id,
    employeeId: emp.employeeId,
    employeeName: `${emp.firstName} ${emp.lastName}`,
    department: emp.department,
    designation: emp.designation,
  }))

  const handleGenerateSingle = async (employee: Employee) => {
    if (!excelPath.trim()) {
      toast.error('Please provide the Excel file path')
      return
    }

    setGeneratingId(employee.id)
    try {
      const response = await api.post('/api/payslips/generate', {
        excelPath,
        empId: employee.employeeId,
      })

      if (response.data.fileName) {
        toast.success(
          `Payslip generated for ${employee.firstName}: ${response.data.fileName}`,
        )
      }
    } catch (error: any) {
      toast.error(
        error.response?.data?.error || 'Failed to generate payslip',
      )
    } finally {
      setGeneratingId(null)
    }
  }

  const handleGenerateAll = async () => {
    if (!excelPath.trim()) {
      toast.error('Please provide the Excel file path')
      return
    }

    setGeneratingAll(true)
    try {
      const response = await api.post('/api/payslips/generate-all', {
        excelPath,
      })

      toast.success(
        `${response.data.totalGenerated} payslips generated successfully`,
      )
    } catch (error: any) {
      toast.error(
        error.response?.data?.error || 'Failed to generate payslips',
      )
    } finally {
      setGeneratingAll(false)
    }
  }

  const columns: Column<PayslipRecord>[] = [
    {
      key: 'employeeName',
      header: 'Employee',
      render: (r) => (
        <div className="flex items-center gap-2">
          <Avatar name={r.employeeName} size="sm" color={stringToHueColor(r.employeeId)} />
          <span>{r.employeeName}</span>
        </div>
      ),
    },
    { key: 'employeeId', header: 'Employee ID' },
    { key: 'department', header: 'Department' },
    { key: 'designation', header: 'Designation' },
    {
      key: 'id',
      header: 'Action',
      render: (r) => {
        const emp = employees.find((e) => e.id === r.id)
        return (
          <Button
            size="sm"
            variant="secondary"
            disabled={generatingId === r.id || !excelPath.trim()}
            onClick={() => emp && handleGenerateSingle(emp)}
          >
            {generatingId === r.id ? (
              <Loader className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Generate
          </Button>
        )
      },
    },
  ]

  return (
    <PageWrapper>
      <PageHeader
        title="Payslip Management"
        subtitle="Generate and manage employee payslips."
        breadcrumb={<Breadcrumb items={[{ label: 'Payslips' }]} />}
      />

      <div className="mb-6 space-y-4 rounded-lg border border-border bg-surface/50 p-4">
        <div>
          <label htmlFor="excel-path" className="block text-sm font-medium text-ink mb-2">
            Master Excel File Path
          </label>
          <Input
            id="excel-path"
            placeholder="e.g., C:\data\payroll_master.xlsx"
            value={excelPath}
            onChange={(e) => setExcelPath(e.target.value)}
            className="w-full"
          />
          <p className="mt-2 text-xs text-muted">
            Provide the full path to the Excel file containing employee payroll data.
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={handleGenerateAll}
            disabled={generatingAll || !excelPath.trim() || loading}
          >
            {generatingAll ? (
              <Loader className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
            Generate All Payslips
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-white shadow-sm">
        <DataTable
          columns={columns}
          data={payslipRecords}
          loading={loading}
        />
      </div>
    </PageWrapper>
  )
}
