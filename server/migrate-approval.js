import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

const sql = neon(process.env.DATABASE_URL);

async function migrateDb() {
  try {
    console.log("Finding CHECK constraint on borrow_records...");
    console.log("Dropping constraint: borrow_records_status_check");
    await sql`ALTER TABLE borrow_records DROP CONSTRAINT IF EXISTS borrow_records_status_check`;

    console.log("Adding new status CHECK constraint...");
    await sql`
      ALTER TABLE borrow_records ADD CONSTRAINT borrow_records_status_check 
      CHECK (status IN ('borrowed', 'returned', 'overdue', 'pending_borrow', 'pending_return', 'rejected'))
    `;
    console.log("Migration completed successfully.");
    
    // Also change the default to pending_borrow
    await sql`ALTER TABLE borrow_records ALTER COLUMN status SET DEFAULT 'pending_borrow'`;
    // We should also allow due_date to be nullable because for pending borrows, due date isn't set until approval.
    await sql`ALTER TABLE borrow_records ALTER COLUMN due_date DROP NOT NULL`;

  } catch (error) {
    console.error("Migration failed:", error);
  }
}

migrateDb();
