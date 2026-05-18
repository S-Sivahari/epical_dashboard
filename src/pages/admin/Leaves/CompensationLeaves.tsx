import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import { SelectField } from '@components/forms/SelectField'
import { DataTable, type Column } from '@components/tables/DataTable'
import { MOCK_EMPLOYEES } from '@services/mockData'

interface Row {
  id: string
  employeeId: string
  employeeName: string
  days: number
}

export function CompensationLeaves() {
  const [rows, setRows] = useState<Row[]>([
    { id: 'C-1', employeeId: 'E-1001', employeeName: 'Asha Menon', days: 2 },
  ])
  const [employeeId, setEmployeeId] = useState(MOCK_EMPLOYEES[0]?.id ?? '')
  const [days, setDays] = useState(1)

  const columns: Column<Row>[] = [
    { key: 'employeeId', header: 'Employee ID' },
    { key: 'employeeName', header: 'Name' },
    { key: 'days', header: 'Days' },
  ]

  return (
    <div className="space-y-6">
      <div className="grid gap-3 rounded-xl border border-border bg-surface/60 p-4 md:grid-cols-3 md:items-end">
        <SelectField
          label="Employee"
          id="comp-employee"
          options={MOCK_EMPLOYEES.map((e) => ({
            value: e.id,
            label: `${e.firstName} ${e.lastName} (${e.id})`,
          }))}
          value={employeeId}
          onChange={(e) => setEmployeeId(e.target.value)}
        />
        <Input label="Number of leaves" type="number" min={1} value={days} onChange={(e) => setDays(Number(e.target.value))} />
        <Button
          onClick={() => {
            const emp = MOCK_EMPLOYEES.find((e) => e.id === employeeId)
            if (!emp) return
            setRows((r) => [
              {
                id: `C-${r.length + 1}`,
                employeeId: emp.id,
                employeeName: `${emp.firstName} ${emp.lastName}`,
                days,
              },
              ...r,
            ])
            toast.success('Compensation leave added')
          }}
        >
          Add
        </Button>
      </div>
      <DataTable columns={columns} data={rows} />
    </div>
  )
}
