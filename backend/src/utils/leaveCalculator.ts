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

// Dynamically calculates Earned Leave based on the current date
export function calculateEarnedLeaveAllocation(): number {
  const now = new Date();
  const currentMonth = now.getMonth(); // 0-indexed (Jan = 0)
  const currentDate = now.getDate();
  
  // 0.5 per month passed. So in March (month index 2), Jan (0) and Feb (1) have passed -> 2 * 0.5 = 1.0
  let accrued = currentMonth * 0.5;
  
  // In December (month 11), the final 0.5 is added on the 20th
  if (currentMonth === 11 && currentDate >= 20) {
    accrued += 0.5;
  }
  
  return accrued;
}

export function calculateBalances(employeeLeaves: LeaveRequest[]) {
  const earnedAlloc = calculateEarnedLeaveAllocation();
  
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
