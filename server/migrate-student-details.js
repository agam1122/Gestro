import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

const sql = neon(process.env.DATABASE_URL);

async function migrateDb() {
  try {
    console.log("Adding user_name and roll_no to borrow_records...");
    await sql`ALTER TABLE borrow_records ADD COLUMN IF NOT EXISTS user_name VARCHAR(255)`;
    await sql`ALTER TABLE borrow_records ADD COLUMN IF NOT EXISTS roll_no VARCHAR(255)`;
    console.log("Migration completed successfully.");
  } catch (error) {
    console.error("Migration failed:", error);
  }
}

migrateDb();
