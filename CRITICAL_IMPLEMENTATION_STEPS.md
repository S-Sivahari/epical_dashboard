# Critical Hierarchy Implementation - Step by Step

## IMMEDIATE STATUS

✅ **Completed**:
1. Created implementation plan (HIERARCHY_RESTRUCTURE_PLAN.md)
2. Updated PMCell model with:
   - projectId field for direct project reference
   - Immutable viewType field
   - Validation to prevent viewType changes
   - Compound unique index
3. Created hierarchical controller methods (pmHierarchicalController.ts)
4. Added new routes to pmRoutes.ts

⏳ **Remaining Work**:
1. Import new controller into pmRoutes
2. Update existing getCells/getLibraries to populate hierarchy
3. Create frontend hierarchical components
4. Update employee workspace
5. Test end-to-end

## NEXT IMMEDIATE STEPS

### Step 1: Complete Backend Integration (30 minutes)

**File**: `backend/src/modules/projectManagement/routes/pmRoutes.ts`

Add import at top:
```typescript
import { pmHierarchicalController } from '../controllers/pmHierarchicalController';
```

Update route handlers:
```typescript
router.get('/projects/:projectId/details', adminOrEmployee, pmHierarchicalController.getProjectDetails);
router.get('/projects/:projectId/libraries', adminOrEmployee, pmHierarchicalController.getProjectLibraries);
router.get('/projects/:projectId/cells', adminOrEmployee, pmHierarchicalController.getProjectCells);
router.get('/libraries/:libraryId/details', adminOrEmployee, pmHierarchicalController.getLibraryDetails);
router.get('/libraries/:libraryId/cells', adminOrEmployee, pmHierarchicalController.getLibraryCells);
router.get('/cells/:cellId/details', adminOrEmployee, pmSessionMiddleware, pmHierarchicalController.getCellDetails);
```

### Step 2: Update Existing Endpoints to Populate (15 minutes)

**File**: `backend/src/modules/projectManagement/controllers/pmController.ts`

Find `getLibraries` method and update:
```typescript
getLibraries: async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId } = req.query;
    const filter: any = { isArchived: req.query.archived === 'true' };
    if (projectId) filter.projectId = new Types.ObjectId(projectId as string);

    const libraries = await PMLibraryModel.find(filter)
      .populate('projectId', 'projectName name') // ADD THIS
      .sort({ createdAt: -1 });
    
    res.json(libraries);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch libraries' });
  }
},
```

Find `getCells` method and update:
```typescript
getCells: async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId, libraryId } = req.query;
    const filter: any = { isArchived: req.query.archived === 'true' };
    if (projectId) filter.projectId = new Types.ObjectId(projectId as string);
    if (libraryId) filter.libraryId = new Types.ObjectId(libraryId as string);

    const cells = await PMCellModel.find(filter)
      .populate({  // ADD THIS
        path: 'libraryId',
        select: 'name projectId',
        populate: {
          path: 'projectId',
          select: 'projectName name'
        }
      })
      .sort({ createdAt: -1 });
    
    res.json(cells);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch cells' });
  }
},
```

### Step 3: Database Migration Script (10 minutes)

**File**: `backend/src/scripts/migrateAddProjectIdToCells.ts`

```typescript
import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import { PMCellModel } from '../modules/projectManagement/models/PMCell';
import { PMLibraryModel } from '../modules/projectManagement/models/PMLibrary';

async function migrateProjectIdToCells() {
  try {
    await connectDB();
    console.log('Starting migration: Add projectId to cells...');

    const cells = await PMCellModel.find({});
    console.log(`Found ${cells.length} cells to migrate`);

    let updated = 0;
    for (const cell of cells) {
      // Get library to find projectId
      const library = await PMLibraryModel.findById(cell.libraryId);
      if (library && !cell.projectId) {
        cell.projectId = library.projectId;
        await cell.save();
        updated++;
        if (updated % 100 === 0) {
          console.log(`Updated ${updated} cells...`);
        }
      }
    }

    console.log(`✅ Migration complete! Updated ${updated} cells`);
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrateProjectIdToCells();
```

**Run migration**:
```bash
cd backend
npx ts-node src/scripts/migrateAddProjectIdToCells.ts
```

### Step 4: Create Frontend Components (2 hours)

