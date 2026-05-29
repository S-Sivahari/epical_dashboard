# Frontend Timesheet Auto-Retry & Task Management Analysis

## Executive Summary

**✗ NO auto-retry logic found for `startTask` or `resumeActiveTask` after page refresh**  
**✗ NO automatic call to `startTask` on page load if active task exists**  
**⚠ Limited error handling - only has fallback refresh mechanisms, not retries**

---

## 1. Auto-Retry Logic Search Results

### Finding: **NO Retry Logic Found**

**API Layer** - [frontend/src/services/api.ts](frontend/src/services/api.ts)
- Axios interceptors handle errors (401/403/409/5xx)
- **No retry mechanism** - errors are logged and rejected
- Only automatic action: clears auth token on 401

```typescript
// Lines 33-67: Error interceptor
api.interceptors.response.use(
  (res) => res,
  (err: { response?: { status?: number; data?: { error?: string } }; ... }) => {
    const status = err.response?.status
    // ... handles 401, 403, 409, 5xx but NO retry
    return Promise.reject(err)
  },
)
```

**Service Layer** - [frontend/src/services/employeeTimesheetService.js](frontend/src/services/employeeTimesheetService.js)
- Plain axios calls with no retry decorators
- Each function makes a single attempt

```javascript
// Lines 43-46: startTask - single attempt, no retry
export async function startTask(assignedTaskId, description) {
  const res = await api.post('/timesheets/mine/start-task', { assignedTaskId, description })
  return res.data
}

// Lines 58-61: resumeActiveTask - single attempt, no retry
export async function resumeActiveTask(timesheetId) {
  const res = await api.patch('/timesheets/mine/resume-task', { timesheetId })
  return res.data
}
```

**Store Layer** - [frontend/src/store/employee/timesheetStore.js](frontend/src/store/employee/timesheetStore.js)
- Simple error handling with fallback refreshes, not retries
- On error in `startTask`, calls `refreshActiveTask()` and `refreshAssignedTasks()`

```javascript
// Lines 276-293: startTask with error fallback pattern
startTask: async ({ assignedTaskId, description }) => {
  const data = await apiStartTask(assignedTaskId, description)
  if (data?.timesheet) {
    // ... success path
  } else {
    // FALLBACK: Refresh instead of retry
    await get().refreshActiveTask()
    await get().refreshAssignedTasks()
  }
  return data
},
```

---

## 2. Automatic startTask on Page Load

### Finding: **NO Automatic startTask Triggered**

**Hydration Logic** - [frontend/src/store/employee/timesheetStore.js](frontend/src/store/employee/timesheetStore.js)
- Lines 127-168: `hydrate()` function fetches current state from server
- Restores `activeTask` if it exists on server, but **does NOT restart it**

```javascript
// Lines 127-168: Hydrate function (called on Timesheet component mount)
hydrate: async () => {
  if (get().initialized) return
  set({ loading: true })
  try {
    const data = await fetchTimesheetBootstrap()
    
    const serverTimeSkew = data.serverTime ? new Date(data.serverTime).getTime() - Date.now() : 0
    const activeRes = { active: data.active, pausedTasks: data.pausedTasks ?? [] }
    const checkInTime = data.attendance?.checkInTime ? new Date(data.attendance.checkInTime) : null
    
    // Maps active task from API response
    const activeTask = mapActiveTaskFromApi(activeRes)
    const pausedTasks = activeRes.pausedTasks.map(mapTaskEntryFromApi).filter(Boolean)

    set({
      serverTimeSkew,
      checkedIn: data.attendance?.checkedIn ?? false,
      checkInTime,
      attendance: data.attendance ?? null,
      activeTask,        // ← Restored from server, NOT re-triggered
      pausedTasks,       // ← Restored from server
      assignedTasks: data.assignedTasks ?? [],
      sessions: (data.sessions ?? []).map(mapSessionFromApi),
      attendanceHistory: Array.isArray(data.attendanceHistory) ? data.attendanceHistory : [],
      initialized: true,
      sessionStatus: data.attendance?.sessionStatus ?? null,
      autoCheckoutInfo: { ... },
      autoCheckoutSettings: null,
      sessionsLoading: false,
    })
  } catch (err) {
    console.error('Failed to load timesheet state', err)
    set({ initialized: true, sessionsLoading: false })
  } finally {
    set({ loading: false })
  }
},
```

**Page Mount** - [frontend/src/pages/employee/Timesheet.jsx](frontend/src/pages/employee/Timesheet.jsx)
- Lines 176-177: Calls `hydrate()` on component mount, nothing more

```javascript
// Lines 176-177: Only hydrate is called on mount
useEffect(() => {
  hydrate()
}, [hydrate])
```

---

## 3. Error Handling & Retry Mechanisms

### Finding: **Error Handling Exists But No Retries**

The error handling pattern uses **fallback refreshes**, not retries:

**Pattern in All Task Actions** - [frontend/src/store/employee/timesheetStore.js](frontend/src/store/employee/timesheetStore.js)

