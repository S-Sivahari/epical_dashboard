import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { ProjectModel } from '../../../models/Project';
import { PMLibraryModel } from '../models/PMLibrary';
import { PMCellModel } from '../models/PMCell';
import { PMAssignmentModel } from '../models/PMAssignment';
import { PMReviewModel } from '../models/PMReview';
import { PMAuditLogModel } from '../models/PMAuditLog';

/**
 * Hierarchical Project Management Controllers
 * These controllers enforce and expose the Project → Library → Cell hierarchy
 */
export const pmHierarchicalController = {
  /**
   * GET /api/project-management/projects/:projectId/details
   * Returns complete project details with hierarchy summary
   */
  getProjectDetails: async (req: Request, res: Response): Promise<void> => {
    try {
      const { projectId } = req.params;
      
      // Get project
      const project = await ProjectModel.findById(projectId);
      if (!project) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }

      // Get libraries for this project
      const libraries = await PMLibraryModel.find({ 
        projectId: new Types.ObjectId(projectId), 
        isArchived: false 
      });

      // Get cells for this project
      const cells = await PMCellModel.find({ 
        projectId: new Types.ObjectId(projectId), 
        isArchived: false 
      });

      // Get assignments
      const assignments = await PMAssignmentModel.find({ 
        projectId: new Types.ObjectId(projectId), 
        isArchived: false 
      });

      // Get pending reviews
      const pendingReviews = await PMReviewModel.find({
        projectId: new Types.ObjectId(projectId),
        status: 'Pending',
        isArchived: false
      });

      // Calculate metrics
      const uniqueEmployees = new Set(assignments.map(a => a.employeeId));
      const completedCells = cells.filter(c => c.status === 'Completed').length;
      const inProgressCells = cells.filter(c => c.status === 'In Progress').length;
      const pendingReviewCells = cells.filter(c => c.status === 'Submitted For Review').length;
      
      const avgProgress = cells.length > 0 
        ? Math.round(cells.reduce((sum, c) => sum + c.progress, 0) / cells.length)
        : 0;

      res.json({
        project: {
          id: project._id,
          name: (project as any).projectName || (project as any).name,
          description: (project as any).description || '',
          teamLead: (project as any).teamLead || (project as any).projectLead || '',
          status: (project as any).status || 'Active',
        },
        metrics: {
          totalLibraries: libraries.length,
          totalCells: cells.length,
          completedCells,
          inProgressCells,
          pendingReviewCells,
          assignedEmployees: uniqueEmployees.size,
          pendingReviews: pendingReviews.length,
          overallProgress: avgProgress,
        },
        libraries: libraries.map(lib => ({
          id: lib._id,
          name: lib.name,
          description: lib.description,
          progress: lib.progress,
          status: lib.status,
          cellsCount: cells.filter(c => c.libraryId.toString() === lib._id.toString()).length,
        })),
      });
    } catch (error: any) {
      console.error('getProjectDetails error:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch project details' });
    }
  },

  /**
   * GET /api/project-management/projects/:projectId/libraries
   * Returns all libraries for a project with parent context
   */
  getProjectLibraries: async (req: Request, res: Response): Promise<void> => {
    try {
      const { projectId } = req.params;
      
      const project = await ProjectModel.findById(projectId);
      if (!project) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }

      const libraries = await PMLibraryModel.find({ 
        projectId: new Types.ObjectId(projectId), 
        isArchived: false 
      }).sort({ createdAt: -1 });

      // Get cell counts for each library
      const librariesWithCells = await Promise.all(
        libraries.map(async (lib) => {
          const cellsCount = await PMCellModel.countDocuments({ 
            libraryId: lib._id, 
            isArchived: false 
          });
          
          const cells = await PMCellModel.find({ 
            libraryId: lib._id, 
            isArchived: false 
          });
          
          const completedCells = cells.filter(c => c.status === 'Completed').length;
          const progress = cells.length > 0
            ? Math.round(cells.reduce((sum, c) => sum + c.progress, 0) / cells.length)
            : 0;

          return {
            id: lib._id,
            name: lib.name,
            description: lib.description,
            progress,
            status: lib.status,
            cellsCount,
            completedCells,
            totalCells: cells.length,
            projectName: (project as any).projectName || (project as any).name,
            projectId: project._id,
            updatedAt: lib.updatedAt,
          };
        })
      );

      res.json({
        project: {
          id: project._id,
          name: (project as any).projectName || (project as any).name,
        },
        libraries: librariesWithCells,
      });
    } catch (error: any) {
      console.error('getProjectLibraries error:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch project libraries' });
    }
  },

  /**
   * GET /api/project-management/projects/:projectId/cells
   * Returns all cells across all libraries in a project
   */
  getProjectCells: async (req: Request, res: Response): Promise<void> => {
    try {
      const { projectId } = req.params;
      
      const project = await ProjectModel.findById(projectId);
      if (!project) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }

      const cells = await PMCellModel.find({ 
        projectId: new Types.ObjectId(projectId), 
        isArchived: false 
      })
      .populate('libraryId', 'name')
      .sort({ createdAt: -1 });

      const cellsWithHierarchy = cells.map(cell => ({
        id: cell._id,
        name: cell.name,
        viewType: cell.viewType,
        progress: cell.progress,
        status: cell.status,
        assignedEmployee: cell.assignedEmployee || 'Unassigned',
        libraryName: (cell.libraryId as any)?.name || 'Unknown',
        libraryId: cell.libraryId,
        projectName: (project as any).projectName || (project as any).name,
        projectId: project._id,
        updatedAt: cell.updatedAt,
      }));

      res.json({
        project: {
          id: project._id,
          name: (project as any).projectName || (project as any).name,
        },
        cells: cellsWithHierarchy,
      });
    } catch (error: any) {
      console.error('getProjectCells error:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch project cells' });
    }
  },

  /**
   * GET /api/project-management/libraries/:libraryId/details
   * Returns library details with parent project and child cells
   */
  getLibraryDetails: async (req: Request, res: Response): Promise<void> => {
    try {
      const { libraryId } = req.params;
      
      const library = await PMLibraryModel.findById(libraryId).populate('projectId');
      if (!library) {
        res.status(404).json({ error: 'Library not found' });
        return;
      }

      const project = library.projectId as any;
      const cells = await PMCellModel.find({ 
        libraryId: new Types.ObjectId(libraryId), 
        isArchived: false 
      });

      const completedCells = cells.filter(c => c.status === 'Completed').length;
      const inProgressCells = cells.filter(c => c.status === 'In Progress').length;
      const pendingReviewCells = cells.filter(c => c.status === 'Submitted For Review').length;

      res.json({
        library: {
          id: library._id,
          name: library.name,
          description: library.description,
          progress: library.progress,
          status: library.status,
        },
        project: {
          id: project._id,
          name: project.projectName || project.name,
        },
        metrics: {
          totalCells: cells.length,
          completedCells,
          inProgressCells,
          pendingReviewCells,
        },
        cells: cells.map(cell => ({
          id: cell._id,
          name: cell.name,
          viewType: cell.viewType,
          progress: cell.progress,
          status: cell.status,
          assignedEmployee: cell.assignedEmployee,
          updatedAt: cell.updatedAt,
        })),
      });
    } catch (error: any) {
      console.error('getLibraryDetails error:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch library details' });
    }
  },

  /**
   * GET /api/project-management/libraries/:libraryId/cells
   * Returns cells for a library with parent context
   */
  getLibraryCells: async (req: Request, res: Response): Promise<void> => {
    try {
      const { libraryId } = req.params;
      
      const library = await PMLibraryModel.findById(libraryId).populate('projectId');
      if (!library) {
        res.status(404).json({ error: 'Library not found' });
        return;
      }

      const cells = await PMCellModel.find({ 
        libraryId: new Types.ObjectId(libraryId), 
        isArchived: false 
      }).sort({ createdAt: -1 });

      const project = library.projectId as any;

      res.json({
        project: {
          id: project._id,
          name: project.projectName || project.name,
        },
        library: {
          id: library._id,
          name: library.name,
        },
        cells: cells.map(cell => ({
          id: cell._id,
          name: cell.name,
          viewType: cell.viewType,
          progress: cell.progress,
          status: cell.status,
          assignedEmployee: cell.assignedEmployee || 'Unassigned',
          updatedAt: cell.updatedAt,
        })),
      });
    } catch (error: any) {
      console.error('getLibraryCells error:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch library cells' });
    }
  },

  /**
   * GET /api/project-management/cells/:cellId/details
   * Returns cell details with full hierarchy path
   */
  getCellDetails: async (req: Request, res: Response): Promise<void> => {
    try {
      const { cellId } = req.params;
      
      const cell = await PMCellModel.findById(cellId)
        .populate({
          path: 'libraryId',
          populate: {
            path: 'projectId'
          }
        });

      if (!cell) {
        res.status(404).json({ error: 'Cell not found' });
        return;
      }

      const library = cell.libraryId as any;
      const project = library.projectId as any;

      // Get assignment for this cell
      const assignment = await PMAssignmentModel.findOne({ 
        cellId: cell._id, 
        isArchived: false 
      });

      // Get reviews for this cell
      const reviews = await PMReviewModel.find({ 
        cellId: cell._id, 
        isArchived: false 
      }).sort({ submittedAt: -1 });

      // Get audit logs for this cell
      const auditLogs = await PMAuditLogModel.find({
        targetType: 'Cell',
        targetId: cell._id.toString(),
      }).sort({ timestamp: -1 }).limit(20);

      res.json({
        cell: {
          id: cell._id,
          name: cell.name,
          viewType: cell.viewType,
          checklistType: cell.checklistType,
          progress: cell.progress,
          status: cell.status,
          assignedEmployee: cell.assignedEmployee,
          createdAt: cell.createdAt,
          updatedAt: cell.updatedAt,
        },
        library: {
          id: library._id,
          name: library.name,
        },
        project: {
          id: project._id,
          name: project.projectName || project.name,
        },
        assignment: assignment ? {
          assignedTo: assignment.employeeId,
          assignedBy: assignment.assignedBy,
          assignedAt: assignment.createdAt,
        } : null,
        reviews: reviews.map(r => ({
          id: r._id,
          reviewType: r.reviewType,
          status: r.status,
          submittedBy: r.submittedBy,
          submittedAt: r.submittedAt,
        })),
        recentActivity: auditLogs.map(log => ({
          action: log.action,
          user: log.user,
          timestamp: log.timestamp,
        })),
      });
    } catch (error: any) {
      console.error('getCellDetails error:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch cell details' });
    }
  },
};
