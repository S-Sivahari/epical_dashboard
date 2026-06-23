import { useState, useEffect, useMemo } from 'react'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import { SelectField } from '@components/forms/SelectField'
import { DataTable, type Column } from '@components/tables/DataTable'
import { useEmployeeStore } from '@store/employeeStore'
import { filterPublicEmployees } from '@/utils/employeeView'

interface Row {
  id: string
  employeeId: string
  employeeName: string
  days: number
}

export function CompensationLeaves() {
  const { employees, fetchEmployees } = useEmployeeStore()
  const publicEmployees = useMemo(() => filterPublicEmployees(employees), [employees])
  const [rows, setRows] = useState<Row[]>([])
  const [employeeId, setEmployeeId] = useState('')
  const [days, setDays] = useState(1)

  useEffect(() => {
    fetchEmployees()
  }, [fetchEmployees])

  useEffect(() => {
    if (publicEmployees.length > 0 && !employeeId) {
      setEmployeeId(publicEmployees[0].id)
    }
  }, [publicEmployees, employeeId])

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
          options={publicEmployees.map((e) => ({
            value: e.id,
            label: `${e.firstName} ${e.lastName || ''} (${e.id})`,
          }))}
          value={employeeId}
          onChange={(e) => setEmployeeId(e.target.value)}
        />
        <Input label="Number of leaves" type="number" min={1} value={days} onChange={(e) => setDays(Number(e.target.value))} />
        <Button
          onClick={() => {
            const emp = publicEmployees.find((e) => e.id === employeeId)
            if (!emp) return
            setRows((r) => [
              {
                id: `C-${r.length + 1}`,
                employeeId: emp.id,
                employeeName: `${emp.firstName} ${emp.lastName || ''}`.trim(),
                days,
              },
              ...r,
            ])
}}
        >
          Add
        </Button>
      </div>
      <DataTable columns={columns} data={rows} />
    </div>
  )
}
