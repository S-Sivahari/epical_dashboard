const { MongoClient } = require('mongodb');

async function run() {
  const uri = 'mongodb://localhost:27017/epical';
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('Production');
    const employees = await db.collection('employees').find({}).toArray();
    console.log("EMPLOYEES:");
    employees.forEach(e => {
      console.log(`Name: ${e.firstName} ${e.lastName}, Email: ${e.email}, ID: ${e.id}, EmployeeId: ${e.employeeId}`);
    });
    
    const users = await db.collection('users').find({}).toArray();
    console.log("\nUSERS:");
    users.forEach(u => {
      console.log(`Name: ${u.name}, Email: ${u.email}, ID: ${u.id}, Role: ${u.role}`);
    });
  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}

run();
