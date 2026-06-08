import { connectDB, closeDB } from '../config/db';

async function main() {
  const db = await connectDB();
  const users = await db
    .collection('users')
    .find({ name: /priya/i })
    .project({ name: 1, email: 1, role: 1, id: 1 })
    .toArray();
  const employees = await db
    .collection('employees')
    .find({
      $or: [
        { firstName: /priya/i },
        { lastName: /nair/i },
        { name: /priya/i },
      ],
    })
    .project({ firstName: 1, lastName: 1, name: 1, email: 1, employeeId: 1, id: 1 })
    .toArray();

  console.log('Users:', users);
  console.log('Employees:', employees);
  await closeDB();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
