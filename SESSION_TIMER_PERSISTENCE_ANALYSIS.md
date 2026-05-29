# Session Timer Persistence Analysis & Fix Guide

**Status**: 🔴 CRITICAL - Backend persistence is broken after device shutdown/auto-checkout

## Executive Summary

The employee session timer is **NOT truly backend-persistent**. When a device closes/auto-checkout runs, the session gets marked as "Pending" and becomes invisible to the UI. On re-login, the timer either:
- Shows nothing (session hidden)
- Or shows stale 5-minute value (cached from before shutdown)
- Never recovers the full elapsed duration from MongoDB timestamps

**Root cause**: Auto-checkout job changes `taskStatus` to 'Pending', which blocks `fetchActiveTaskPayload()` from retrieving the session via the `taskStatus` filter.

---

## Issues Found

### Issue #1: Auto-Checkout Breaks Session Discovery 🔴 CRITICAL

**Problem**:
When auto-checkout job runs (after 12+ hours idle):
```typescript
// autoCheckoutService.ts:189
if (['In Progress', 'Paused', 'Session Incomplete'].includes(log.taskStatus || '')) {
  log.taskStatus = 'Pending';  // ← Status changed!
}
```

But `fetchActiveTaskPayload()` only finds sessions with specific statuses:
```typescript
// employeeTimesheetController.ts:212
taskStatus: { $in: ['In Progress', 'Paused', 'Session Incomplete'] }
// 'Pending' is NOT in this list!
```

**Impact**:
- After auto-checkout, session becomes "lost" on re-login
- `activeTask = null` in frontend
- `checkedIn = false` (if EmployeeAttendance.checkOutTime is set)
- CheckInTimerComponent never renders
- Employee cannot see session history during active device session

---

### Issue #2: Multiple Timesheet Records Not Deduplicated ⚠️ HIGH

**Problem**:
If multiple Timesheets exist for the same employee on the same day:
```typescript
// employeeTimesheetController.ts:214
.sort({ loginTime: -1 })  // ← Sorts by LATEST loginTime

const runningLog = openLogs.find(
  (log) => log.taskStatus === 'In Progress' || log.taskStatus === 'Session Incomplete',
);
```

If employee somehow triggers `startTask()` twice (or via retry):
- **Scenario**: 10:00 AM task starts → 10:05 AM device off → 3:00 PM re-opens → UI somehow creates new task
- Result: Two Timesheets: [10:00 AM, 3:00 PM]
- Query picks latest: 3:00 PM timesheet
- Timer shows wrong elapsed duration

---

### Issue #3: Frontend Timer Becomes Stale After Auto-Checkout ⚠️ HIGH

**Problem**:
Frontend timer uses:
```javascript
// Timesheet.jsx:62
const end = pausedAt ? new Date(pausedAt).getTime() : Date.now() + serverTimeSkew
const ms = Math.max(0, end - new Date(startedAt).getTime() - totalPausedMs)
```

This always uses **current time** (`Date.now()`), assuming task is running.

But backend already set `logoutTime` during auto-checkout:
- Backend knows: elapsed = logoutTime - loginTime - totalPausedMs ✓
- Frontend calculates: elapsed = now - loginTime (assumes still running) ✗
- **Result**: Frontend displays stale value, unaware of backend's end-time

Polling interval (30 seconds) doesn't refresh active task status:
```javascript
// Timesheet.jsx:222
const sync = () => {
  void useTimesheetStore.getState().syncAttendanceWithBackend()
}
const id = setInterval(sync, 30000)  // ← Doesn't call refreshActiveTask!
```

---

### Issue #4: Missing Backend Endpoint for Elapsed Duration Calculation 🔴 CRITICAL

**Problem**:
No dedicated endpoint returns the "elapsed duration at backend time". Frontend must calculate it, but:
- Cannot account for backend's logoutTime (only knows via activeTask.startedAt)
- Cannot validate totalPausedMs if session was resumed server-side
- Timer becomes unreliable after auto-checkout

**Current Flow** ❌:
```
Client clicks "Check In" → Timesheet created with loginTime:now
Client starts task → Timesheet.loginTime = now (point in time frozen)
Device closes → No update sent
5-12 hours later → Auto-checkout runs (backend knows full duration)
Employee reopens → Frontend doesn't know about logoutTime
Frontend timer = Date.now() - Timesheet.loginTime (wrong!)
```

**Expected Flow** ✓:
```
Client clicks "Check In" → Session created with checkInTime
Client starts task → Task starts tracking time
Device closes → No update (session keeps going server-side)
Any time → Endpoint returns: elapsed = backend.now - checkInTime - totalPausedMs
Employee reopens → Frontend uses backend's elapsed duration
```

