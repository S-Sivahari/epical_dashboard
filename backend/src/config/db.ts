import { MongoClient, Db } from 'mongodb';
import { env } from './env';

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectDB(): Promise<Db> {
  if (db) return db;

  try {
    client = new MongoClient(env.mongodbUri);
    await client.connect();
    db = client.db('Production');
    console.log('✓ Connected to MongoDB');
    return db;
  } catch (error) {
    console.error('✗ MongoDB connection failed:', error);
    throw error;
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
}
