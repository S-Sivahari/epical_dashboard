import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

async function run() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/epical';
  console.log("Connecting to:", uri.slice(0, 30) + "...");
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
