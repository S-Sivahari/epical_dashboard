import { connectDB } from '../config/db.js';

async function test() {
  try {
    const db = await connectDB();
    console.log('✓ Connected to MongoDB');
    console.log('✓ Database:', db.databaseName);
    
    const employees = await db.collection('employees').find({}).limit(5).toArray();
    console.log(`✓ Found ${employees.length} employees (showing first 5):`);
    employees.forEach((e) => {
      console.log(`  - ${e.firstName} ${e.lastName} (${e.email}) - ${e.status}`);
    });
    
    const total = await db.collection('employees').countDocuments();
    console.log(`✓ Total employees in collection: ${total}`);
    
    process.exit(0);
  } catch (error) {
    console.error('✗ Error:', error);
    process.exit(1);
  }
}

test();
