import { Response } from 'express';
import { getDB } from '../config/db';
import { randomUUID } from 'crypto';
import { CompensationEntry } from '../models/Compensation';
import { AuthRequest } from '../middleware/authMiddleware';
import { isAdminRole, isEmployeeRole } from '../utils/generateToken';
import * as leaveService from '../services/leaveService';

function getCol() {
  return getDB().collection<CompensationEntry>('compensation_entries');
}

async function resolveCanonicalEmployeeId(rawEmployeeId: string): Promise<string> {
  const trimmed = String(rawEmployeeId ?? '').trim();
  if (!trimmed) return trimmed;

  const employeeCol = getDB().collection('employees');
  const findOptions = { projection: { documents: 0, 'photo.data': 0 } };
  const ids = await leaveService.resolveLeaveEmployeeIds(trimmed);
  const emp =
    (await employeeCol.findOne({ id: { $in: ids } }, findOptions)) ||
    (await employeeCol.findOne({ employeeId: { $in: ids } }, findOptions));

  return emp?.id ? String(emp.id) : trimmed;
}

async function resolveEmployeeIds(userId: string): Promise<string[]> {
  const employeeCol = getDB().collection('employees');
  const findOptions = { projection: { documents: 0, 'photo.data': 0 } };
  const emp =
    (await employeeCol.findOne({ id: userId }, findOptions)) ||
    (await employeeCol.findOne({ employeeId: userId.trim().toUpperCase() }, findOptions));

  const ids = new Set<string>([userId]);
  if (emp?.id) ids.add(String(emp.id));
  if (emp?.employeeId) ids.add(String(emp.employeeId));
  return Array.from(ids);
}

export async function list(req: AuthRequest, res: Response): Promise<void> {
  try {
    const query: Record<string, unknown> = { status: 'Active' };

    if (isEmployeeRole(req.user?.role ?? '')) {
      if (!req.user?.id) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const employeeIds = await resolveEmployeeIds(req.user.id);
      query.employeeId = { $in: employeeIds };
    } else if (!isAdminRole(req.user?.role ?? '')) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const entries = await getCol().find(query).sort({ createdAt: -1 }).toArray();
    res.json(entries);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch compensation entries' });
  }
}

export async function create(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { entries } = req.body as { entries: Array<{
      employeeId: string;
      employeeName: string;
      days: number;
      reason: string;
    }> };

    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      res.status(400).json({ error: 'entries array is required' });
      return;
    }

    const createdBy = (req as any).user?.name || 'Admin';

    for (const e of entries) {
      if (!e.employeeId || !e.employeeName) {
        res.status(400).json({ error: 'employeeId and employeeName are required for each entry' });
        return;
      }
      const days = Number(e.days);
      if (isNaN(days) || days <= 0 || days % 0.5 !== 0) {
        res.status(400).json({ error: `Days must be a positive multiple of 0.5 (got ${e.days})` });
        return;
      }
    }

    const now = new Date();
    const docs: CompensationEntry[] = [];
    for (const e of entries) {
      const canonicalEmployeeId = await resolveCanonicalEmployeeId(e.employeeId);
      docs.push({
        id: randomUUID(),
        employeeId: canonicalEmployeeId,
        employeeName: e.employeeName,
        days: Number(e.days),
        reason: e.reason || '',
        appliedDate: now.toISOString().split('T')[0],
        createdBy,
        status: 'Active',
        createdAt: now,
        updatedAt: now,
      });
    }

    await getCol().insertMany(docs as any[]);
    res.status(201).json(docs);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to create compensation entries' });
  }
}

export async function update(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { days, reason } = req.body;

    if (days !== undefined) {
      const d = Number(days);
      if (isNaN(d) || d <= 0 || d % 0.5 !== 0) {
        res.status(400).json({ error: 'Days must be a positive multiple of 0.5' });
        return;
      }
    }

    const updates: Partial<CompensationEntry> = { updatedAt: new Date() };
    if (days !== undefined) updates.days = Number(days);
    if (reason !== undefined) updates.reason = reason;

    const result = await getCol().findOneAndUpdate(
      { id, status: 'Active' },
      { $set: updates },
      { returnDocument: 'after' },
    );

    if (!result) {
      res.status(404).json({ error: 'Entry not found' });
      return;
    }
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update compensation entry' });
  }
}

export async function remove(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const entry = await getCol().findOne({ id });
    if (!entry) {
      res.status(404).json({ error: 'Entry not found' });
      return;
    }

    // Check if the employee has already used Earned Leave
    const balances = await leaveService.getLeaveBalances(entry.employeeId);
    const compensationLeave = balances['Compensation Leave'] || { total: 0, used: 0, remaining: 0 };

    if (compensationLeave.used > 0) {
      // "admin delete does nothing" - return success: true but skip deletion, and output a skipped message
      res.json({ success: true, message: 'Delete did nothing because the employee has already used the compensation leave.', skipped: true });
      return;
    }

    const result = await getCol().deleteOne({ id });
    if (result.deletedCount === 0) {
      res.status(404).json({ error: 'Entry not found' });
      return;
    }
    res.json({ success: true, message: 'Compensation entry deleted successfully.', deleted: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to delete compensation entry' });
  }
}
