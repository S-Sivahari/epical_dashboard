import { Request, Response } from 'express';
import { getDB } from '../config/db';
import { randomUUID } from 'crypto';
import { CompensationEntry } from '../models/Compensation';

function getCol() {
  return getDB().collection<CompensationEntry>('compensation_entries');
}

export async function list(_req: Request, res: Response): Promise<void> {
  try {
    const entries = await getCol().find({}).sort({ createdAt: -1 }).toArray();
    res.json(entries);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch compensation entries' });
  }
}

export async function create(req: Request, res: Response): Promise<void> {
  try {
    // Accepts an array of entries (multiple employees at once)
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
    const docs: CompensationEntry[] = entries.map((e) => ({
      id: randomUUID(),
      employeeId: e.employeeId,
      employeeName: e.employeeName,
      days: Number(e.days),
      reason: e.reason || '',
      appliedDate: now.toISOString().split('T')[0],
      createdBy,
      status: 'Active',
      createdAt: now,
      updatedAt: now,
    }));

    await getCol().insertMany(docs as any[]);
    res.status(201).json(docs);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to create compensation entries' });
  }
}

export async function update(req: Request, res: Response): Promise<void> {
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
      { id },
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

export async function cancel(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { cancelReason } = req.body;
    const cancelledBy = (req as any).user?.name || 'Admin';

    const result = await getCol().findOneAndUpdate(
      { id, status: 'Active' },
      {
        $set: {
          status: 'Cancelled',
          cancelledAt: new Date().toISOString(),
          cancelledBy,
          cancelReason: cancelReason || '',
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' },
    );

    if (!result) {
      res.status(404).json({ error: 'Entry not found or already cancelled' });
      return;
    }
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to cancel compensation entry' });
  }
}

export async function remove(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const result = await getCol().deleteOne({ id });
    if (result.deletedCount === 0) {
      res.status(404).json({ error: 'Entry not found' });
      return;
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to delete compensation entry' });
  }
}
