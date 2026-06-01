# EMPWR — Admin Portal UI

**Employee Management Platform for Workforce and Reporting**

This document describes the admin portal UI: layout, navigation, pages, design system, and how to run it locally.

---

## Overview

The admin portal is a dark-themed enterprise dashboard for HR and operations teams. It uses a fixed sidebar, top navbar, and scrollable main content area with glass-style cards on a grid background.

| Item | Value |
|------|-------|
| Product name | **EMPWR** |
| Brand | Epical Layouts |
| Base route | `/admin` |
| Auth | Admin role required (`ProtectedRoute`) |
| Default login | `admin@company.com` / `admin123` |

---

## Running the Admin UI

Both frontend and backend must be running. A **Network Error** on login usually means the backend is not started.

### 1. Backend (API — port 3000)

```powershell
cd epical_dashboard/backend
npm install
npm run dev
```

Wait for:

```
✓ Server running on http://localhost:3000
```

### 2. Frontend (UI — port 5173)

```powershell
cd epical_dashboard/frontend
npm install
npm run dev
```

Open **http://localhost:5173/auth/login** and sign in with an admin account.

### Environment

**Frontend** (`frontend/.env`):

```
VITE_API_BASE_URL=http://localhost:3000/api
VITE_GOOGLE_CLIENT_ID=<your-google-client-id>
```

**Backend** (`backend/.env`):

```
PORT=3000
CORS_ORIGIN=http://localhost:5173,http://localhost:5174
FRONTEND_URL=http://localhost:5173
```

---

## Layout Structure

```
┌─────────────────────────────────────────────────────────────┐
│  Sidebar (260px)  │  Navbar (64px)                          │
│  ───────────────  │  Page title · Notifications · Profile   │
│  EMPWR brand      ├─────────────────────────────────────────┤
│  Nav groups       │                                         │
│  Main             │  Main content (scrollable)              │
│  People           │  PageWrapper (max-w-7xl)                │
│  Work             │  Cards, tables, charts, forms           │
│  Company          │                                         │
└───────────────────┴─────────────────────────────────────────┘
```

### Shell components

| Component | Path | Role |
|-----------|------|------|
| `AdminLayout` | `frontend/src/layouts/AdminLayout.tsx` | Root shell: sidebar + navbar + outlet |
| `Sidebar` | `frontend/src/components/layout/Sidebar.tsx` | Left navigation (260px, collapsible on mobile) |
| `Navbar` | `frontend/src/components/layout/Navbar.tsx` | Page title, back button, notifications, user menu |
| `PageWrapper` | `frontend/src/components/layout/PageWrapper.tsx` | Content container with responsive padding |
| `LoginBackground` | `frontend/src/components/auth/LoginBackground.tsx` | Animated grid background (`variant="admin"`) |

### Mobile behavior

- Below `1024px` (lg), the sidebar is hidden and opened via a hamburger toggle.
- A dark overlay closes the drawer when tapped outside.
- Navbar adds left padding on small screens to avoid overlapping the menu button.

---

## Design System

The admin theme is scoped under `.admin-portal` in `frontend/src/index.css`.

### Color palette

| Token | Value | Usage |
|-------|-------|-------|
| `--bg-canvas` | `#0c0d12` | Main background |
| `--bg-sidebar` | `#111319` | Sidebar |
| `--bg-card` | `#161922` | Cards and panels |
| `--neon-green` | `#00e676` | Primary accent, active nav, CTAs |
| `--neon-cyan` | `#00e5ff` | Secondary accent, focus rings |
| `--neon-purple` | `#bf5af2` | Charts / highlights |
| `--neon-red` | `#ff453a` | Errors, destructive actions |
| `--text-primary` | `#ffffff` | Headings |
| `--text-secondary` | `#a0aec0` | Body text |
| `--text-muted` | `#64748b` | Labels, captions |
| `--border-subtle` | `rgba(255,255,255,0.06)` | Card and input borders |

### UI patterns

- **Cards:** `.dashboard-card`, `.crewiq-dash-card`, `.admin-card`, `.metric-card`
- **Forms:** `.admin-field` — dark inputs with cyan focus ring
- **Tables:** `.admin-panel` — bordered panels for data tables
- **Buttons:** Primary green glow on login; pill-style quick links on dashboard
- **Motion:** Framer Motion fade/slide on dashboard widgets
- **Icons:** Lucide React (18px in sidebar, consistent stroke width)
- **Toasts:** Sonner (bottom-right notifications)
- **Charts:** Recharts via `HoursBarChart`, `DepartmentPieChart`, `KPICard`

