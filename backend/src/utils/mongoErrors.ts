import { MongoError } from 'mongodb'

/**
 * Check if error is a MongoDB network/connection error
 */
export function isMongoNetworkError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  
  const err = error as any
  
  // Check for MongoDB connection errors
  if (err.name === 'MongoNetworkError') return true
  if (err.name === 'MongoServerError' && err.code === 'ECONNREFUSED') return true
  if (err.message?.includes('ECONNREFUSED')) return true
  if (err.message?.includes('connect ETIMEDOUT')) return true
  if (err.message?.includes('connection') && err.message?.includes('refused')) return true
  
  return false
}

/**
 * Format MongoDB connection error for user-friendly display
 */
export function formatMongoConnectionError(error: unknown): string {
  if (!error) return 'Database connection error'
  
  const err = error as any
  
  if (err.message?.includes('ECONNREFUSED')) {
    return 'Database connection refused. Please ensure MongoDB is running.'
  }
  
  if (err.message?.includes('ETIMEDOUT')) {
    return 'Database connection timeout. Please check your network and MongoDB server.'
  }
  
  if (err.name === 'MongoNetworkError') {
    return 'Network error connecting to database. Please check MongoDB server status.'
  }
  
  return err.message || 'Database connection error'
}