```javascript
// Lines 276-293: startTask with fallback
startTask: async ({ assignedTaskId, description }) => {
  const data = await apiStartTask(assignedTaskId, description)
  if (data?.timesheet) {
    // SUCCESS: Update state directly
    const activeTask = mapTaskEntryFromApi({
      timesheet: data.timesheet,
      assignedTask: data.assignedTask,
    })
    set((state) => {
      const nextAssigned = state.assignedTasks.map((t) =>
        t.id === data.assignedTask?.id ? data.assignedTask : t
      )
      return {
        activeTask,
        assignedTasks: nextAssigned,
      }
    })
  } else {
    // FALLBACK: Refresh data instead of retry
    await get().refreshActiveTask()
    await get().refreshAssignedTasks()
  }
  return data
},

// Lines 308-330: stopTask with same pattern
stopTask: async (timesheetId) => {
  const data = await apiStopActiveTask(timesheetId)
  if (data?.timesheet) {
    // SUCCESS: Update state
    const mappedSession = mapSessionFromApi(data.timesheet)
    const nextSessions = [mappedSession, ...state.sessions.filter((s) => s.id !== mappedSession.id)]
    return { activeTask: null, sessions: nextSessions }
  } else {
    // FALLBACK: Refresh instead of retry
    await get().refreshActiveTask()
    await get().refreshSessions()
    await get().refreshAssignedTasks()
  }
  return data
},

// Lines 331-353: pauseTask - same pattern
// Lines 354-376: resumeTask - same pattern  
// Lines 377-399: completeTask - same pattern
```

### Multiple Calls That Trigger on Page Refocus (Not Retry)

**Lines 188-197**: Window focus listener triggers data refreshes (not task restart)

```javascript
// Lines 188-197: When user returns to page tab
useEffect(() => {
  const onFocus = () => {
    const { refreshAssignedTasks, refreshSessions, refreshActiveTask } = useTimesheetStore.getState()
    void refreshAssignedTasks()      // ← Refresh assigned tasks
    void refreshSessions()            // ← Refresh sessions  
    void refreshActiveTask()          // ← Refresh active task (NOT restart)
  }
  window.addEventListener('focus', onFocus)
  return () => window.removeEventListener('focus', onFocus)
}, [])
```

**Lines 198-210**: Polling when awaiting approval

```javascript
// Lines 198-210: Refresh every 30 seconds if awaiting approval
useEffect(() => {
  if (!initialized || !hasAwaitingApproval) return undefined
  const refresh = () => {
    const { refreshAssignedTasks, refreshSessions, refreshActiveTask } = useTimesheetStore.getState()
    void refreshAssignedTasks()
    void refreshSessions()
    void refreshActiveTask()
  }
  const id = setInterval(refresh, 30000)
  return () => clearInterval(id)
}, [initialized, hasAwaitingApproval])
```

**Lines 211-219**: Sync attendance every 30 seconds when checked in

```javascript
// Lines 211-219: Periodically sync attendance
useEffect(() => {
  if (!initialized || !checkedIn) return undefined
  const sync = () => {
    void useTimesheetStore.getState().syncAttendanceWithBackend()
  }
  const id = setInterval(sync, 30000)
  return () => clearInterval(id)
}, [initialized, checkedIn])
```

---

## 4. Complete Timesheet Service API Implementation

### [frontend/src/services/employeeTimesheetService.js](frontend/src/services/employeeTimesheetService.js)

All APIs - Lines 1-82:

```javascript
import api from '@services/api'

// ✓ BOOTSTRAP: Fetch all current state on page load
export async function fetchTimesheetBootstrap() {
  const res = await api.get('/timesheets/mine/bootstrap')
  return res.data
}

// ✓ FETCH: Assigned tasks for dropdown
export async function fetchMyAssignedTasks() {
  const res = await api.get('/timesheets/mine/assigned-tasks')
  return res.data
}

// ✓ FETCH: Current attendance record
export async function fetchMyAttendance() {
  const res = await api.get('/timesheets/mine/attendance')
  return res.data
}

// ✓ FETCH: Historical attendance records for date range
export async function fetchMyAttendanceHistory({ from, to } = {}) {
  const res = await api.get('/timesheets/mine/attendance-history', { params: { from, to } })
  return res.data
}

// ✓ FETCH: Current active task details
export async function fetchMyActiveTask() {
  const res = await api.get('/timesheets/mine/active')
  return res.data
}

// ✓ FETCH: Session logs for date range
export async function fetchMySessions({ from, to } = {}) {
  const res = await api.get('/timesheets/mine/sessions', { params: { from, to } })
  return res.data
}

// ✓ ACTION: Check in (start attendance)
export async function checkIn() {
  const res = await api.post('/timesheets/mine/check-in')
  return res.data
}

// ✓ ACTION: Check out (end attendance & all tasks)
export async function checkOut() {
  const res = await api.post('/timesheets/mine/check-out')
  return res.data
}

// ✓ ACTION: Start a task (create timesheet log)
export async function startTask(assignedTaskId, description) {
  const res = await api.post('/timesheets/mine/start-task', { assignedTaskId, description })
  return res.data
}

// ✓ ACTION: Stop the active task
export async function stopActiveTask(timesheetId) {
  const res = await api.patch('/timesheets/mine/stop-task', { timesheetId })
  return res.data
}

// ✓ ACTION: Pause the active task
export async function pauseActiveTask(timesheetId) {
  const res = await api.patch('/timesheets/mine/pause-task', { timesheetId })
  return res.data
}

// ✓ ACTION: Resume a paused task
export async function resumeActiveTask(timesheetId) {
  const res = await api.patch('/timesheets/mine/resume-task', { timesheetId })
  return res.data
}

// ✓ ACTION: Complete the active task with work description
export async function completeActiveTask(timesheetId, description) {
  const res = await api.patch('/timesheets/mine/complete-task', { timesheetId, description })
  return res.data
}

// ✓ FETCH: Session auto-checkout settings
export async function fetchSessionStatus() {
  const res = await api.get('/timesheets/mine/session-status')
  return res.data
}

// ✓ FETCH: Auto-checkout configuration
export async function fetchAutoCheckoutSettings() {
  const res = await api.get('/timesheets/auto-checkout-settings')
  return res.data
}

// ✓ ACTION: Update auto-checkout settings
export async function updateAutoCheckoutSettings(data) {
  const res = await api.put('/timesheets/auto-checkout-settings', data)
  return res.data
}
```

