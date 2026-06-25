import mongoose, { Types } from 'mongoose';
import ExcelJS from 'exceljs';
import { PMLibraryModel } from '../models/PMLibrary';
import { PMCellModel } from '../models/PMCell';
import { PMViewModel, PMView } from '../models/PMView';
import { PMReviewModel } from '../models/PMReview';
import { PMProjectStateModel } from '../models/PMProjectState';
import { CellChecklistInstanceModel, CellChecklistItem } from '../models/CellChecklistInstance';
import { ChecklistTemplateVersionModel } from '../models/ChecklistTemplateVersion';
import { ChecklistTemplateModel } from '../models/ChecklistTemplate';
import { PMAuditLogModel } from '../models/PMAuditLog';
import { PMNotificationModel } from '../models/PMNotification';
import { ProjectModel } from '../../../models/Project';
import { ChecklistResponseModel } from '../models/ChecklistResponse';
import { ReviewSubmissionModel } from '../models/ReviewSubmission';
import { EmployeeAuditLogModel } from '../models/EmployeeAuditLog';
import { AdminAuditLogModel } from '../models/AdminAuditLog';
import { WorkflowHistoryModel } from '../models/WorkflowHistory';
import { ReviewHistoryModel } from '../models/ReviewHistory';
import { listAdminNotificationRecipients } from '../../../services/notificationService';

async function notifyPmAdmins(payload: {
  title: string;
  message: string;
  relatedData?: Record<string, unknown>;
}): Promise<void> {
  const recipients = await listAdminNotificationRecipients();
  await Promise.all(
    recipients.map((recipient) =>
      PMNotificationModel.create({
        recipientId: recipient.recipientId,
        recipientType: 'Admin',
        title: payload.title,
        message: payload.message,
        relatedData: payload.relatedData,
      }),
    ),
  );
}

// Approved Layout Stages
export const LAYOUT_STAGES = [
  'Floor Plan',     // Stage 1
  'DRC Review',     // Stage 2
  'Routing',        // Stage 3
  'DRC',            // Stage 4
  'LVS',            // Stage 5
  'Submit For Review' // Stage 6
];