### Typography

- **Display font:** Used for headings, brand, and metric values (`font-display`)
- **Body font:** Used for labels and content (`font-body`)

---

## Navigation

Sidebar groups and routes (from `Sidebar.tsx` and `constants/routes.ts`):

### Main

| Label | Route | Page |
|-------|-------|------|
| Dashboard | `/admin` | `DashboardHome` |

### People

| Label | Route | Page |
|-------|-------|------|
| Manage Employees | `/admin/employees` | `EmployeeList` |
| Manage Leaves | `/admin/leaves` | `LeaveManagementDashboard` |

Badge on **Manage Leaves** shows pending leave count.

### Work

| Label | Route | Page |
|-------|-------|------|
| Projects / Timesheet | `/admin/projects` | `ProjectManagement` |
| Company Calendar | `/admin/calendar` | `AdminCompanyCalendarPage` |

### Company

| Label | Route | Page |
|-------|-------|------|
| Payslips | `/admin/payslips` | `PayslipManagement` |
| Training & Courses | `/admin/training` | `TrainingCourses` |
| Company achievements | `/admin/achievements` | `CompanyAchievements` |
| Analytics | `/admin/analytics` | `Analytics` |
| Documents Request | `/admin/documents` | `DocumentManagement` |
| Manage News | `/admin/news` | `CompanyNews` |
| Tickets | `/admin/tickets` | `TicketManagement` |

Badge on **Documents Request** shows pending document count.

### Settings (navbar only)

| Route | Page |
|-------|------|
| `/admin/settings` | `Settings` |

Accessed from the user dropdown in the navbar (not in the sidebar).

---

## Pages & Features

### Dashboard (`/admin`)

**File:** `frontend/src/pages/admin/Dashboard/DashboardHome.tsx`

- Welcome card with admin avatar, name, designation
- **Quick actions:** Add Employee, Review Leaves, Document Requests, Manage News
- **News ticker:** Scrolling company news (`AdminNewsTicker`)
- **Project hours chart:** Bar chart with period selector (This Week, This Month, etc.)
- **Stat cards:**
  - Employees Working
  - Pending Leaves
  - Active Projects

### Manage Employees (`/admin/employees`)

**Files:** `EmployeeList`, `AddEmployee`, `EmployeeProfile`, `EditEmployee`

- Searchable, sortable employee table with pagination
- Filters: name, employment type, status (Active, Inactive, Deactivated, Notice Period)
- Bulk status updates
- Export to Excel / PDF
- Active Directory export report
- Add employee form at `/admin/employees/add`
- Profile view and edit at `/admin/employees/:id` and `/admin/employees/:id/edit`

### Manage Leaves (`/admin/leaves`)

**File:** `LeaveManagementContainer.tsx` (tabs)

| Tab | Features |
|-----|----------|
| Leave Requests | Pending / approved / rejected filters, approve & reject, export PDF/Excel |
| Company Calendar | Team leave calendar view |
| Compensation Management | Compensation leave tracking and export |

Sub-pages: `LeaveRequests`, `PendingLeaves`, `ApprovedLeaves`, `RejectedLeaves`, `HolidayManagement`, `TeamLeaveCalendar`.

### Projects / Timesheet (`/admin/projects`)

**File:** `ProjectManagement.tsx`

- Project list with status, client, assignments
- Timesheet logs per project and employee
- Task management and hour overrides
- Export timesheet data (Excel)
- Correction requests and approval flows

### Company Calendar (`/admin/calendar`)

**File:** `AdminCompanyCalendarPage.tsx`

- FullCalendar-based company events view
- Holidays and company-wide events

### Payslips (`/admin/payslips`)

**File:** `PayslipManagement.tsx`

- Upload payroll files
- Generate and distribute payslips
- Employee payslip history

### Training & Courses (`/admin/training`)

**File:** `TrainingCourses.tsx`

- Create and manage training courses
- Assign courses to employees
- Track completion status

### Company Achievements (`/admin/achievements`)

**File:** `CompanyAchievements.tsx`

- Post and manage company achievements / milestones

### Analytics (`/admin/analytics`)