---

## 5. Key Store Actions Flow

### [frontend/src/store/employee/timesheetStore.js](frontend/src/store/employee/timesheetStore.js)

**Refresh Methods** (Data fetching without state change):
- `refreshAttendanceHistory()` - Lines 100-109
- `refreshSessionsForRange()` - Lines 112-126
- `refreshSessions()` - Lines 202-204
- `refreshAssignedTasks()` - Lines 206-213
- `refreshActiveTask()` - Lines 215-228
- `refreshSessionStatus()` - Lines 447-453

**Action Methods** (API calls that modify state):
- `hydrate()` - Lines 127-168 (Initial load)
- `syncAttendanceWithBackend()` - Lines 170-200 (Sync without action)
- `checkIn()` - Lines 230-261 (Start attendance)
- `checkOut()` - Lines 263-275 (End attendance)
- **`startTask()`** - Lines 276-293 ← **KEY: No auto-retry**
- `stopTask()` - Lines 308-330
- `pauseTask()` - Lines 331-353
- `resumeTask()` - Lines 354-376
- `completeTask()` - Lines 377-399

---

## 6. Timesheet Page Initialization

### [frontend/src/pages/employee/Timesheet.jsx](frontend/src/pages/employee/Timesheet.jsx)

**Component Mount** - Lines 141-177:
```javascript
export default function Timesheet() {
  const {
    checkedIn,
    checkInTime,
    attendance,
    activeTask,
    pausedTasks,
    assignedTasks,
    sessions,
    loading,
    initialized,
    hydrate,           // ← Pulled from store
    checkIn,
    checkOut,
    startTask,
    pauseTask,
    resumeTask,
    completeTask,
    attendanceHistory,
    serverTimeSkew,
    sessionsLoading,
  } = useTimesheetStore()
  
  // ... state setup ...

  // ← ONLY action on mount
  useEffect(() => {
    hydrate()
  }, [hydrate])
```

**User Action: Check In + Start Task** - Lines 287-318:
```javascript
const onCheckIn = async () => {
  const valid = await trigger()
  if (!valid) return

  try {
    setSubmitting(true)
    setCheckoutReview(false)
    setCheckoutError('')
    
    // Step 1: Check in
    await checkIn()
    
    // Step 2: Start task (may fail independently)
    try {
      await startTask({
        assignedTaskId: selectedTaskId,
        description: workDescription.trim(),
      })
    } catch (startErr) {
      // Rollback: If task start fails, undo check-in
      try {
        await checkOut()
      } catch {
        /* revert attendance if start failed */
      }
      throw startErr  // ← Throw to show error to user
    }
    
    toast({
      title: 'Checked in',
      description: `Timer started for ${selectedTask?.projectName || selectedTask?.title || 'your project'}.`,
    })
  } catch (err) {
    toast({
      title: 'Check in failed',
      description: err.response?.data?.error || 'Please try again.',
      variant: 'destructive',
    })
  } finally {
    setSubmitting(false)
  }
}
```

---

## Conclusions

### ✗ No Auto-Retry System
- Single attempt for all API calls
- No exponential backoff or retry delays
- Fallback to data refresh instead of retry

### ✗ No Automatic Task Restart
- Active tasks are **restored from server state**, not re-triggered
- User must manually start tasks each time
- Bootstrap endpoint fetches current state but doesn't replay actions

### ✓ Error Handling Exists
- Try-catch blocks on all actions
- Graceful degradation with "refresh as fallback"
- User notifications on failure (toast messages)

### ✓ Periodic Syncing (Not Retry)
- Window focus: refreshes all data
- Every 30s when awaiting approval: refreshes data
- Every 30s when checked in: syncs attendance for auto-checkout detection

### Implications
If `startTask` fails:
1. Error is caught and shown to user
2. Assigned tasks and active task are refreshed
3. User must click "Check In" again to retry manually
4. No automatic retries occur