#### Breadcrumbs Component
**File**: `frontend/src/components/projectManagement/Breadcrumbs.tsx`

```typescript
import { ChevronRight, Home } from 'lucide-react';
import { Link } from 'react-router-dom';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav className="flex items-center gap-2 text-sm font-semibold text-slate-600">
      <Link to="/admin/project-management" className="hover:text-[var(--emerald-dark)] transition-colors">
        <Home className="h-4 w-4" />
      </Link>
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <ChevronRight className="h-4 w-4 text-slate-400" />
          {item.href ? (
            <Link
              to={item.href}
              className="hover:text-[var(--emerald-dark)] transition-colors"
            >
              {item.label}
            </Link>
          ) : (
            <span className="text-slate-900">{item.label}</span>
          )}
        </div>
      ))}
    </nav>
  );
}
```

#### Project Details Page
**File**: `frontend/src/pages/admin/ProjectManagement/ProjectDetails.tsx`

```typescript
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Breadcrumbs } from '@/components/projectManagement/Breadcrumbs';
import { PageWrapper } from '@components/layout/PageWrapper';
import { Spinner } from '@components/ui/Spinner';
import api from '@/services/api';
import { toast } from 'sonner';

export function ProjectDetails() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'libraries' | 'cells' | 'reviews' | 'audit'>('overview');

  useEffect(() => {
    fetchProjectDetails();
  }, [projectId]);

  const fetchProjectDetails = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/project-management/projects/${projectId}/details`);
      setData(res.data);
    } catch (err) {
      console.error('Failed to fetch project details:', err);
      toast.error('Failed to load project details');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <PageWrapper>
        <div className="flex h-96 items-center justify-center">
          <Spinner size="lg" />
        </div>
      </PageWrapper>
    );
  }

  if (!data) {
    return <PageWrapper><div>Project not found</div></PageWrapper>;
  }

  return (
    <PageWrapper fillViewport>
      <div className="mb-4">
        <Breadcrumbs
          items={[
            { label: 'Projects', href: '/admin/project-management' },
            { label: data.project.name },
          ]}
        />
      </div>

      {/* Project Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900">{data.project.name}</h1>
        <p className="mt-2 text-sm text-slate-600">{data.project.description}</p>
        <div className="mt-3 flex gap-4 text-sm">
          <span className="font-semibold text-slate-600">
            Team Lead: <span className="text-slate-900">{data.project.teamLead || 'Not assigned'}</span>
          </span>
          <span className="font-semibold text-slate-600">
            Status: <span className="text-slate-900">{data.project.status}</span>
          </span>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Libraries" value={data.metrics.totalLibraries} />
        <MetricCard label="Cells" value={data.metrics.totalCells} />
        <MetricCard label="Completed" value={data.metrics.completedCells} />
        <MetricCard label="Progress" value={`${data.metrics.overallProgress}%`} />
      </div>

      {/* Tab Navigation */}
      <div className="mb-4 flex gap-2 border-b border-border">
        {['overview', 'libraries', 'cells', 'reviews', 'audit'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`px-4 py-2 text-sm font-semibold capitalize transition-all ${
              activeTab === tab
                ? 'border-b-2 border-[var(--emerald-dark)] text-[var(--emerald-dark)]'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'libraries' && (
          <div className="space-y-3">
            {data.libraries.map((lib: any) => (
              <div
                key={lib.id}
                onClick={() => navigate(`/admin/project-management/projects/${projectId}/libraries/${lib.id}`)}
                className="cursor-pointer rounded-lg border border-border bg-white p-4 hover:shadow-md transition-shadow"
              >
                <h3 className="text-lg font-bold text-slate-900">{lib.name}</h3>
                <p className="text-sm text-slate-600">{lib.description}</p>
                <div className="mt-2 flex gap-4 text-xs font-semibold text-slate-600">
                  <span>Cells: {lib.cellsCount}</span>
                  <span>Progress: {lib.progress}%</span>
                  <span>Status: {lib.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PageWrapper>
  );
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border bg-white p-4">
      <p className="text-xs font-semibold text-slate-600">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}
```

### Step 5: Update Routes (10 minutes)

**File**: `frontend/src/routes/AppRoutes.tsx`

Add new routes:
```typescript
import { ProjectDetails } from '@pages/admin/ProjectManagement/ProjectDetails';
import { LibraryDetails } from '@pages/admin/ProjectManagement/LibraryDetails';
import { CellDetails } from '@pages/admin/ProjectManagement/CellDetails';

// Inside admin routes:
<Route
  path="project-management/projects/:projectId"
  element={<ProjectDetails />}
/>
<Route
  path="project-management/projects/:projectId/libraries/:libraryId"
  element={<LibraryDetails />}
/>
<Route
  path="project-management/projects/:projectId/libraries/:libraryId/cells/:cellId"
  element={<CellDetails />}
/>
```

### Step 6: Update ProjectsPage to Navigate (5 minutes)

**File**: `frontend/src/pages/admin/ProjectManagement/components/ProjectsPage.tsx`

Update ProjectCard component:
```typescript
import { useNavigate } from 'react-router-dom';

function ProjectCard({ project }: { project: Project }) {
  const navigate = useNavigate();
  
  // ... existing code ...
  
  return (
    <div 
      onClick={() => navigate(`/admin/project-management/projects/${project.id}`)}
      className="cursor-pointer rounded-xl border border-border bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
    >
      {/* ... existing content ... */}
    </div>
  );
}
```

## TESTING CHECKLIST

After implementation:

### Backend Testing
- [ ] Run migration script successfully
- [ ] Test `/projects/:id/details` endpoint
- [ ] Test `/projects/:id/libraries` endpoint
- [ ] Test `/projects/:id/cells` endpoint
- [ ] Test `/libraries/:id/details` endpoint
- [ ] Test `/libraries/:id/cells` endpoint
- [ ] Test `/cells/:id/details` endpoint
- [ ] Verify projectId exists on all cells
- [ ] Verify viewType is immutable

### Frontend Testing
- [ ] Click project card navigates to details
- [ ] Breadcrumbs show correct hierarchy
- [ ] Project details displays libraries
- [ ] Click library navigates to library details
- [ ] Library details shows parent project
- [ ] Library details displays cells
- [ ] Click cell navigates to cell details
- [ ] Cell details shows full hierarchy
- [ ] Back navigation works correctly

### Integration Testing
- [ ] Employee workspace shows only assigned cells
- [ ] Hierarchy is visible in employee view
- [ ] Progress rolls up correctly
- [ ] Cannot create cell without library
- [ ] Cannot create library without project
- [ ] ViewType cannot be changed after creation

## ROLLBACK PLAN

If issues occur:

1. **Backend**: Revert pmController.ts and pmRoutes.ts
2. **Database**: Keep projectId in cells (doesn't hurt)
3. **Frontend**: Revert to previous ProjectsPage

## TIMELINE ESTIMATE

- Backend changes: 1 hour
- Migration: 10 minutes
- Frontend components: 2-3 hours
- Testing: 1 hour
- **Total**: 4-5 hours

## FILES MODIFIED

### Backend (6 files)
1. `models/PMCell.ts` ✅ (Done)
2. `controllers/pmHierarchicalController.ts` ✅ (Created)
3. `routes/pmRoutes.ts` ✅ (Partially done - needs import)
4. `controllers/pmController.ts` (Needs populate updates)
5. `scripts/migrateAddProjectIdToCells.ts` (New - needs creation)

### Frontend (8 files)
1. `components/projectManagement/Breadcrumbs.tsx` (New)
2. `pages/admin/ProjectManagement/ProjectDetails.tsx` (New)
3. `pages/admin/ProjectManagement/LibraryDetails.tsx` (New)
4. `pages/admin/ProjectManagement/CellDetails.tsx` (New)
5. `pages/admin/ProjectManagement/components/ProjectsPage.tsx` (Update)
6. `pages/admin/ProjectManagement/components/LibrariesPage.tsx` (Remove or repurpose)
7. `pages/admin/ProjectManagement/components/CellsPage.tsx` (Remove or repurpose)
8. `routes/AppRoutes.tsx` (Add new routes)

---

**Current Status**: 30% Complete (Backend models and controllers ready)  
**Next Action**: Complete backend integration (Step 1)  
**Priority**: CRITICAL - Blocks proper workflow functionality  
**Risk**: Medium - Requires migration and testing  
**Estimated Completion**: 4-5 hours of focused work
