import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

const sql = neon(process.env.DATABASE_URL);

async function initDb() {
  try {
    console.log("Creating books table...");
    await sql`
      CREATE TABLE IF NOT EXISTS books (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(255) NOT NULL,
        author VARCHAR(255) NOT NULL,
        isbn VARCHAR(100),
        category VARCHAR(100),
        description TEXT,
        cover_image_url TEXT,
        total_copies INTEGER NOT NULL DEFAULT 1,
        available_copies INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    console.log("Books table created successfully.");

    console.log("Creating borrow_records table...");
    await sql`
      CREATE TABLE IF NOT EXISTS borrow_records (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR(255) NOT NULL,
        book_id UUID REFERENCES books(id) ON DELETE CASCADE,
        borrow_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        due_date TIMESTAMP NOT NULL,
        return_date TIMESTAMP,
        status VARCHAR(50) DEFAULT 'borrowed' CHECK (status IN ('borrowed', 'returned', 'overdue'))
      );
    `;
    console.log("Borrow_records table created successfully.");
  } catch (error) {
    console.error("Error creating tables:", error);
  }
}

initDb();
