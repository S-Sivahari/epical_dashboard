import { MongoClient, Db } from 'mongodb';
import mongoose from 'mongoose';
import { env } from './env';

let client: MongoClient | null = null;
let db: Db | null = null;

const DB_NAME = 'Production';

export async function connectDB(retries = 5, delayMs = 3000): Promise<Db> {
  if (db) return db;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // Connect native MongoDB driver
      client = new MongoClient(env.mongodbUri, {
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 10000,
      });
      await client.connect();

      // Verify the connection is actually alive before proceeding
      await client.db(DB_NAME).command({ ping: 1 });

      db = client.db(DB_NAME);
      console.log(`✓ Connected to MongoDB via MongoClient (attempt ${attempt})`);

      // Create indexes for better performance
      await createIndexes(db);

      // Connect Mongoose to the same database
      await mongoose.connect(env.mongodbUri, { dbName: DB_NAME });
      console.log('✓ Connected to MongoDB via Mongoose');

      return db;
    } catch (error) {
      console.error(
        `✗ MongoDB connection attempt ${attempt}/${retries} failed:`,
        error,
      );

      // Clean up the failed client before retrying
      if (client) {
        try {
          await client.close();
        } catch {
          /* ignore close errors */
        }
        client = null;
      }
      db = null;

      if (attempt === retries) {
        // Out of retries — let the caller decide what to do (exit & restart)
        throw error;
      }

      // Wait before the next attempt (linear backoff)
      await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
    }
  }

  // Unreachable, but satisfies TypeScript's return-type check
  throw new Error('connectDB exhausted all retries');
}

async function createIndexes(database: Db): Promise<void> {
  try {
    // News collection
    await database.collection('news').createIndex({ publishedAt: -1 })

    // Employees collection - Critical for performance
    await database.collection('employees').createIndex({ status: 1 })
    await database.collection('employees').createIndex({ email: 1 })
    await database.collection('employees').createIndex({ id: 1 })
    await database.collection('employees').createIndex({ employeeId: 1 })
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
    await database.collection('assignedtasks').createIndex({ projectId: 1 })
    await database.collection('notifications').createIndex({ recipientId: 1, createdAt: -1 })

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