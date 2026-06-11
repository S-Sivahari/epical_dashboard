import { connectDB } from '../config/db';
import { PMCellModel } from '../modules/projectManagement/models/PMCell';
import { PMLibraryModel } from '../modules/projectManagement/models/PMLibrary';

/**
 * Migration Script: Add projectId to all PMCell documents
 * 
 * This script adds the projectId field to all existing cells by looking up
 * their parent library's projectId.
 * 
 * Run with: npx ts-node src/scripts/migrateAddProjectIdToCells.ts
 */
async function migrateProjectIdToCells() {
  try {
    console.log('🚀 Starting migration: Add projectId to cells...\n');
    
    await connectDB();
    console.log('✅ Database connected\n');

    // Get all cells
    const cells = await PMCellModel.find({});
    console.log(`📦 Found ${cells.length} cells to migrate\n`);

    if (cells.length === 0) {
      console.log('No cells to migrate. Exiting...');
      process.exit(0);
    }

    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const cell of cells) {
      try {
        // Skip if projectId already exists
        if (cell.projectId) {
          skipped++;
          continue;
        }

        // Get library to find projectId
        const library = await PMLibraryModel.findById(cell.libraryId);
        
        if (!library) {
          console.error(`❌ Cell ${cell._id} (${cell.name}): Library ${cell.libraryId} not found`);
          errors++;
          continue;
        }

        if (!library.projectId) {
          console.error(`❌ Cell ${cell._id} (${cell.name}): Library ${library._id} has no projectId`);
          errors++;
          continue;
        }

        // Update cell with projectId
        cell.projectId = library.projectId;
        await cell.save();
        updated++;

        if (updated % 100 === 0) {
          console.log(`⏳ Progress: Updated ${updated} cells...`);
        }
      } catch (error: any) {
        console.error(`❌ Error updating cell ${cell._id}:`, error.message);
        errors++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Migration Summary:');
    console.log('='.repeat(60));
    console.log(`✅ Successfully updated: ${updated} cells`);
    console.log(`⏭️  Skipped (already had projectId): ${skipped} cells`);
    console.log(`❌ Errors: ${errors} cells`);
    console.log(`📦 Total processed: ${cells.length} cells`);
    console.log('='.repeat(60));

    if (errors > 0) {
      console.log('\n⚠️  Migration completed with errors. Please review the error messages above.');
      process.exit(1);
    } else {
      console.log('\n✅ Migration completed successfully!');
      process.exit(0);
    }
  } catch (error: any) {
    console.error('\n❌ Migration failed with error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run migration
migrateProjectIdToCells();
