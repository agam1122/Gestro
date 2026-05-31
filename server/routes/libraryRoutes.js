import express from 'express';
import { requireAuth } from '@clerk/express';
import upload from '../configs/multer.js';
import {
    getBooks,
    getBookById,
    borrowBook,
    returnBook,
    getMyBooks,
    addBook,
    updateBook,
    deleteBook,
    getAllTransactions,
    approveBorrow,
    rejectBorrow,
    approveReturn
} from '../controllers/libraryController.js';

const libraryRouter = express.Router();

// Public / User Routes
libraryRouter.get('/books', getBooks);
libraryRouter.get('/books/:id', getBookById);

// Protected User Routes
libraryRouter.post('/borrow', requireAuth(), borrowBook);
libraryRouter.post('/return', requireAuth(), returnBook);
libraryRouter.get('/my-books', requireAuth(), getMyBooks);

// Admin Routes (protected by isAdmin in controller)
libraryRouter.post('/admin/books', requireAuth(), upload.single('coverImage'), addBook);
libraryRouter.put('/admin/books/:id', requireAuth(), upload.single('coverImage'), updateBook);
libraryRouter.delete('/admin/books/:id', requireAuth(), deleteBook);
libraryRouter.get('/admin/transactions', requireAuth(), getAllTransactions);

libraryRouter.post('/admin/approve-borrow', requireAuth(), approveBorrow);
libraryRouter.post('/admin/reject-borrow', requireAuth(), rejectBorrow);
libraryRouter.post('/admin/approve-return', requireAuth(), approveReturn);

export default libraryRouter;
