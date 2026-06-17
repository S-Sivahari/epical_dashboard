import { getDB } from '../config/db';

export function employeeFullName(employee: {
  firstName?: string;
  middleName?: string;
  lastName?: string;
} | null | undefined): string {
  return [employee?.firstName, employee?.middleName, employee?.lastName].filter(Boolean).join(' ').trim();
}

export async function resolveCellAssignee(
  assignedEmployeeId?: string | null,
  fallbackName?: string,
): Promise<{ assignedEmployeeId?: string; assignedEmployeeName?: string }> {
  const requestedId = String(assignedEmployeeId ?? '').trim();
  if (!requestedId) {
    return { assignedEmployeeId: undefined, assignedEmployeeName: undefined };
  }

  const db = getDB();
  const employee = await db.collection('employees').findOne(
    {
      $or: [
        { id: requestedId },
        { employeeId: requestedId },
        { employeeId: requestedId.toUpperCase() },
      ],
    },
    { projection: { id: 1, employeeId: 1, firstName: 1, middleName: 1, lastName: 1 } },
  );

  if (!employee) {
    return {
      assignedEmployeeId: requestedId,
      assignedEmployeeName: fallbackName?.trim() || '',
    };
  }

  return {
    assignedEmployeeId: String(employee.employeeId || employee.id || requestedId).trim(),
    assignedEmployeeName: employeeFullName(employee) || fallbackName?.trim() || '',
  };
}

export async function enrichAssigneeNames<T extends { assignedEmployeeId?: string; assignedEmployeeName?: string }>(
  cells: T[],
): Promise<T[]> {
  const ids = [...new Set(cells.map((cell) => cell.assignedEmployeeId?.trim()).filter(Boolean))] as string[];
  if (!ids.length) return cells;

  const db = getDB();
  const employees = await db.collection('employees').find(
    {
      $or: [
        { id: { $in: ids } },
        { employeeId: { $in: ids } },
        { employeeId: { $in: ids.map((id) => id.toUpperCase()) } },
      ],
    },
    { projection: { id: 1, employeeId: 1, firstName: 1, middleName: 1, lastName: 1 } },
  ).toArray();

  const nameByToken = new Map<string, string>();
  for (const employee of employees) {
    const name = employeeFullName(employee as Parameters<typeof employeeFullName>[0]);
    if (!name) continue;
    if (employee.id) nameByToken.set(String(employee.id), name);
    if (employee.employeeId) {
      const employeeId = String(employee.employeeId);
      nameByToken.set(employeeId, name);
      nameByToken.set(employeeId.toUpperCase(), name);
    }
  }

  return cells.map((cell) => {
    const id = cell.assignedEmployeeId?.trim();
    if (!id) return cell;
    const freshName = nameByToken.get(id);
    return freshName ? { ...cell, assignedEmployeeName: freshName } : cell;
  });
}
