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
    // Create index on news collection for faster sorting by publishedAt
    await database.collection('news').createIndex({ publishedAt: -1 });
    console.log('✓ Database indexes created');
  } catch (error) {
    console.warn('⚠ Failed to create indexes:', error);
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
