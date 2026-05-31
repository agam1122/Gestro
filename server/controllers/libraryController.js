import sql from "../configs/db.js";
import { v2 as cloudinary } from "cloudinary";

import { clerkClient } from '@clerk/express';

// Helper function to check if the user is an admin
const isAdmin = async (req) => {
    try {
        const userId = req.auth?.userId;
        if (!userId) return { isAdmin: false, reason: "No user ID in auth" };
        
        // Fetch user details from Clerk
        const user = await clerkClient.users.getUser(userId);
        const email = user.emailAddresses[0]?.emailAddress;
        
        const adminEmail = process.env.ADMIN_EMAIL;
        const librarianEmail = process.env.LIBRARIAN_EMAIL;
        
        // Compare with admin or librarian email in env
        if (email && (email === adminEmail || email === librarianEmail)) {
            return { isAdmin: true };
        } else {
            return { isAdmin: false, reason: `Email mismatch. User: ${email}` };
        }
    } catch (error) {
        console.error("Admin check failed:", error);
        return { isAdmin: false, reason: `Clerk API Error: ${error.message}` };
    }
};


// Public/User Routes

export const getBooks = async (req, res) => {
    try {
        const { search, category } = req.query;
        let books;
        if (search && category) {
            books = await sql`SELECT * FROM books WHERE (title ILIKE ${'%' + search + '%'} OR author ILIKE ${'%' + search + '%'}) AND category = ${category} ORDER BY created_at DESC`;
        } else if (search) {
            books = await sql`SELECT * FROM books WHERE title ILIKE ${'%' + search + '%'} OR author ILIKE ${'%' + search + '%'} ORDER BY created_at DESC`;
        } else if (category) {
            books = await sql`SELECT * FROM books WHERE category = ${category} ORDER BY created_at DESC`;
        } else {
            books = await sql`SELECT * FROM books ORDER BY created_at DESC`;
        }
        res.json({ success: true, books });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: error.message });
    }
};

export const getBookById = async (req, res) => {
    try {
        const { id } = req.params;
        const books = await sql`SELECT * FROM books WHERE id = ${id}`;
        if (books.length === 0) {
            return res.json({ success: false, message: "Book not found" });
        }
        res.json({ success: true, book: books[0] });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: error.message });
    }
};

export const borrowBook = async (req, res) => {
    try {
        // req.auth is provided by Clerk middleware
        const userId = req.auth?.userId;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const { bookId, userName, rollNo } = req.body;

        if (!userName || !rollNo) {
            return res.json({ success: false, message: "Name and Roll Number are required" });
        }

        // Check if book exists and has available copies
        const books = await sql`SELECT * FROM books WHERE id = ${bookId}`;
        if (books.length === 0) {
            return res.json({ success: false, message: "Book not found" });
        }
        const book = books[0];
        
        if (book.available_copies <= 0) {
            return res.json({ success: false, message: "No copies available" });
        }

        // Check if user already borrowed this book and hasn't returned it
        const activeBorrows = await sql`SELECT * FROM borrow_records WHERE user_id = ${userId} AND book_id = ${bookId} AND status = 'borrowed'`;
        if (activeBorrows.length > 0) {
            return res.json({ success: false, message: "You have already borrowed this book" });
        }

        // Due date: 14 days from now
        // Create a pending borrow record
        // We do NOT decrease available_copies until the admin approves it.
        // Due date is not set until approved.
        await sql`INSERT INTO borrow_records (user_id, book_id, status, user_name, roll_no) VALUES (${userId}, ${bookId}, 'pending_borrow', ${userName}, ${rollNo})`;

        res.json({ success: true, message: "Borrow request submitted for admin approval" });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: error.message });
    }
};

export const returnBook = async (req, res) => {
    try {
        const userId = req.auth?.userId;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const { recordId } = req.body; // the id of the borrow_record

        const records = await sql`SELECT * FROM borrow_records WHERE id = ${recordId} AND user_id = ${userId} AND status = 'borrowed'`;
        if (records.length === 0) {
            return res.json({ success: false, message: "Active borrow record not found" });
        }
        const record = records[0];

        // Change status to pending_return, don't increment stock yet
        await sql`UPDATE borrow_records SET status = 'pending_return' WHERE id = ${recordId}`;

        res.json({ success: true, message: "Return request submitted for admin approval" });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: error.message });
    }
};

export const getMyBooks = async (req, res) => {
    try {
        const userId = req.auth?.userId;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        // Join with books table to get book details
        const records = await sql`
            SELECT br.*, b.title, b.author, b.cover_image_url 
            FROM borrow_records br
            JOIN books b ON br.book_id = b.id
            WHERE br.user_id = ${userId}
            ORDER BY br.borrow_date DESC
        `;

        // Separate into active and history
        const active = records.filter(r => r.status === 'borrowed' || r.status === 'overdue' || r.status === 'pending_borrow' || r.status === 'pending_return');
        const history = records.filter(r => r.status === 'returned' || r.status === 'rejected');

        res.json({ success: true, active, history });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: error.message });
    }
};

// Admin Routes

export const addBook = async (req, res) => {
    try {
        const adminCheck = await isAdmin(req);
        if (!adminCheck.isAdmin) return res.status(403).json({ success: false, message: adminCheck.reason });

        const { title, author, isbn, category, description, total_copies } = req.body;
        let cover_image_url = "";

        if (req.file) {
            const uploadResult = await cloudinary.uploader.upload(req.file.path, {
                folder: "library_covers"
            });
            cover_image_url = uploadResult.secure_url;
        }

        const copies = parseInt(total_copies) || 1;

        await sql`
            INSERT INTO books (title, author, isbn, category, description, cover_image_url, total_copies, available_copies)
            VALUES (${title}, ${author}, ${isbn}, ${category}, ${description}, ${cover_image_url}, ${copies}, ${copies})
        `;

        res.json({ success: true, message: "Book added successfully" });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: error.message });
    }
};

