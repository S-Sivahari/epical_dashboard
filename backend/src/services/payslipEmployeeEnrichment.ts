import type { Employee } from './payslipGenerator'
import { findEmployeeByPayrollEmpId } from './employeePayslipService'

/**
 * Enrich payroll employee data from database
 * Looks up employee by Emp ID and adds database fields like name, designation, etc.
 */
export async function enrichPayrollEmployeeFromDb(emp: Employee): Promise<Employee> {
  const empId = String(emp['Emp ID'] || '').trim()
  
  if (!empId) {
    return emp
  }

  try {
    const dbEmployee = await findEmployeeByPayrollEmpId(empId)
    
    if (dbEmployee) {
      // Enrich with database fields
      return {
        ...emp,
        Name: dbEmployee.name || emp.Name,
        Designation: dbEmployee.designation || emp.Designation,
        Department: dbEmployee.department || emp.Department,
        // Add any other fields you want to enrich from database
      }
    }
  } catch (error) {
    console.warn(`Failed to enrich employee ${empId} from database:`, error)
  }

  return emp
}