**File:** `Analytics.tsx`

- KPI cards: total hours, completed courses, avg hours/week
- Weekly performance bar chart
- Course completion pie chart
- Filter by employee, month, year
- Export analytics PDF

### Documents Request (`/admin/documents`)

**File:** `DocumentManagement.tsx`

- Review employee document requests
- Approve, reject, or fulfill requests

### Manage News (`/admin/news`)

**File:** `CompanyNews.tsx`

- Create, edit, and publish company news
- News appears on admin dashboard ticker and employee portal

### Tickets (`/admin/tickets`)

**Files:** `TicketManagement.tsx`, `TicketDetailModal.tsx`

- View and manage employee support tickets
- Update status, assign, and respond

### Settings (`/admin/settings`)

**File:** `Settings.tsx`

- Sign-in information (Google OAuth)
- Data protection and backup instructions
- MongoDB Atlas backup guidance

---

## Navbar

| Element | Behavior |
|---------|----------|
| **Page title** | Auto-derived from current route |
| **Back button** | Shown on nested routes (e.g. employee profile) |
| **Notification bell** | Dropdown with admin notifications |
| **User menu** | Avatar, name, designation → Settings, Log out |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | React 18 + TypeScript |
| Build | Vite 6 |
| Routing | React Router v6 (lazy-loaded pages) |
| State | Zustand (`authStore`, `uiStore`, domain stores) |
| Styling | Tailwind CSS + custom admin CSS variables |
| Forms | React Hook Form + Zod |
| HTTP | Axios (`frontend/src/services/api.ts`) |
| UI primitives | Radix UI (dropdowns, dialogs, tabs) |
| Charts | Recharts |
| Calendar | FullCalendar |
| Animation | Framer Motion |
| Icons | Lucide React |

---

## Project Structure (Admin)

```
frontend/src/
├── layouts/
│   └── AdminLayout.tsx          # Admin shell
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx          # Navigation
│   │   ├── Navbar.tsx           # Top bar
│   │   └── PageWrapper.tsx      # Content wrapper
│   ├── admin/
│   │   └── AdminNewsTicker.tsx
│   ├── charts/                  # BarChart, PieChart, KPICard
│   ├── tables/                  # DataTable, Pagination
│   └── ui/                      # Button, Badge, Modal, Avatar
├── pages/admin/
│   ├── Dashboard/
│   ├── Employees/
│   ├── Leaves/
│   ├── Projects/
│   ├── Calendar/
│   ├── Payslips/
│   ├── Training/
│   ├── Achievements/
│   ├── Analytics/
│   ├── Documents/
│   ├── News/
│   ├── Tickets/
│   └── Settings/
├── routes/
│   └── AppRoutes.tsx            # Route definitions
├── store/
│   └── authStore.ts             # Login state
└── index.css                    # Admin theme tokens & components
```

---

## Related Portals

| Portal | Route | Layout |
|--------|-------|--------|
| Login | `/auth/login` | `AuthLayout` — dark glass card, green accents |
| Admin | `/admin/*` | `AdminLayout` — dark sidebar + grid background |
| Employee | `/employee/*` | `EmployeeLayout` — lighter theme, separate sidebar |

The login page and admin portal share the same brand (EMPWR / Epical Layouts) and neon-green accent, but the admin area uses a persistent sidebar and dashboard layout.

---

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| **Network Error** on login | Backend not running | Start backend with `npm run dev` in `backend/` |
| Blank page after login | Wrong role | Use an admin account, not employee-only |
| CORS errors | Origin mismatch | Add your frontend URL to `CORS_ORIGIN` in backend `.env` |
| API 401 after login | Expired token | Log out and sign in again |
| Styles look wrong | Cache | Hard refresh (Ctrl+Shift+R) |

---

## Quick Reference — Admin Routes

```
/admin                          Dashboard
/admin/employees                Employee list
/admin/employees/add            Add employee
/admin/employees/:id            Employee profile
/admin/employees/:id/edit       Edit employee
/admin/leaves                     Leave management
/admin/projects                   Projects & timesheets
/admin/calendar                   Company calendar
/admin/payslips                   Payslip management
/admin/training                   Training courses
/admin/achievements               Company achievements
/admin/analytics                  Analytics
/admin/documents                  Document requests
/admin/news                       Company news
/admin/tickets                    Support tickets
/admin/settings                   Settings
```
