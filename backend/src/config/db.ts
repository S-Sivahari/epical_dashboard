import { MongoClient, Db } from 'mongodb';
import mongoose from 'mongoose';
import { env } from './env';

let client: MongoClient | null = null;
let db: Db | null = null;

const DB_NAME = 'Production';

// Re-derives the native client/db handles from Mongoose's current
// connection. Mongoose may replace its underlying MongoClient on a full
// close+reconnect; without re-deriving, getDB() would keep returning a
// handle bound to the old, permanently-closed client. Idempotent — safe to
// call repeatedly (e.g. once from connectDB() and again from the
// 'connected' event fired by that same connect() call).
function deriveNativeHandles(): Db | null {
  try {
    client = mongoose.connection.getClient() as unknown as MongoClient;
    db = client.db(DB_NAME) as unknown as Db;
    return db;
  } catch (e) {
    console.error('[mongo] failed to derive native handles:', e);
    return null;
  }
}

// Registered once, before the first connect() call, so every state
// transition is observable — previously nothing logged when the Mongoose
// connection dropped or failed to (re)establish. Registering before
// mongoose.connect() also ensures the first 'connected' event isn't missed.
const mongooseConn = mongoose.connection;
mongooseConn.on('connected', () => {
  console.log('[mongo] connected');
  deriveNativeHandles();
});
mongooseConn.on('error', (e) => console.error('[mongo] error:', e.message));
mongooseConn.on('disconnected', () => console.error('[mongo] DISCONNECTED'));
mongooseConn.on('reconnected', () => {
  console.log('[mongo] reconnected');
  deriveNativeHandles();
});

export async function connectDB(retries = 5, delayMs = 3000): Promise<Db> {
  if (db) return db;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // Single connection, owned by Mongoose. The native MongoClient/Db
      // handles used by getDB() are derived from Mongoose's own client
      // instead of opening a second, independently-managed connection.
      await mongoose.connect(env.mongodbUri, {
        dbName: DB_NAME,
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        maxPoolSize: 10,
        minPoolSize: 2,
        heartbeatFrequencyMS: 10000,
      });

      const connectedDb = deriveNativeHandles();
      if (!connectedDb) {
        throw new Error('Failed to derive native database handle after connect');
      }

      // Verify the connection is actually alive before proceeding
      await connectedDb.command({ ping: 1 });

      console.log(`✓ Connected to MongoDB via Mongoose (attempt ${attempt})`);

      // Create indexes for better performance
      await createIndexes(connectedDb);

      return connectedDb;
    } catch (error) {
      console.error(
        `✗ MongoDB connection attempt ${attempt}/${retries} failed:`,
        error,
      );

      // Clean up the failed connection before retrying — client/db are
      // views onto Mongoose's own client, so tear down via Mongoose.
      try {
        await mongoose.disconnect();
      } catch {
        /* ignore disconnect errors */
      }
      client = null;
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
    throw new Error('getDB() called before database connection established');
  }
  return db;
}

export async function closeDB(): Promise<void> {
  // client/db are derived from Mongoose's own connection, so disconnecting
  // Mongoose closes the single underlying client — do not also close
  // `client` directly, that would double-close the same socket pool.
  await mongoose.disconnect();
  client = null;
  db = null;
  console.log('Mongoose connection closed');
}