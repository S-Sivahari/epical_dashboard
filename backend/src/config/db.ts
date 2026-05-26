import { MongoClient, Db } from 'mongodb';
import mongoose from 'mongoose';
import { env } from './env';

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectDB(): Promise<Db> {
  if (db) return db;

  try {
    // Connect native MongoDB driver
    client = new MongoClient(env.mongodbUri);
    await client.connect();
    db = client.db('Production');
    console.log('✓ Connected to MongoDB via MongoClient');

    // Create indexes for better performance
    await createIndexes(db);

    // Connect Mongoose to the same database
    await mongoose.connect(env.mongodbUri, { dbName: 'Production' });
    console.log('✓ Connected to MongoDB via Mongoose');

    return db;
  } catch (error) {
    console.error('✗ MongoDB connection failed:', error);
    throw error;
  }
}

async function createIndexes(database: Db): Promise<void> {
  try {
    // News collection
    await database.collection('news').createIndex({ publishedAt: -1 })
    
    // Employees collection - Critical for performance
    await database.collection('employees').createIndex({ status: 1 })
    await database.collection('employees').createIndex({ email: 1 })
    await database.collection('employees').createIndex({ id: 1 })
    await database.collection('employees').createIndex({ department: 1 })
    
    // Users collection
    await database.collection('users').createIndex({ role: 1 })
    await database.collection('users').createIndex({ email: 1 })
    await database.collection('users').createIndex({ id: 1 })
    
    // Leaves collection
    await database.collection('leaves').createIndex({ employeeId: 1, status: 1 })
    await database.collection('leaves').createIndex({ status: 1, from: -1 })
    await database.collection('leaves').createIndex({ employeeId: 1 })
    
    // Timesheets collection
    await database.collection('timesheets').createIndex({ employeeId: 1, loginTime: -1 })
    await database.collection('timesheets').createIndex({ status: 1 })
    await database.collection('timesheets').createIndex({ loginTime: -1 })
    
    // Projects collection
    await database.collection('projects').createIndex({ status: 1 })
    await database.collection('projects').createIndex({ clientName: 1 })
    
    console.log('✓ Database indexes created')
  } catch (error) {
    console.warn('⚠ Some indexes may already exist:', error)
  }
}

export function getDB(): Db {
  if (!db) {
    throw new Error('Database not initialized. Call connectDB first.');
  }
  return db;
}

export async function closeDB(): Promise<void> {
  if (client) {
    await client.close();
    console.log('Database connection closed');
  }
  await mongoose.disconnect();
  console.log('Mongoose connection closed');
}
