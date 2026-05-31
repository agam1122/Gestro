import pg from 'pg';
const { Client } = pg;

const oldDbUrl = 'postgresql://neondb_owner:npg_qe6zVFHCf9kX@ep-restless-glitter-adxhvi94-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require';
const newDbUrl = 'postgresql://neondb_owner:npg_lW8tpAUdqH7T@ep-delicate-heart-ao7ch1a4-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';

async function migrate() {
    console.log("Starting migration for remaining tables...");

    const oldClient = new Client({ connectionString: oldDbUrl });
    const newClient = new Client({ connectionString: newDbUrl });

    await oldClient.connect();
    await newClient.connect();

    await oldClient.query("SET search_path TO public");
    await newClient.query("SET search_path TO public");

    console.log("Creating tables on new database...");
    
    // Create books
    await newClient.query(`
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
            created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // Create borrow_records
    await newClient.query(`
        CREATE TABLE IF NOT EXISTS borrow_records (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id VARCHAR(255) NOT NULL,
            book_id UUID REFERENCES books(id) ON DELETE CASCADE,
            borrow_date TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            due_date TIMESTAMP WITHOUT TIME ZONE,
            return_date TIMESTAMP WITHOUT TIME ZONE,
            status VARCHAR(50) DEFAULT 'pending_borrow' CHECK (status IN ('borrowed', 'returned', 'overdue', 'pending_borrow', 'pending_return', 'rejected')),
            user_name VARCHAR(255),
            roll_no VARCHAR(255)
        );
    `);

    // Create creations
    await newClient.query(`
        CREATE TABLE IF NOT EXISTS creations (
            id SERIAL PRIMARY KEY,
            user_id TEXT NOT NULL,
            prompt TEXT NOT NULL,
            content TEXT NOT NULL,
            type TEXT NOT NULL,
            publish BOOLEAN DEFAULT false,
            likes TEXT[] DEFAULT '{}',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    `);

    console.log("Migrating data...");

    // Migrate books
    const { rows: books } = await oldClient.query(`SELECT * FROM books`);
    for (const b of books) {
        await newClient.query(`
            INSERT INTO books (id, title, author, isbn, category, description, cover_image_url, total_copies, available_copies, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (id) DO NOTHING
        `, [b.id, b.title, b.author, b.isbn, b.category, b.description, b.cover_image_url, b.total_copies, b.available_copies, b.created_at]);
    }
    console.log("Migrated " + books.length + " books.");

    // Migrate borrow_records
    const { rows: borrows } = await oldClient.query(`SELECT * FROM borrow_records`);
    for (const br of borrows) {
        await newClient.query(`
            INSERT INTO borrow_records (id, user_id, book_id, borrow_date, due_date, return_date, status, user_name, roll_no)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (id) DO NOTHING
        `, [br.id, br.user_id, br.book_id, br.borrow_date, br.due_date, br.return_date, br.status, br.user_name, br.roll_no]);
    }
    console.log("Migrated " + borrows.length + " borrow records.");

    // Migrate creations
    const { rows: creations } = await oldClient.query(`SELECT * FROM creations`);
    for (const c of creations) {
        await newClient.query(`
            INSERT INTO creations (id, user_id, prompt, content, type, publish, likes, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (id) DO NOTHING
        `, [c.id, c.user_id, c.prompt, c.content, c.type, c.publish, c.likes, c.created_at, c.updated_at]);
    }
    
    // Set sequence to max id for creations since we force-inserted serial IDs
    if (creations.length > 0) {
        await newClient.query("SELECT setval('creations_id_seq', (SELECT MAX(id) FROM creations))");
    }
    console.log("Migrated " + creations.length + " creations.");

    console.log("Migration complete!");
    await oldClient.end();
    await newClient.end();
}

migrate().catch(console.error);
