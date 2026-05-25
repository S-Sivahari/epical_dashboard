import { Holiday } from '../models/Holiday';
import { LeaveRequest } from '../models/Leave';

export const LEAVE_ALLOCATIONS = {
  'Casual Leave': 12,
  'Sick Leave': 12,
};

// Calculates total business days excluding weekends and provided holidays
export function getBusinessDays(from: string, to: string, holidays: Holiday[]): number {
  const start = new Date(from);
  const end = new Date(to);
  let count = 0;
  
  const holidayStrings = holidays.map(h => h.date);
  
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay();
    const dateString = d.toISOString().split('T')[0];
    
    // 0 is Sunday, 6 is Saturday
    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidayStrings.includes(dateString)) {
      count++;
    }
  }
  
  return count;
}

/**
 * Dynamically calculates Earned Leave based on the current date.
 * If joinedAt is provided, accrual starts the month after the employee joined
 * so mid-year joiners don't receive unearned months.
 */
export function calculateEarnedLeaveAllocation(joinedAt?: string): number {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed (Jan = 0)
  const currentDate = now.getDate();

  // Determine from which month accrual begins (0-indexed)
  let accrualStartMonth = 0;

  if (joinedAt) {
    const joinDate = new Date(joinedAt);
    const joinYear = joinDate.getFullYear();
    // Accrual only starts for joiners in the current year or earlier
    if (joinYear === currentYear) {
      // First credit arrives on the 1st of the month AFTER joining
      accrualStartMonth = joinDate.getMonth() + 1;
    } else if (joinYear > currentYear) {
      // Joined in the future — no allocation yet
      return 0;
    }
    // joinYear < currentYear → full year allocation applies (accrualStartMonth stays 0)
  }

  // Count months that have fully passed since accrualStartMonth
  const monthsAccrued = Math.max(0, currentMonth - accrualStartMonth);
  let accrued = monthsAccrued * 0.5;

  // In December (month 11), the final 0.5 is credited on the 1st of January (next year),
  // but we add it on Dec 20th as an approximation if the employee started by Dec.
  if (currentMonth === 11 && currentDate >= 20 && accrualStartMonth <= 11) {
    accrued += 0.5;
  }

  return accrued;
}

export function calculateBalances(employeeLeaves: LeaveRequest[], joinedAt?: string) {
  const earnedAlloc = calculateEarnedLeaveAllocation(joinedAt);
  
  const balances: Record<string, { total: number; used: number; remaining: number }> = {
    'Casual Leave': { total: LEAVE_ALLOCATIONS['Casual Leave'], used: 0, remaining: LEAVE_ALLOCATIONS['Casual Leave'] },
    'Sick Leave': { total: LEAVE_ALLOCATIONS['Sick Leave'], used: 0, remaining: LEAVE_ALLOCATIONS['Sick Leave'] },
    'Earned Leave': { total: earnedAlloc, used: 0, remaining: earnedAlloc },
  };

  const currentYear = new Date().getFullYear();

  employeeLeaves.forEach(leave => {
    // Only count leaves taken in the current year
    if (!leave.from.startsWith(`${currentYear}`)) return;
    
    // Only Approved leaves deduct from remaining (Pending leaves don't affect balance)
    if (leave.status === 'Approved') {
      if (balances[leave.type]) {
        balances[leave.type].used += leave.days;
        balances[leave.type].remaining -= leave.days;
      } else {
        // If an unknown leave type was applied, track it negatively
        balances[leave.type] = { total: 0, used: leave.days, remaining: -leave.days };
      }
    }
  });

  return balances;
}
