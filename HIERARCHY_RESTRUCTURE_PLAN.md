# Project Management Hierarchy Restructure - Implementation Plan

## Critical Issue Identified

**PROBLEM**: Current architecture treats Views as separate entities from Cells  
**REALITY**: A Cell has EXACTLY ONE ViewType (Schematic, Symbol, or Layout)  
**IMPACT**: This creates confusion and breaks the hierarchy

## Correct Architecture

### Data Model
```
Project (1)
  ├── Library (N) - belongsTo Project
       ├── Cell (N) - belongsTo Library, HAS viewType field
            ├── ViewType: "Schematic" | "Symbol" | "Layout" (FIXED AT CREATION)
            ├── currentStage: string (workflow stage)
            ├── completedStages: string[]
            ├── status: "In Progress" | "Submitted For Review" | "Completed" | "Rejected"
            └── assignment → Employee
```

### Key Principles
1. **ViewType is a Cell property** - not a separate entity
2. **One Cell = One ViewType** - immutable after creation
3. **Hierarchy must be visible** - Parent context always shown
4. **Employee sees only assigned** - filtered by assignment

## Implementation Steps

### Phase 1: Backend Model Verification ✅
- [x] PMLibrary has projectId ✅
- [x] PMCell has libraryId ✅
- [x] PMCell has viewType field ✅
- [x] PMAssignment has full hierarchy (project, library, cell, view) ✅
- [ ] Add projectId to PMCell for direct reference
- [ ] Add validation to prevent duplicate ViewTypes per Cell

### Phase 2: Backend Controller Enhancements
- [ ] Add population to all endpoints (project → library → cell)
- [ ] Modify getCells to always include parent library and project
- [ ] Modify getLibraries to always include parent project
- [ ] Add hierarchical endpoints:
  - `GET /projects/:id/libraries`
  - `GET /libraries/:id/cells`
  - `GET /cells/:id/details` (with full hierarchy)
- [ ] Fix employee workspace to filter by assignments

### Phase 3: Frontend - Hierarchical Navigation
- [ ] Add Breadcrumbs component
- [ ] Add Tree View component
- [ ] Restructure Projects page:
  - Click project → Navigate to Project Details
  - Project Details shows Libraries for that project only
- [ ] Restructure Libraries (remove standalone page):
  - Only shown within Project context
  - Displays parent project name
- [ ] Restructure Cells (remove standalone page):
  - Only shown within Library context
  - Displays parent library and project

### Phase 4: Frontend - Project Details Page
Create comprehensive project details view:
- Overview tab (metrics, team, progress)
- Libraries tab (list of libraries in this project)
- Cells tab (all cells across all libraries in this project)
- Reviews tab (all reviews for this project)
- Audit tab (project-specific audit logs)

### Phase 5: Frontend - Library Details Page
- Overview (library metrics)
- Cells (cells in this library)
- Workflow (cell workflow visualization)
- Reviews (reviews for cells in this library)

### Phase 6: Frontend - Cell Details Page
- Overview (cell info, assigned employee, view type)
- Workflow (stage progression with visual timeline)
- Checklist (view type specific checklist)
- Reviews (checkpoint reviews for this cell)
- Audit Trail (cell-specific history)

### Phase 7: Employee Workspace Integration
- [ ] Filter cells by employee assignments
- [ ] Show hierarchy: Project → Library → Cell
- [ ] Display only assigned cells
- [ ] Show view type and current stage
- [ ] Enable workflow progression

## Workflow Stage Definitions

### Schematic Workflow
1. In Progress
2. Submitted For Review
3. Completed

### Symbol Workflow
1. In Progress
2. Submitted For Review
3. Completed

### Layout Workflow
1. Floor Plan
2. DRC Review
3. Checkpoint 1 (Admin Review)
4. Routing
5. DRC
6. LVS
7. Submit For Review
8. Checkpoint 2 (Admin Review)
9. Completed

## UI Components Needed

### New Components
1. **Breadcrumbs** - Show hierarchy path
2. **HierarchyTree** - Expandable tree view
3. **ProjectDetails** - Comprehensive project view
4. **LibraryDetails** - Library-specific view
5. **CellDetails** - Cell-specific view
6. **WorkflowTimeline** - Visual stage progression
7. **ProgressRollup** - Hierarchical progress calculation

### Modified Components
1. **ProjectsPage** - Add click to details, remove inline library/cell views
2. **Remove standalone LibrariesPage** - Only context-aware
3. **Remove standalone CellsPage** - Only context-aware
4. **Dashboard** - Show hierarchy summary

## Database Schema Changes

### Add projectId to PMCell (Critical)
```typescript
export interface PMCell extends Document {
  projectId: Types.ObjectId; // NEW - direct project reference
  libraryId: Types.ObjectId;
  name: string;
  viewType: 'Schematic' | 'Symbol' | 'Layout'; // IMMUTABLE
  // ... rest
}
```

