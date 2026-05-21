# Leave Management Module - Restructuring Documentation

## Overview
The Leave Management module has been restructured into 3 separate pages/tabs under the same Leave Management section for better organization and user experience.

## New Structure

### 1. **Leave Requests** (Page 1)
**File:** `LeaveRequests.tsx`

**Features:**
- ✅ Display all leave requests in table format with employee details
- ✅ Status-based tabs: Pending, Approved, Rejected, Cancelled
- ✅ Pagination with 8 leaves per page maximum
- ✅ Independent pagination for each status category
- ✅ Previous/Next navigation with page indicator
- ✅ Filters for Employee Name and Employee ID
- ✅ Show status count badges on each tab
- ✅ Action buttons based on status:
  - **Pending**: Approve/Reject buttons
  - **Approved**: Cancel button
  - **Rejected/Cancelled**: Read-only (No actions)
- ✅ Display leave details:
  - Employee Name
  - Employee ID
  - Leave Type
  - Duration (Full Day/Half Day with session)
  - From Date
  - To Date
  - Days
  - Applied Date
  - Status with color-coded badge
- ✅ Filters persist when navigating between status tabs
- ✅ Page resets to 1 when filters change

**Pagination Implementation:**
- Maximum 8 items per page
- Independent page state for each status
- Displayed pagination info: "Showing X to Y of Z results"
- Current page and total pages display
- Previous/Next buttons with disabled state at boundaries

---

### 2. **Company Calendar** (Page 2)
**File:** `CompanyCalendar.tsx`

**Features:**
- ✅ Single company-wide calendar view using FullCalendar
- ✅ Shows approved employee leaves (integrated from TeamLeaveCalendar)
- ✅ Shows public holidays
- ✅ Highlight dates with multiple employees on leave (red background)
- ✅ Click on date to show employees absent on that date
- ✅ Dual view modes:
  - **Calendar View**: Visual calendar with color-coded events
  - **List View**: Tabular view of holidays and leaves
- ✅ Current month holidays display with details:
  - Holiday title
  - Day name and date
  - Holiday type (National/Company/Optional)
  - Employee count on leave
  - Holiday description (if available)
- ✅ Approved leaves for current month showing:
  - Employee name
  - Leave type
  - Date range
  - Total days
- ✅ Holiday add/edit/delete functionality via HolidayManagement component
- ✅ Responsive layout with smooth toggle between views

**Components Used:**
- TeamLeaveCalendar (for calendar visualization)
- HolidayManagement (for holiday CRUD operations)

---

### 3. **Compensation Management** (Page 3)
**File:** `CompensationManagement.tsx`

**Features:**
- ✅ Dedicated compensation leave management page
- ✅ Display employee compensation leave details in table
- ✅ Add compensation leaves:
  - Select employee from dropdown
  - Specify number of days
  - Provide reason for compensation
- ✅ Edit compensation entries with full modification
- ✅ Delete compensation entries
- ✅ Search by employee name or ID
- ✅ Summary statistics:
  - Total compensation entries
  - Total days allotted
  - Entries this month
- ✅ Display compensation history with columns:
  - Employee Name
  - Employee ID
  - Compensation Days (badge)
  - Reason
  - Applied Date
  - Created By
  - Edit/Delete Actions
- ✅ Form validation for all fields
- ✅ Toast notifications for actions
- ✅ Informational banner about compensation purpose

---

## Main Container

**File:** `LeaveManagementContainer.tsx`

**Features:**
- ✅ Tab navigation with 3 pages:
  1. 📋 Leave Requests
  2. 📅 Company Calendar
  3. 🎯 Compensation Management
- ✅ Icon indicators for each tab
- ✅ Active tab highlighting with primary color
- ✅ Smooth fade-in animation on tab change
- ✅ Maintains separate state for each tab

---

## Updated Files

### LeaveManagementDashboard.tsx
- Simplified to use `LeaveManagementContainer`
- Maintains backward compatibility with existing routes

---

## Key Improvements

1. **Better Organization**: Separated concerns into logical pages/tabs
2. **Improved UX**: Each section now focuses on specific functionality
3. **Pagination**: Prevents overwhelming users with large datasets (8 items per page)
4. **Independent State**: Each status tab maintains its own pagination
5. **Enhanced Filtering**: Filters are prominent and reset pagination appropriately
6. **Consistent UI**: Uses existing Tailwind styling and UI components
7. **Responsive Layout**: Works seamlessly on mobile and desktop
8. **Comprehensive Features**: All original features retained with improvements

---

## API Integration

All components maintain existing API integrations:
- `useLeaves()` hook provides: leaves, holidays, loading, actions
- `useEmployees()` hook provides: employees data
- `leaveService` API calls for backend operations
- Compensation data stored in component state (ready for backend persistence)

---

## Future Enhancements

1. **Compensation Persistence**: Store compensation data in backend
2. **Export/Import**: Excel export for leave and compensation reports
3. **Bulk Actions**: Select multiple leaves for batch operations
4. **Advanced Filters**: Date range, department filters
5. **Dashboard Analytics**: Charts showing leave trends
6. **Notifications**: Email alerts for leave approvals
7. **Mobile App**: Sync with mobile application

---

## Component Usage

### Basic Usage in Routes:
```tsx
import { LeaveManagementDashboard } from '@/pages/admin/Leaves/LeaveManagementDashboard'

// In your route definitions
<Route path="/admin/leaves" element={<LeaveManagementDashboard />} />
```

### Customization:
All components accept their respective props and can be customized independently or as part of the container.

---

## Browser Compatibility
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

---

## Performance Notes
- Pagination reduces DOM elements (max 8 per page)
- Filter operations use `useMemo` for optimization
- Calendar rendering optimized with FullCalendar
- Lazy loading possible for future scale

