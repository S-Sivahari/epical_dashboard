import { connectDB, closeDB } from '../config/db';
import { ensureDefaultAdminUser } from '../services/authService';
import { getAdminLoginEmail } from '../utils/employeeAuth';

async function main() {
  const db = await connectDB();
  const before = await db
    .collection('users')
    .findOne({ role: 'Admin' }, { projection: { name: 1, email: 1 } });
  console.log('Before:', before);

  const result = await ensureDefaultAdminUser();

  const after = await db
    .collection('users')
    .findOne({ email: getAdminLoginEmail() }, { projection: { name: 1, email: 1 } });
  console.log('Sync result:', result);
  console.log('After:', after);

  await closeDB();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