export const updateBook = async (req, res) => {
    try {
        const adminCheck = await isAdmin(req);
        if (!adminCheck.isAdmin) return res.status(403).json({ success: false, message: adminCheck.reason });

        const { id } = req.params;
        const { title, author, isbn, category, description, total_copies } = req.body;

        const books = await sql`SELECT * FROM books WHERE id = ${id}`;
        if (books.length === 0) return res.json({ success: false, message: "Book not found" });
        
        let cover_image_url = books[0].cover_image_url;

        if (req.file) {
            const uploadResult = await cloudinary.uploader.upload(req.file.path, {
                folder: "library_covers"
            });
            cover_image_url = uploadResult.secure_url;
        }

        const newTotal = parseInt(total_copies) || books[0].total_copies;
        // Calculate difference to adjust available_copies safely
        const diff = newTotal - books[0].total_copies;
        const newAvailable = books[0].available_copies + diff;

        if (newAvailable < 0) {
            return res.json({ success: false, message: "Cannot reduce total copies below currently borrowed amount" });
        }

        await sql`
            UPDATE books 
            SET title = ${title}, author = ${author}, isbn = ${isbn}, category = ${category}, 
                description = ${description}, cover_image_url = ${cover_image_url}, 
                total_copies = ${newTotal}, available_copies = ${newAvailable}
            WHERE id = ${id}
        `;

        res.json({ success: true, message: "Book updated successfully" });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: error.message });
    }
};

export const deleteBook = async (req, res) => {
    try {
        const adminCheck = await isAdmin(req);
        if (!adminCheck.isAdmin) return res.status(403).json({ success: false, message: adminCheck.reason });

        const { id } = req.params;
        
        // Check if there are active borrows
        const activeBorrows = await sql`SELECT * FROM borrow_records WHERE book_id = ${id} AND status = 'borrowed'`;
        if (activeBorrows.length > 0) {
            return res.json({ success: false, message: "Cannot delete book while there are active borrows" });
        }

        await sql`DELETE FROM books WHERE id = ${id}`;

        res.json({ success: true, message: "Book deleted successfully" });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: error.message });
    }
};

export const getAllTransactions = async (req, res) => {
    try {
        const adminCheck = await isAdmin(req);
        if (!adminCheck.isAdmin) return res.status(403).json({ success: false, message: adminCheck.reason });

        const records = await sql`
            SELECT br.*, b.title, b.author 
            FROM borrow_records br
            JOIN books b ON br.book_id = b.id
            ORDER BY br.borrow_date DESC
        `;

        res.json({ success: true, transactions: records });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: error.message });
    }
};

export const approveBorrow = async (req, res) => {
    try {
        const adminCheck = await isAdmin(req);
        if (!adminCheck.isAdmin) return res.status(403).json({ success: false, message: adminCheck.reason });

        const { recordId } = req.body;
        
        const records = await sql`SELECT * FROM borrow_records WHERE id = ${recordId} AND status = 'pending_borrow'`;
        if (records.length === 0) return res.json({ success: false, message: "Pending borrow request not found or already processed" });
        
        const record = records[0];

        // Atomically check and decrement stock
        const books = await sql`
            UPDATE books 
            SET available_copies = available_copies - 1 
            WHERE id = ${record.book_id} AND available_copies > 0
            RETURNING id
        `;
        if (books.length === 0) {
            return res.json({ success: false, message: "No available copies left to approve this request." });
        }

        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 14);

        await sql`UPDATE borrow_records SET status = 'borrowed', due_date = ${dueDate} WHERE id = ${recordId}`;

        res.json({ success: true, message: "Borrow request approved" });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: error.message });
    }
};

export const rejectBorrow = async (req, res) => {
    try {
        const adminCheck = await isAdmin(req);
        if (!adminCheck.isAdmin) return res.status(403).json({ success: false, message: adminCheck.reason });

        const { recordId } = req.body;
        
        const updateResult = await sql`
            UPDATE borrow_records SET status = 'rejected' 
            WHERE id = ${recordId} AND status = 'pending_borrow'
            RETURNING id
        `;
        
        if (updateResult.length === 0) {
            return res.json({ success: false, message: "Pending borrow request not found or already processed" });
        }

        res.json({ success: true, message: "Borrow request rejected" });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: error.message });
    }
};

export const approveReturn = async (req, res) => {
    try {
        const adminCheck = await isAdmin(req);
        if (!adminCheck.isAdmin) return res.status(403).json({ success: false, message: adminCheck.reason });

        const { recordId } = req.body;
        
        // Atomically update status
        const updateResult = await sql`
            UPDATE borrow_records 
            SET status = 'returned', return_date = CURRENT_TIMESTAMP 
            WHERE id = ${recordId} AND status = 'pending_return'
            RETURNING book_id
        `;
        
        if (updateResult.length === 0) {
            return res.json({ success: false, message: "Pending return request not found or already processed" });
        }
        
        // Atomically increment stock, capped at total_copies
        await sql`
            UPDATE books 
            SET available_copies = LEAST(available_copies + 1, total_copies) 
            WHERE id = ${updateResult[0].book_id}
        `;

        res.json({ success: true, message: "Return request approved" });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: error.message });
    }
};
