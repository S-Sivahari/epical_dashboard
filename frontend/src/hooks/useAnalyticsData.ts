import { useCallback, useEffect, useState } from 'react'
import type { Employee } from '@/types'
import { useEmployeeStore } from '@store/employeeStore'
import {
  fetchActiveEmployees,
  fetchAnalyticsData,
  type AnalyticsPeriodPreset,
  type AnalyticsMetrics,
  type ComparisonSummary,
  type CourseSlice,
  type EmployeePerformanceRow,
  type IndividualPerformance,
  type TrainingAnalytics,
  type WeekdayHours,
} from '@/services/analyticsService'

const EMPTY_METRICS: AnalyticsMetrics = {
  totalHours: 0,
  completedCourses: 0,
  avgHoursPerWeek: 0,
}

const EMPTY_WEEKLY: WeekdayHours[] = [
  { name: 'Mon', hours: 0 },
  { name: 'Tue', hours: 0 },
  { name: 'Wed', hours: 0 },
  { name: 'Thu', hours: 0 },
  { name: 'Fri', hours: 0 },
  { name: 'Sat', hours: 0 },
  { name: 'Sun', hours: 0 },
]

const EMPTY_COURSES: CourseSlice[] = [
  { name: 'Done', value: 0 },
  { name: 'In progress', value: 0 },
  { name: 'Not started', value: 100 },
]

const EMPTY_TRAINING: TrainingAnalytics = {
  courses: [],
  summary: {
    totalCourses: 0,
    totalEnrollments: 0,
    totalCompleted: 0,
    totalInProgress: 0,
    totalNotStarted: 0,
    topPerformingCourse: null,
    overallSlice: EMPTY_COURSES,
  },
}

const EMPTY_COMPARISON_SUMMARY: ComparisonSummary = {
  totalEmployees: 0,
  totalHours: 0,
  avgHoursPerEmployee: 0,
  highestPerformer: null,
  lowestPerformer: null,
}

export function useAnalyticsData(
  selectedEmployeeId: string | 'all',
  preset: AnalyticsPeriodPreset,
  year: number,
  month: number,
) {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [employeesLoading, setEmployeesLoading] = useState(true)
  const [dataLoading, setDataLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [weekly, setWeekly] = useState<WeekdayHours[]>(EMPTY_WEEKLY)
  const [courses, setCourses] = useState<CourseSlice[]>(EMPTY_COURSES)
  const [trainingAnalytics, setTrainingAnalytics] = useState<TrainingAnalytics>(EMPTY_TRAINING)
  const [metrics, setMetrics] = useState<AnalyticsMetrics>(EMPTY_METRICS)
  const [comparison, setComparison] = useState<EmployeePerformanceRow[]>([])
  const [comparisonSummary, setComparisonSummary] = useState<ComparisonSummary>(EMPTY_COMPARISON_SUMMARY)
  const [individualPerformance, setIndividualPerformance] = useState<IndividualPerformance | null>(null)
  const employeesRevision = useEmployeeStore((s) => s.employeesRevision)

  useEffect(() => {
    let cancelled = false
    async function loadEmployees() {
      try {
        setEmployeesLoading(true)
        const rows = await fetchActiveEmployees()
        if (!cancelled) setEmployees(rows)
      } catch (err) {
        console.error('[Analytics] Failed to load employees:', err)
        if (!cancelled) setError('Failed to load employees')
      } finally {
        if (!cancelled) setEmployeesLoading(false)
      }
    }
    void loadEmployees()
    return () => {
      cancelled = true
    }
  }, [employeesRevision])

  const refresh = useCallback(async () => {
    if (employeesLoading) return
    try {
      setDataLoading(true)
      setError(null)
      const result = await fetchAnalyticsData({
        preset,
        year,
        month,
        selectedEmployeeId,
        employees,
      })
      setWeekly(result.weekly)
      setCourses(result.courses)
      setTrainingAnalytics(result.trainingAnalytics)
      setMetrics(result.metrics)
      setComparison(result.comparison)
      setComparisonSummary(result.comparisonSummary)
      setIndividualPerformance(result.individualPerformance)
    } catch (err) {
      console.error('[Analytics] Failed to load analytics:', err)
      setError('Failed to load analytics data')
      setWeekly(EMPTY_WEEKLY)
      setCourses(EMPTY_COURSES)
      setTrainingAnalytics(EMPTY_TRAINING)
      setMetrics(EMPTY_METRICS)
      setComparison([])
      setComparisonSummary(EMPTY_COMPARISON_SUMMARY)
      setIndividualPerformance(null)
    } finally {
      setDataLoading(false)
    }
  }, [employees, employeesLoading, month, preset, selectedEmployeeId, year])

  useEffect(() => {
    if (employeesLoading) return
    void refresh()
  }, [refresh, employeesLoading])

  const hasData =
    metrics.totalHours > 0 ||
    metrics.completedCourses > 0 ||
    weekly.some((d) => d.hours > 0) ||
    courses.some((c) => c.value > 0 && c.name !== 'Not started') ||
    comparison.some((row) => row.totalHours > 0) ||
    trainingAnalytics.summary.totalEnrollments > 0

  return {
    employees,
    employeesLoading,
    dataLoading,
    error,
    weekly,
    courses,
    trainingAnalytics,
    metrics,
    comparison,
    comparisonSummary,
    individualPerformance,
    hasData,
    refresh,
  }
}