export const pmService = {
  /**
   * Logs actions to the Audit Log collection.
   */
  logAuditTrail: async (
    user: string,
    action: string,
    targetId: Types.ObjectId,
    targetType: 'Project' | 'Library' | 'Cell' | 'View' | 'ChecklistTemplate' | 'CellChecklistInstance' | 'Assignment' | 'Review',
    previousState: any = null,
    newState: any = null
  ) => {
    try {
      await PMAuditLogModel.create({
        user,
        action,
        targetId,
        targetType,
        previousState,
        newState,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Audit log write failure:', error);
    }
  },

  /**
   * Parses Excel file buffers using ExcelJS and extracts checklist items.
   */
  parseChecklistExcel: async (fileBuffer: Buffer): Promise<Omit<CellChecklistItem, 'isCompleted' | 'isCustom' | 'isArchived'>[]> => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(fileBuffer as any);
    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) {
      throw new Error('Checklist spreadsheet worksheet not found');
    }

    const items: any[] = [];
    let order = 1;

    worksheet.eachRow((row, rowNumber) => {
      // Skip headers
      if (rowNumber === 1) return;

      const text = row.getCell(1).value?.toString()?.trim();
      const category = row.getCell(2).value?.toString()?.trim() || 'General';
      const mandatoryVal = row.getCell(3).value?.toString()?.trim()?.toLowerCase();
      
      if (!text) return; // Skip empty rows

      const isMandatory = mandatoryVal !== 'no' && mandatoryVal !== 'false';
      items.push({
        itemId: `item_${rowNumber}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        text,
        category,
        isMandatory,
        order: order++
      });
    });

    return items;
  },

  /**
   * Automatic Hierarchical Progress Calculation Roll-up Engine.
   * View -> Cell -> Library -> PM Project State -> Dashboard Metrics
   * Architecture: 1 Cell = 1 View (single viewType per cell)
   */
  recalculateProgress: async (viewId: Types.ObjectId): Promise<void> => {
    // 1. Fetch current view & recalculate progress
    const view = await PMViewModel.findById(viewId);
    if (!view) return;

    let viewProgress = view.progress || 0;
    if (view.status === 'Completed') {
      viewProgress = 100;
    } else if (view.status === 'Rejected') {
      // Keep existing progress on rejection! Do not recalculate or reset it.
    } else if (view.viewType === 'Layout') {
      // Dynamic Layout progress: stages count out of 6 completed.
      const completedCount = view.completedStages?.length ?? 0;
      const calculatedProgress = Math.round((completedCount / 6) * 100);
      viewProgress = Math.max(viewProgress, calculatedProgress);
      if (viewProgress > 95) viewProgress = 95; // Cap at 95% if not fully completed
    } else {
      // Schematic/Symbol progress
      if (view.status === 'Submitted For Review') {
        viewProgress = Math.max(viewProgress, 50);
      }
    }

    view.progress = viewProgress;
    view.lastUpdated = new Date();
    await view.save();

    // 2. Roll up to Cell (1 cell = 1 view, cell progress = view progress)
    const cell = await PMCellModel.findById(view.cellId);
    if (!cell) return;

    cell.progress = viewProgress;

    // Cell status mirrors view status + checklist approval
    const checklistResponse = await ChecklistResponseModel.findOne({ cellId: cell._id });
    const checklistApproved = checklistResponse ? checklistResponse.status === 'Approved' : false;

    if (view.status === 'Completed' && checklistApproved) {
      cell.status = 'Completed';
    } else if (view.status === 'Submitted For Review') {
      cell.status = 'Submitted For Review';
    } else if (view.status === 'Rejected') {
      cell.status = 'Rejected';
    } else if (viewProgress > 0) {
      cell.status = 'In Progress';
    } else {
      cell.status = 'Not Started';
    }
    await cell.save();

    // 3. Roll up to Library
    const library = await PMLibraryModel.findById(cell.libraryId);
    if (!library) return;

    const cells = await PMCellModel.find({ libraryId: library._id, isArchived: false });
    if (cells.length > 0) {
      const totalCellsProgress = cells.reduce((sum, c) => sum + c.progress, 0);
      library.progress = Math.round(totalCellsProgress / cells.length);
      const allCellsCompleted = cells.every(c => c.status === 'Completed');
      library.status = allCellsCompleted ? 'Completed' : 'In Progress';
    } else {
      library.progress = 0;
      library.status = 'In Progress';
    }
    await library.save();

    // 4. Roll up to PM Project State
    const projectState = await PMProjectStateModel.findOne({ projectId: library.projectId });
    if (projectState) {
      const libraries = await PMLibraryModel.find({ projectId: library.projectId, isArchived: false });
      if (libraries.length > 0) {
        const totalLibProgress = libraries.reduce((sum, l) => sum + l.progress, 0);
        projectState.progress = Math.round(totalLibProgress / libraries.length);
        const allLibsCompleted = libraries.every(l => l.status === 'Completed');
        projectState.status = allLibsCompleted ? 'Completed' : 'In Progress';
      } else {
        projectState.progress = 0;
        projectState.status = 'In Progress';
      }
      await projectState.save();

      // Synchronize changes to main Project model
      await ProjectModel.findByIdAndUpdate(library.projectId, {
        completionPercentage: projectState.progress,
        status: projectState.status === 'Completed' ? 'Completed' : 'Active',
      });
    }
  },

  /**
   * Submits a view for review. Enforces mandatory checklist compliance.
   */
  submitViewForReview: async (viewId: Types.ObjectId, employeeId: string): Promise<PMView> => {
    const view = await PMViewModel.findById(viewId);
    if (!view) throw new Error('View not found');
    if (view.status === 'Submitted For Review' || view.status === 'Completed') {
      throw new Error('View is already submitted or completed');
    }

    const cell = await PMCellModel.findById(view.cellId);
    if (!cell) throw new Error('Cell not found');

    // 1. Fetch checklist responses for this view type and validate compliance
    const checklistResponse = await ChecklistResponseModel.findOne({ viewId: view._id });
    if (checklistResponse) {
      const incompleteMandatory = checklistResponse.answers.filter(item => {
        return item.isMandatory && item.response === 'None';
      });

      if (incompleteMandatory.length > 0) {
        throw new Error(
          `Cannot submit for review. ${incompleteMandatory.length} mandatory checklist items are not completed.`
        );
      }

      // Lock response to Completed
      checklistResponse.status = 'Completed';
      checklistResponse.submittedBy = employeeId;
      checklistResponse.submittedAt = new Date();
      await checklistResponse.save();
    } else {
      // Backup check using CellChecklistInstanceModel for legacy compatibility
      const checklist = await CellChecklistInstanceModel.findOne({ cellId: cell._id });
      if (!checklist) {
        throw new Error('Checklist instance not found for this cell');
      }

      const viewCat = view.viewType.toLowerCase();
      const incompleteMandatory = checklist.items.filter(item => {
        if (!item.isMandatory || item.isCompleted || item.isArchived) return false;
        const itemCat = item.category.toLowerCase();
        // If template contains explicit view markers, validate. Otherwise default to cell-wide
        if (itemCat.includes('schematic') && viewCat !== 'schematic') return false;
        if (itemCat.includes('symbol') && viewCat !== 'symbol') return false;
        if (itemCat.includes('layout') && viewCat !== 'layout') return false;
        return true;
      });

      if (incompleteMandatory.length > 0) {
        throw new Error(
          `Cannot submit for review. ${incompleteMandatory.length} mandatory checklist items are not completed.`
        );
      }
    }

    // 2. Identify submission review types
    let reviewType: 'Standard' | 'Checkpoint 1' | 'Checkpoint 2' = 'Standard';
    if (view.viewType === 'Layout') {
      if (view.currentStage === 'DRC Review') {
        reviewType = 'Checkpoint 1';
      } else if (view.currentStage === 'Submit For Review') {
        reviewType = 'Checkpoint 2';
      } else {
        throw new Error(`Invalid stage for Layout submission: ${view.currentStage}`);
      }
    }

    // 3. Update view status to lock it
    view.status = 'Submitted For Review';
    view.reviewStatus = reviewType === 'Checkpoint 1' ? 'Pending Checkpoint 1' : 'Pending Checkpoint 2';
    if (reviewType === 'Standard') {
      view.reviewStatus = 'Pending Checkpoint 1'; // standard review uses same queue
    }
    view.lastUpdated = new Date();
    await view.save();

    // 4. Create review entry (backward compatibility)
    const library = await PMLibraryModel.findById(cell.libraryId);
    const review = await PMReviewModel.create({
      viewId: view._id,
      cellId: cell._id,
      libraryId: cell.libraryId,
      projectId: library!.projectId,
      viewType: view.viewType,
      reviewType,
      status: 'Pending',
      submittedBy: employeeId,
      createdAt: new Date()
    });

    // Create ReviewSubmission entry (new enterprise model)
    const checklistResponseId = checklistResponse?._id || new Types.ObjectId();
    const submission = await ReviewSubmissionModel.create({
      viewId: view._id,
      cellId: cell._id,
      viewType: view.viewType,
      reviewType,
      status: 'Pending',
      submittedBy: employeeId,
      submittedAt: new Date(),
      checklistResponseId
    });

    // Send persistent Admin Notification
    await notifyPmAdmins({
      title: 'Review Required',
      message: `Cell ${cell.name} (${view.viewType}) is pending review for ${reviewType}.`,
      relatedData: {
        viewId: view._id.toString(),
        cellId: cell._id.toString(),
        libraryId: cell.libraryId.toString(),
        projectId: library!.projectId.toString(),
        reviewId: review._id.toString(),
        viewType: view.viewType,
        stage: view.currentStage,
      },
    });

    // Write audit trail
    await pmService.logAuditTrail(
      employeeId,
      `Checkpoint Submission: ${reviewType}`,
      view._id,
      'View',
      { previousStatus: 'In Progress', stage: view.currentStage },
      { status: 'Submitted For Review', reviewStatus: view.reviewStatus }
    );

    // Resolve employee name for EmployeeAuditLog
    let employeeName = employeeId;
    try {
      const EmployeeModel = mongoose.model('Employee');
      const employeeUser = await EmployeeModel.findById(employeeId);
      if (employeeUser) {
        employeeName = `${employeeUser.firstName} ${employeeUser.lastName || ''}`.trim();
      }
    } catch (e) {
      // fallback
    }

    await EmployeeAuditLogModel.create({
      employeeId,
      employeeName,
      action: 'Review Submitted',
      details: `Submitted ${view.viewType} for review type: ${reviewType}`,
      relatedId: view._id,
      relatedType: 'View'
    });

    // Recalculate progress values
    await pmService.recalculateProgress(view._id);

    return view;
  },

  /**
   * Admin approves review queue entry. Unlocks stage workflow.
   */
  approveReview: async (reviewId: Types.ObjectId, adminUser: string, comments: string): Promise<void> => {
    const review = await PMReviewModel.findById(reviewId);
    if (!review || review.status !== 'Pending') {
      throw new Error('Review request not found or not pending');
    }

    const view = await PMViewModel.findById(review.viewId);
    if (!view) throw new Error('Associated view not found');

    const prevStage = view.currentStage;
    const prevStatus = view.status;

    if (review.reviewType === 'Standard') {
      view.status = 'Completed';
      view.reviewStatus = 'Approved';
      view.progress = 100;
    } else if (review.reviewType === 'Checkpoint 1') {
      view.status = 'In Progress';
      view.reviewStatus = 'None';
      view.checkpointStatus.checkpoint1 = 'Approved';
      view.currentStage = 'Routing';
      // Append completed stages
      const stagesSet = new Set(view.completedStages);
      stagesSet.add('Floor Plan');
      stagesSet.add('DRC Review');
      view.completedStages = Array.from(stagesSet);
    } else if (review.reviewType === 'Checkpoint 2') {
      view.status = 'Completed';
      view.reviewStatus = 'Approved';
      view.checkpointStatus.checkpoint2 = 'Approved';
      view.currentStage = 'Completed';
      // Complete all layout stages
      const stagesSet = new Set(view.completedStages);
      LAYOUT_STAGES.forEach(s => stagesSet.add(s));
      view.completedStages = Array.from(stagesSet);
      view.progress = 100;
    }

    view.lastUpdated = new Date();
    await view.save();

    // Complete review entry
    review.status = 'Approved';
    review.comments = comments;
    review.reviewedBy = adminUser;
    review.reviewedAt = new Date();
    await review.save();

    // Complete ReviewSubmission status
    await ReviewSubmissionModel.findOneAndUpdate(
      { viewId: view._id, status: 'Pending' },
      { $set: { status: 'Approved' } }
    );

    // Update view-specific ChecklistResponse
    const checklistResponse = await ChecklistResponseModel.findOne({ viewId: view._id });
    if (checklistResponse) {
      checklistResponse.status = 'Approved';
      await checklistResponse.save();
    }

    // Create ReviewHistory entry
    await ReviewHistoryModel.create({
      reviewId: review._id,
      viewId: view._id,
      viewType: view.viewType,
      reviewType: review.reviewType,
      status: 'Approved',
      comments,
      reviewedBy: adminUser,
      reviewedAt: new Date()
    });

    // Send persistent Employee Notification
    const cell = await PMCellModel.findById(view.cellId);
    await PMNotificationModel.create({
      recipientId: review.submittedBy,
      recipientType: 'Employee',
      title: 'Submission Approved',
      message: `Your review for cell ${cell?.name || 'unknown'} (${view.viewType}) was approved. Comments: ${comments || 'None'}`,
      relatedData: {
        viewId: view._id.toString(),
        cellId: view.cellId.toString(),
        viewType: view.viewType,
        stage: view.currentStage,
        comments
      }
    });

    // Audit entry
    await pmService.logAuditTrail(
      adminUser,
      `Checkpoint Approval: ${review.reviewType}`,
      view._id,
      'View',
      { status: prevStatus, stage: prevStage },
      { status: view.status, stage: view.currentStage, checkpointStatus: view.checkpointStatus }
    );

    await AdminAuditLogModel.create({
      adminEmail: adminUser,
      action: `Review Approved: ${review.reviewType}`,
      details: `Approved review for view: ${view.viewType} of type: ${review.reviewType}. Comments: ${comments}`,
      relatedId: review._id,
      relatedType: 'Review',
      previousState: { status: prevStatus },
      newState: { status: 'Approved' }
    });

    // Roll up progress
    await pmService.recalculateProgress(view._id);
  },

  /**
   * Admin rejects review queue entry. Specifying return stage.
   */
  rejectReview: async (
    reviewId: Types.ObjectId,
    adminUser: string,
    returnStage: string,
    comments: string,
    correctiveAction: string
  ): Promise<void> => {
    const review = await PMReviewModel.findById(reviewId);
    if (!review || review.status !== 'Pending') {
      throw new Error('Review request not found or not pending');
    }

    const view = await PMViewModel.findById(review.viewId);
    if (!view) throw new Error('Associated view not found');

    const prevStage = view.currentStage;
    const prevStatus = view.status;

    if (view.viewType === 'Layout') {
      if (!LAYOUT_STAGES.includes(returnStage)) {
        throw new Error(`Invalid stage layout specified for return: ${returnStage}`);
      }

      // Check restrictions for Checkpoint 1 vs 2 rejection return stages
      if (review.reviewType === 'Checkpoint 1' && !['Floor Plan', 'DRC Review'].includes(returnStage)) {
        throw new Error('Checkpoint 1 rejection must return to Floor Plan or DRC Review');
      }

      view.status = 'Rejected';
      view.reviewStatus = 'Rejected';
      view.currentStage = returnStage;
      if (review.reviewType === 'Checkpoint 1') {
        view.checkpointStatus.checkpoint1 = 'Rejected';
      } else {
        view.checkpointStatus.checkpoint2 = 'Rejected';
      }

      // Update completedStages to match what's before returnStage
      const targetIndex = LAYOUT_STAGES.indexOf(returnStage);
      view.completedStages = LAYOUT_STAGES.slice(0, targetIndex);
    } else {
      // Schematic/Symbol reject
      view.status = 'Rejected';
      view.reviewStatus = 'Rejected';
    }

    view.lastUpdated = new Date();
    await view.save();

    // Complete review entry
    review.status = 'Rejected';
    review.comments = comments; // comments double as Rejection Reason
    review.correctiveAction = correctiveAction;
    review.returnStage = returnStage;
    review.reviewedBy = adminUser;
    review.reviewedAt = new Date();
    await review.save();

    // Complete ReviewSubmission status
    await ReviewSubmissionModel.findOneAndUpdate(
      { viewId: view._id, status: 'Pending' },
      { $set: { status: 'Rejected' } }
    );

    // Update view-specific ChecklistResponse (unlock to In Progress so employee can update it)
    const checklistResponse = await ChecklistResponseModel.findOne({ viewId: view._id });
    if (checklistResponse) {
      checklistResponse.status = 'Rejected';
      await checklistResponse.save();
    }

    // Create ReviewHistory entry
    await ReviewHistoryModel.create({
      reviewId: review._id,
      viewId: view._id,
      viewType: view.viewType,
      reviewType: review.reviewType,
      status: 'Rejected',
      comments,
      correctiveAction,
      returnStage,
      reviewedBy: adminUser,
      reviewedAt: new Date()
    });

    // Create WorkflowHistory entry for stage reversion
    await WorkflowHistoryModel.create({
      viewId: view._id,
      viewType: view.viewType,
      cellId: view.cellId,
      stageFrom: prevStage,
      stageTo: returnStage,
      action: 'Stage Reverted (Review Rejected)',
      changedBy: adminUser,
      comments: `Rejection reason: ${comments}. Corrective action: ${correctiveAction}`,
      timestamp: new Date()
    });

    // Send persistent Employee Notification for Rework Required
    const cell = await PMCellModel.findById(view.cellId);
    await PMNotificationModel.create({
      recipientId: review.submittedBy,
      recipientType: 'Employee',
      title: 'Rework Required (Submission Rejected)',
      message: `Your review for cell ${cell?.name || 'unknown'} (${view.viewType}) was rejected. Corrective Action: ${correctiveAction || 'None'}`,
      relatedData: {
        viewId: view._id.toString(),
        cellId: view.cellId.toString(),
        viewType: view.viewType,
        stage: view.currentStage,
        comments,
        correctiveAction,
        returnStage
      }
    });

    // Audit entry
    await pmService.logAuditTrail(
      adminUser,
      `Checkpoint Rejection: ${review.reviewType}`,
      view._id,
      'View',
      { status: prevStatus, stage: prevStage },
      { status: view.status, stage: view.currentStage, returnStage, comments, correctiveAction }
    );

    await AdminAuditLogModel.create({
      adminEmail: adminUser,
      action: `Review Rejected: ${review.reviewType}`,
      details: `Rejected review for view: ${view.viewType} of type: ${review.reviewType}. Return Stage: ${returnStage}. Corrective Action: ${correctiveAction}`,
      relatedId: review._id,
      relatedType: 'Review',
      previousState: { status: prevStatus, stage: prevStage },
      newState: { status: 'Rejected', stage: returnStage }
    });

    // Roll up progress (this preserves maximum progress as recalculateProgress keeps progress on status === 'Rejected')
    await pmService.recalculateProgress(view._id);
  }
};