---

## Production-Grade Fix

### Fix #1: Add Backend Endpoint for Elapsed Duration (NEW)

**Endpoint**: `GET /timesheets/mine/current-elapsed`

**Implementation**:

```typescript
// employeeTimesheetController.ts

getCurrentElapsed: async (req: Request, res: Response): Promise<void> => {
  try {
    const employee = await resolveEmployee(req);
    if (!employee) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const openAttendance = await EmployeeAttendanceModel.findOne({
      employeeId: employee.id,
      checkOutTime: { $exists: false },
    }).sort({ checkInTime: -1 }).lean();

    if (!openAttendance) {
      res.json({ hasActiveSession: false, elapsedMs: 0, serverTime: new Date().toISOString() });
      return;
    }

    const now = new Date();
    const checkInTime = new Date(openAttendance.checkInTime);
    const elapsedMs = now.getTime() - checkInTime.getTime();

    // Calculate total paused duration across all tasks in this session
    const sessionTasks = await TimesheetModel.find({
      employeeId: employee.employeeId,
      loginTime: { $gte: checkInTime },
      logoutTime: { $exists: false },
    }).lean();

    let totalPausedMs = sessionTasks.reduce((sum, task) => sum + (task.totalPausedMs || 0), 0);

    // If any task is currently paused, add pause duration
    const pausedTask = sessionTasks.find(t => t.taskStatus === 'Paused' && t.pausedAt);
    if (pausedTask) {
      totalPausedMs += now.getTime() - new Date(pausedTask.pausedAt).getTime();
    }

    res.json({
      hasActiveSession: true,
      checkInTime: openAttendance.checkInTime.toISOString(),
      elapsedMs: Math.max(0, elapsedMs - totalPausedMs),
      totalPausedMs,
      sessionStatus: openAttendance.sessionStatus,
      serverTime: now.toISOString(),
    });
  } catch (error) {
    console.error('Error fetching current elapsed:', error);
    res.status(500).json({ error: 'Failed to fetch elapsed duration' });
  }
},
```

### Fix #2: Preserve Active Task After Auto-Checkout (MODIFY)

**File**: `autoCheckoutService.ts`

Change auto-checkout to keep task queryable:

```typescript
// BEFORE: Changes taskStatus to 'Pending' (blocks discovery)
// AFTER: Mark with special flag instead

if (['In Progress', 'Paused', 'Session Incomplete'].includes(log.taskStatus || '')) {
  // Keep taskStatus 'Session Incomplete' to allow discovery
  log.taskStatus = 'Session Incomplete';
  log.autoCompleted = true;  // NEW: Mark as auto-completed
}
```

This allows `fetchActiveTaskPayload()` to find auto-completed sessions and mark them read-only.

### Fix #3: Update Frontend to Use Backend Elapsed Duration

**File**: `timesheetStore.js`

Add new store method:

```javascript
getElapsedFromBackend: async () => {
  try {
    const data = await api.get('/timesheets/mine/current-elapsed');
    if (data.hasActiveSession) {
      return {
        elapsedMs: data.elapsedMs,
        totalPausedMs: data.totalPausedMs,
        checkInTime: new Date(data.checkInTime),
        sessionStatus: data.sessionStatus,
        serverTime: new Date(data.serverTime),
      };
    }
    return null;
  } catch (err) {
    console.error('Failed to get elapsed duration from backend', err);
    return null;
  }
},
```

Update bootstrap to use elapsed:

```javascript
hydrate: async () => {
  try {
    const data = await fetchTimesheetBootstrap();
    
    // NEW: Also get backend's calculated elapsed duration
    const elapsedData = await get().getElapsedFromBackend();
    
    const serverTimeSkew = data.serverTime ? new Date(data.serverTime).getTime() - Date.now() : 0;
    
    set({
      // ... existing fields
      backendElapsedMs: elapsedData?.elapsedMs ?? 0,
      backendTotalPausedMs: elapsedData?.totalPausedMs ?? 0,
      hasBackendElapsedData: !!elapsedData,
    });
  } catch (err) {
    console.error('Failed to load timesheet state', err);
  }
},
```

### Fix #4: Smart Timer Component Using Backend Data

**File**: `Timesheet.jsx`

