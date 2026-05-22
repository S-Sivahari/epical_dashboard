import api from '@services/api'

export async function fetchMyAssignedTasks() {
  const res = await api.get('/timesheets/mine/assigned-tasks')
  return res.data
}

export async function fetchMyAttendance() {
  const res = await api.get('/timesheets/mine/attendance')
  return res.data
}

export async function fetchMyActiveTask() {
  const res = await api.get('/timesheets/mine/active')
  return res.data
}

export async function fetchMySessions() {
  const res = await api.get('/timesheets/mine/sessions')
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

export async function startTask(assignedTaskId, description) {
  const res = await api.post('/timesheets/mine/start-task', { assignedTaskId, description })
  return res.data
}

export async function stopActiveTask() {
  const res = await api.patch('/timesheets/mine/stop-task')
  return res.data
}

export async function pauseActiveTask() {
  const res = await api.patch('/timesheets/mine/pause-task')
  return res.data
}

export async function resumeActiveTask() {
  const res = await api.patch('/timesheets/mine/resume-task')
  return res.data
}

export async function completeActiveTask() {
  const res = await api.patch('/timesheets/mine/complete-task')
  return res.data
}
