import api from '@services/api'

export async function fetchTimesheetBootstrap() {
  const res = await api.get('/timesheets/mine/bootstrap')
  return res.data
}

export async function fetchMyAssignedTasks() {
  const res = await api.get('/timesheets/mine/assigned-tasks')
  return res.data
}

export async function fetchMyAttendance() {
  const res = await api.get('/timesheets/mine/attendance')
  return res.data
}

export async function fetchMyAttendanceHistory({ from, to } = {}) {
  const res = await api.get('/timesheets/mine/attendance-history', { params: { from, to } })
  return res.data
}

export async function fetchMyActiveTask() {
  const res = await api.get('/timesheets/mine/active')
  return res.data
}

export async function fetchMySessions({ from, to } = {}) {
  const res = await api.get('/timesheets/mine/sessions', { params: { from, to } })
  return res.data
}

export async function fetchMyProjectWiseHours({ from, to } = {}) {
  const res = await api.get('/timesheets/mine/project-wise-hours', { params: { from, to } })
  return res.data
}

export async function checkIn() {
  const res = await api.post('/timesheets/mine/check-in')
  return res.data
}

export async function checkOut() {
  const res = await api.post('/timesheets/mine/check-out')
  return res.data
}

export async function startTask(assignedTaskId, description, cellId) {
  const res = await api.post('/timesheets/mine/start-task', {
    assignedTaskId,
    description,
    ...(cellId ? { cellId } : {}),
  })
  return res.data
}

export async function fetchStartableCells(assignedTaskId) {
  const res = await api.get('/timesheets/mine/startable-cells', {
    params: { assignedTaskId },
  })
  return res.data
}

export async function startCellWork(projectId, cellId) {
  const res = await api.post('/timesheets/mine/start-cell-work', { projectId, cellId })
  return res.data
}

export async function stopActiveTask(timesheetId) {
  const res = await api.patch('/timesheets/mine/stop-task', { timesheetId })
  return res.data
}

export async function pauseActiveTask(timesheetId) {
  const res = await api.patch('/timesheets/mine/pause-task', { timesheetId })
  return res.data
}

export async function resumeActiveTask(timesheetId) {
  const res = await api.patch('/timesheets/mine/resume-task', { timesheetId })
  return res.data
}

export async function startBreak(breakType) {
  const res = await api.post('/timesheets/mine/start-break', { breakType })
  return res.data
}

export async function endBreak() {
  const res = await api.post('/timesheets/mine/end-break')
  return res.data
}

export async function completeActiveTask(timesheetId, description) {
  const res = await api.patch('/timesheets/mine/complete-task', { timesheetId, description })
  return res.data
}

export async function fetchSessionStatus() {
  const res = await api.get('/timesheets/mine/session-status')
  return res.data
}

export async function fetchCurrentElapsed() {
  const res = await api.get('/timesheets/mine/current-elapsed')
  return res.data
}

export async function fetchAutoCheckoutSettings() {
  const res = await api.get('/timesheets/auto-checkout-settings')
  return res.data
}

export async function updateAutoCheckoutSettings(data) {
  const res = await api.put('/timesheets/auto-checkout-settings', data)
  return res.data
}