```javascript
function CheckInTimerComponent({ 
  checkInTime, 
  activeTask, 
  pausedTasks, 
  serverTimeSkew,
  backendElapsedMs,  // NEW
  hasBackendElapsedData,  // NEW
}) {
  const [elapsed, setElapsed] = useState('00:00:00');

  useEffect(() => {
    const tick = () => {
      let elapsedMs;

      if (hasBackendElapsedData && backendElapsedMs !== undefined) {
        // Use backend-provided elapsed duration as baseline
        const timeSinceBootstrap = Date.now() - (bootstrapTime || Date.now());
        elapsedMs = backendElapsedMs + timeSinceBootstrap;
      } else {
        // Fallback: calculate from checkInTime (existing logic)
        let pausedMs = 0;
        const now = Date.now() + (serverTimeSkew || 0);
        
        if (activeTask) {
          pausedMs += activeTask.totalPausedMs || 0;
        } else if (pausedTasks?.[0]) {
          pausedMs += pausedTasks[0].totalPausedMs || 0;
          if (pausedTasks[0].pausedAt) {
            pausedMs += Math.max(0, now - new Date(pausedTasks[0].pausedAt).getTime());
          }
        }

        elapsedMs = Math.max(0, now - checkInTime.getTime() - pausedMs);
      }

      const totalSeconds = Math.floor(elapsedMs / 1000);
      const h = Math.floor(totalSeconds / 3600);
      const m = Math.floor((totalSeconds % 3600) / 60);
      const s = totalSeconds % 60;
      
      setElapsed(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [checkInTime, activeTask, pausedTasks, serverTimeSkew, backendElapsedMs, hasBackendElapsedData]);

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-center">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">
        {hasBackendElapsedData ? 'Timer (Backend Verified)' : 'Timer'}
      </p>
      <p className="mt-1 font-mono text-3xl font-bold tabular-nums text-primary">{elapsed}</p>
    </div>
  );
}
```

### Fix #5: Prevent Duplicate Timesheets

**File**: `employeeTimesheetController.ts`, `startTask` method

```typescript
startTask: async (req: Request, res: Response): Promise<void> => {
  try {
    const employee = await resolveEmployee(req);
    if (!employee) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Check for ANY open timesheet for this employee (not just assigned task)
    const existingOpen = await TimesheetModel.findOne({
      employeeId: employee.employeeId,
      $or: [{ logoutTime: { $exists: false } }, { logoutTime: null }],
      taskStatus: { $in: ['In Progress', 'Paused', 'Session Incomplete'] },
    }).sort({ updatedAt: -1 });

    if (existingOpen) {
      res.status(400).json({
        error: 'You already have an active task. Please complete or pause it first.',
        existingTask: {
          project: existingOpen.project,
          startedAt: existingOpen.loginTime,
          taskStatus: existingOpen.taskStatus,
        },
      });
      return;
    }

    // ... rest of startTask logic
  } catch (error) {
    // ...
  }
},
```

---

## Implementation Priority

### Phase 1: Critical Fixes (Do First)
1. **Fix #1**: Add `getCurrentElapsed` endpoint
2. **Fix #5**: Prevent duplicate Timesheets
3. **Fix #2**: Preserve task visibility with 'Session Incomplete' status

### Phase 2: Frontend Improvements  
1. **Fix #3**: Store backend elapsed data
2. **Fix #4**: Update timer component to use backend data

### Phase 3: Validation
- Test device shutdown → 5 hours → re-open → timer shows 5 hours
- Test auto-checkout → re-open next day → shows completed session with full hours
- Test multiple check-in/check-out cycles → no duplicate timesheets

---

## Verification Checklist

After implementation:

- [ ] Timer persists correctly after device shutdown (no 5-min reset)
- [ ] Auto-checkout sessions remain discoverable on re-login
- [ ] Backend timestamp is source of truth for elapsed duration
- [ ] No duplicate Timesheet records created
- [ ] Frontend timer component uses backend elapsed data when available
- [ ] Existing timesheet/project sync logic unaffected
- [ ] Employee can see auto-checked-out sessions in history
- [ ] Pause/resume logic maintains accuracy across device closures

---

## Files to Modify

```
backend/src/controllers/employeeTimesheetController.ts
  - Add getCurrentElapsed() endpoint
  - Update startTask() to prevent duplicates
  - Update routes

backend/src/services/autoCheckoutService.ts
  - Change taskStatus handling (keep 'Session Incomplete')

frontend/src/store/employee/timesheetStore.js
  - Add getElapsedFromBackend()
  - Update hydrate() to fetch backend elapsed
  - Update syncAttendanceWithBackend()

frontend/src/pages/employee/Timesheet.jsx
  - Pass backendElapsedMs to CheckInTimerComponent
  - Update formatDuration() logic
  - Update main timer useEffect

backend/src/routes/timesheetRoutes.ts
  - Add route for GET /mine/current-elapsed
```

