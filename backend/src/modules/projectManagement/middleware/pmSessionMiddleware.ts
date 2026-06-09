import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../../middleware/authMiddleware';
import { TimesheetModel } from '../../../models/Timesheet';
import { EmployeeAttendanceModel } from '../../../models/EmployeeAttendance';
import { resolveEmployeeForAuthUser } from '../../../utils/employeeAuth';
import { openAttendanceFilter } from '../../../utils/attendanceQueries';
import { PMAssignmentModel } from '../models/PMAssignment';
import mongoose from 'mongoose';

export async function pmSessionMiddleware(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  // Admins bypass all session and project access restrictions
  if (req.user?.role === 'admin') {
    return next();
  }

  if (req.user?.role !== 'employee') {
    res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
    return;
  }

  try {
    const employee = await resolveEmployeeForAuthUser(req.user.id, req.user.email);
    if (!employee) {
      res.status(403).json({ error: 'restricted_workspace', message: 'Employee record not found.' });
      return;
    }

    // 1. Verify Check-In
    const openAttendance = await EmployeeAttendanceModel.findOne(
      openAttendanceFilter({ employeeId: req.user.id })
    ).sort({ checkInTime: -1 });

    if (!openAttendance) {
      res.status(403).json({
        error: 'restricted_workspace',
        message: 'Project Workspace is available only during an active working session. Please Check In and start an active session to continue.'
      });
      return;
    }

    // 2. Verify Running Task Session
    const identityTokens = [
      employee.id,
      employee.firstName + ' ' + (employee.lastName || ''),
      employee.email,
      employee.employeeId
    ].filter(Boolean);

    const activeSession = await TimesheetModel.findOne({
      $and: [
        {
          $or: [
            { employeeId: { $in: identityTokens } },
            { employee: { $in: identityTokens } },
          ],
        },
        {
          $or: [{ logoutTime: { $exists: false } }, { logoutTime: null }]
        }
      ],
      taskStatus: 'In Progress'
    });

    if (!activeSession) {
      res.status(403).json({
        error: 'restricted_workspace',
        message: 'Project Workspace is available only during an active working session. Please Check In and start an active session to continue.'
      });
      return;
    }

    // 3. Project-Specific Assignment Validations
    // Check view specific validation
    const viewId = req.params.id || req.body.viewId || req.query.viewId;
    if (viewId && mongoose.Types.ObjectId.isValid(String(viewId))) {
      const hasAssign = await PMAssignmentModel.exists({
        viewId: new mongoose.Types.ObjectId(String(viewId)),
        employeeId: employee.id,
        isArchived: false
      });
      if (!hasAssign) {
        res.status(403).json({ error: 'Access denied: You are not assigned to this View' });
        return;
      }
    }

    // Check cell specific validation
    const cellId = req.params.cellId || req.body.cellId || req.query.cellId || req.query.cell;
    if (cellId && mongoose.Types.ObjectId.isValid(String(cellId))) {
      const hasAssign = await PMAssignmentModel.exists({
        cellId: new mongoose.Types.ObjectId(String(cellId)),
        employeeId: employee.id,
        isArchived: false
      });
      if (!hasAssign) {
        res.status(403).json({ error: 'Access denied: You are not assigned to this Cell' });
        return;
      }
    }

    // Check library specific validation
    const libraryId = req.params.libraryId || req.body.libraryId || req.query.libraryId;
    if (libraryId && mongoose.Types.ObjectId.isValid(String(libraryId))) {
      const hasAssign = await PMAssignmentModel.exists({
        libraryId: new mongoose.Types.ObjectId(String(libraryId)),
        employeeId: employee.id,
        isArchived: false
      });
      if (!hasAssign) {
        res.status(403).json({ error: 'Access denied: You are not assigned to this Library' });
        return;
      }
    }

    next();
  } catch (error) {
    console.error('PM Session verification error:', error);
    res.status(500).json({ error: 'Internal server error verifying working session' });
  }
}