### Add Validation
```typescript
// Ensure viewType is immutable after creation
PMCellSchema.pre('save', function(next) {
  if (!this.isNew && this.isModified('viewType')) {
    throw new Error('ViewType cannot be changed after cell creation');
  }
  next();
});

// Add compound unique index
PMCellSchema.index({ libraryId: 1, name: 1, viewType: 1 }, { unique: true });
```

## API Endpoint Changes

### New Hierarchical Endpoints
```typescript
GET /api/project-management/projects/:projectId/libraries
GET /api/project-management/projects/:projectId/cells
GET /api/project-management/projects/:projectId/details

GET /api/project-management/libraries/:libraryId/cells
GET /api/project-management/libraries/:libraryId/details

GET /api/project-management/cells/:cellId/details (with full hierarchy)

GET /api/project-management/employee/:employeeId/assignments (with hierarchy)
```

### Modified Endpoints
```typescript
// Always populate parent references
GET /api/project-management/libraries?projectId=xxx
  → Include project details

GET /api/project-management/cells?libraryId=xxx
  → Include library and project details

GET /api/project-management/reviews/admin
  → Include full hierarchy (project → library → cell)
```

## Frontend Routing Changes

### New Routes
```typescript
/admin/project-management/projects/:projectId
/admin/project-management/projects/:projectId/libraries/:libraryId
/admin/project-management/projects/:projectId/libraries/:libraryId/cells/:cellId

// Employee workspace
/employee/project-workspace/:projectId
/employee/project-workspace/:projectId/cells/:cellId
```

### Remove Routes
```typescript
❌ /admin/project-management/libraries (standalone)
❌ /admin/project-management/cells (standalone)
```

## Progress Rollup Logic

```typescript
// Cell Progress
cellProgress = (completedStages.length / totalStages) * 100

// Library Progress
libraryProgress = average(allCellsInLibrary.map(c => c.progress))

// Project Progress
projectProgress = average(allLibrariesInProject.map(l => l.progress))
```

## Validation Rules

### Creation Rules
1. Library must have valid projectId
2. Cell must have valid libraryId
3. Cell must specify viewType (immutable)
4. Assignment must reference existing cell

### Deletion Rules
1. Cannot delete Project if has Libraries
2. Cannot delete Library if has Cells
3. Cannot delete Cell if has active Reviews
4. Use archive instead of delete

### Update Rules
1. Cannot change Cell.viewType after creation
2. Cannot move Cell to different Library
3. Cannot move Library to different Project
4. Can reassign Cell to different Employee

## Employee Workspace Requirements

### What Employee Sees
```
My Projects
└── ADC_TOP (Project)
     └── Analog_Lib (Library)
          └── Comparator (Cell)
               ├── ViewType: Layout
               ├── Current Stage: Routing
               ├── Progress: 60%
               ├── Checklist: [DRC items]
               └── Actions: [Advance Stage, Submit Review]
```

### Query Logic
```typescript
// Get employee's assigned cells with full hierarchy
const assignments = await PMAssignmentModel.find({ 
  employeeId: 'EMP001',
  isArchived: false 
})
.populate({
  path: 'cellId',
  populate: {
    path: 'libraryId',
    populate: {
      path: 'projectId'
    }
  }
})
```

## Migration Plan

### Step 1: Database Migration
1. Add projectId to all existing PMCell documents
2. Add validation hooks
3. Test data integrity

### Step 2: Backend Updates
1. Update models with new fields
2. Add new hierarchical endpoints
3. Modify existing endpoints to populate
4. Test API responses

### Step 3: Frontend Restructure
1. Create new components (Breadcrumbs, Tree, Details pages)
2. Update routing
3. Remove standalone pages
4. Test navigation flow

### Step 4: Employee Workspace
1. Update query logic
2. Add hierarchy display
3. Test assignment filtering

### Step 5: Testing & Validation
1. Test full hierarchy navigation
2. Test progress rollups
3. Test employee assignments
4. Test breadcrumbs and tree view
5. Validate immutable viewType
6. Test create/update/delete restrictions

## Success Criteria

- [ ] Project → Library → Cell hierarchy visible everywhere
- [ ] Breadcrumbs show current location in hierarchy
- [ ] Tree view shows expandable hierarchy
- [ ] Click project shows only its libraries
- [ ] Click library shows only its cells
- [ ] Cell details show parent library and project
- [ ] ViewType is immutable after creation
- [ ] Employee sees only assigned cells with hierarchy
- [ ] Progress rolls up correctly
- [ ] No orphan records possible
- [ ] All CRUD operations respect hierarchy

---

**Status**: Planning Complete - Ready for Implementation  
**Priority**: CRITICAL - Blocks proper workflow  
**Estimated Effort**: 2-3 days full restructure
