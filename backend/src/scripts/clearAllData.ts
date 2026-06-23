import dotenv from 'dotenv'
import { MongoClient } from 'mongodb'

dotenv.config()

const DB_NAME = process.env.MONGODB_DB_NAME || 'Production'

async function main() {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    throw new Error('MONGODB_URI is not set in .env')
  }

  const client = new MongoClient(uri)
  await client.connect()

  const db = client.db(DB_NAME)
  const collections = await db.listCollections().toArray()

  console.log(`Database: ${DB_NAME}`)
  console.log(
    `Collections (${collections.length}):`,
    collections.map((c) => c.name).join(', ') || '(none)',
  )

  const result = await db.dropDatabase()
  console.log('dropDatabase result:', result)

  await client.close()
  console.log('Done — all application data cleared.')
}

main().catch((error) => {
  console.error('Failed to clear database:', error)
  process.exit(1)
})
