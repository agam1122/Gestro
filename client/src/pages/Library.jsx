import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import { useAuth, useUser } from '@clerk/clerk-react';
import { Search, BookOpen, Clock, Loader2, Sparkles, BookMarked, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

const Library = () => {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedBook, setSelectedBook] = useState(null);
  const [borrowing, setBorrowing] = useState(false);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [studentName, setStudentName] = useState('');
  const [rollNo, setRollNo] = useState('');
  const { getToken } = useAuth();
  const { user } = useUser();
  const navigate = useNavigate();

  const userEmail = user?.primaryEmailAddress?.emailAddress;
  const isAdmin = userEmail === import.meta.env.VITE_ADMIN_EMAIL || userEmail === import.meta.env.VITE_LIBRARIAN_EMAIL;

  const fetchBooks = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`/api/library/books?search=${search}`);
      if (data.success) {
        setBooks(data.books);
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error('Failed to load books');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBooks();
  }, [search]);

  const handleBorrow = async () => {
    if (!selectedBook) return;
    setBorrowing(true);
    try {
      const token = await getToken();
      if (!token) {
        toast.error('Please login to borrow books');
        return;
      }
      
      const { data } = await axios.post(
        '/api/library/borrow',
        { bookId: selectedBook.id, userName: studentName, rollNo },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (data.success) {
        toast.success(data.message);
        setSelectedBook(null);
        setShowRequestForm(false);
        setStudentName('');
        setRollNo('');
        fetchBooks(); // Refresh book list
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to borrow book');
    } finally {
      setBorrowing(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className='flex flex-col h-full bg-transparent overflow-y-auto p-4 md:p-8 text-white'
    >
      {/* Header */}
      <div className='flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4'>
        <div>
          <h1 className='text-2xl md:text-3xl font-bold text-white flex items-center gap-2'>
            <BookMarked className='w-8 h-8 text-blue-400 drop-shadow-[0_0_10px_rgba(96,165,250,0.8)]' />
            Digital Library
          </h1>
          <p className='text-slate-400 mt-1 text-sm md:text-base'>
            Browse and borrow from our extensive collection of books.
          </p>
        </div>
        <div className='flex gap-3'>
          {isAdmin && (
            <button 
              onClick={() => navigate('/ai/library/admin')}
              className='px-4 py-2 bg-slate-800 text-white rounded-xl hover:bg-slate-700 transition-colors shadow-lg flex items-center gap-2 font-medium border border-white/10'
            >
              <ShieldAlert className='w-4 h-4 text-red-400' /> Admin Panel
            </button>
          )}
          <button 
            onClick={() => navigate('/ai/library/my-books')}
            className='px-4 py-2 bg-white/5 border border-white/10 text-slate-300 rounded-xl hover:bg-white/10 transition-colors shadow-lg flex items-center gap-2 font-medium backdrop-blur-md'
          >
            <BookOpen className='w-4 h-4 text-emerald-400' /> My Bookshelf
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className='relative max-w-xl w-full mb-8'>
        <div className='absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none'>
          <Search className='h-5 w-5 text-slate-400' />
        </div>
        <input
          type='text'
          placeholder='Search books by title or author...'
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className='block w-full pl-10 pr-3 py-3 border border-white/10 rounded-2xl leading-5 bg-black/20 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all shadow-lg backdrop-blur-md'
        />
      </div>

      {/* Books Grid */}
      {loading ? (
        <div className='flex-1 flex justify-center items-center'>
          <Loader2 className='w-8 h-8 text-blue-400 animate-spin' />
        </div>
      ) : books.length === 0 ? (
        <motion.div initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} className='flex-1 flex flex-col items-center justify-center text-slate-500 py-12'>
          <BookOpen className='w-16 h-16 text-slate-600 mb-4 opacity-50' />
          <h3 className='text-lg font-semibold text-slate-400'>No books found</h3>
          <p className='text-sm mt-1'>Try adjusting your search terms.</p>
        </motion.div>
      ) : (
        <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6'>
          {books.map((book, index) => (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
              key={book.id}
              onClick={() => setSelectedBook(book)}
              className='bg-white/5 rounded-2xl border border-white/10 overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 cursor-pointer group flex flex-col h-full transform hover:-translate-y-1 backdrop-blur-xl'
            >
              <div className='relative aspect-[2/3] w-full overflow-hidden bg-black/40'>
                {book.cover_image_url ? (
                  <img 
                    src={book.cover_image_url} 
                    alt={book.title}
                    className='w-full h-full object-cover group-hover:scale-105 transition-transform duration-500'
                  />
                ) : (
                  <div className='w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900 text-slate-500'>
                    <BookOpen className='w-12 h-12 opacity-30' />
                  </div>
                )}
                {/* Availability Badge */}
                <div className='absolute top-3 right-3'>
                  <span className={`px-2.5 py-1 text-xs font-bold rounded-full backdrop-blur-md border shadow-lg ${book.available_copies > 0 ? 'bg-emerald-500/80 text-white border-emerald-400/50' : 'bg-red-500/80 text-white border-red-400/50'}`}>
                    {book.available_copies > 0 ? 'Available' : 'Borrowed'}
                  </span>
                </div>
              </div>
              <div className='p-4 flex flex-col flex-1'>
                <h3 className='font-bold text-white line-clamp-1 mb-1 group-hover:text-blue-400 transition-colors drop-shadow-sm'>
                  {book.title}
                </h3>
                <p className='text-sm text-slate-400 mb-3'>{book.author}</p>
                <div className='mt-auto flex items-center justify-between text-xs font-medium text-slate-500'>
                  <span className="bg-black/20 px-2 py-1 rounded-md border border-white/5">{book.category || 'General'}</span>
                  <span>{book.available_copies}/{book.total_copies} left</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Book Details Modal */}
      {selectedBook && (
        <div className='fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4'>
          <motion.div initial={{scale:0.95, opacity:0}} animate={{scale:1, opacity:1}} className='bg-slate-900 border border-white/10 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl'>
            <div className='flex flex-col md:flex-row'>
              {/* Cover */}
              <div className='w-full md:w-1/3 bg-black/40 relative border-r border-white/10'>
                {selectedBook.cover_image_url ? (
                  <img src={selectedBook.cover_image_url} alt={selectedBook.title} className='w-full h-full object-cover aspect-[2/3] md:aspect-auto' />
                ) : (
                  <div className='w-full aspect-[2/3] md:h-full flex items-center justify-center text-slate-600'>
                    <BookOpen className='w-16 h-16 opacity-30' />
                  </div>
                )}
              </div>
              
              {/* Details */}
              <div className='w-full md:w-2/3 p-6 md:p-8 flex flex-col bg-slate-900/50'>
                <div className='flex justify-between items-start mb-2'>
                  <h2 className='text-2xl font-bold text-white leading-tight drop-shadow-md'>{selectedBook.title}</h2>
                  <button 
                    onClick={() => {
                        setSelectedBook(null);
                        setShowRequestForm(false);
                        setStudentName('');
                        setRollNo('');
                    }}
                    className='text-slate-400 hover:text-white p-1 bg-white/5 hover:bg-white/10 rounded-full transition-colors border border-white/5'
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                  </button>
                </div>
                
                <p className='text-lg text-slate-300 mb-6'>By {selectedBook.author}</p>
                
                <div className='flex flex-wrap gap-2 mb-6'>
                  <span className='px-3 py-1 bg-blue-500/20 border border-blue-500/30 text-blue-300 text-xs font-semibold rounded-lg shadow-[0_0_10px_rgba(59,130,246,0.2)]'>{selectedBook.category || 'General'}</span>
                  {selectedBook.isbn && <span className='px-3 py-1 bg-white/10 border border-white/10 text-slate-300 text-xs font-semibold rounded-lg'>ISBN: {selectedBook.isbn}</span>}
                </div>

                {showRequestForm ? (
                  <div className='flex-1 border-t border-white/10 pt-6 mb-6'>
                    <h3 className='font-bold text-white mb-4'>Student Details</h3>
                    <div className='space-y-4'>
                      <div>
                        <label className='block text-sm font-medium text-slate-300 mb-1'>Full Name *</label>
                        <input required type="text" value={studentName} onChange={e => setStudentName(e.target.value)}
                          className='w-full px-4 py-2.5 bg-black/20 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all' />
                      </div>
                      <div>
                        <label className='block text-sm font-medium text-slate-300 mb-1'>Roll Number *</label>
                        <input required type="text" value={rollNo} onChange={e => setRollNo(e.target.value)}
                          className='w-full px-4 py-2.5 bg-black/20 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all' />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className='prose prose-sm text-slate-400 mb-8 flex-1 overflow-y-auto max-h-48'>
                    <p>{selectedBook.description || 'No description available for this book.'}</p>
                  </div>
                )}

                <div className='mt-auto flex items-center justify-between pt-6 border-t border-white/10'>
                  <div className='flex flex-col'>
                    <span className='text-sm text-slate-400'>Availability</span>
                    <span className={`font-bold ${selectedBook.available_copies > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {selectedBook.available_copies} of {selectedBook.total_copies} copies
                    </span>
                  </div>
                  
                  <div className='flex gap-3'>
                    {showRequestForm && (
                        <button
                          onClick={() => setShowRequestForm(false)}
                          className='px-6 py-3 bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 rounded-xl font-semibold transition-colors'
                        >
                          Cancel
                        </button>
                    )}
                    <button
                      onClick={() => {
                        if (!showRequestForm) {
                            setShowRequestForm(true);
                        } else {
                            handleBorrow();
                        }
                      }}
                      disabled={selectedBook.available_copies <= 0 || borrowing || (showRequestForm && (!studentName || !rollNo))}
                      className={`px-8 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all shadow-lg ${
                        selectedBook.available_copies > 0 
                          ? 'bg-gradient-to-r from-blue-600 to-cyan-500 hover:scale-[1.02] active:scale-95 text-white shadow-[0_0_15px_rgba(59,130,246,0.4)]' 
                          : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-white/5'
                      }`}
                    >
                      {borrowing ? <Loader2 className='w-5 h-5 animate-spin' /> : <Sparkles className='w-5 h-5' />}
                      {selectedBook.available_copies > 0 ? (showRequestForm ? 'Submit Request' : 'Request to Borrow') : 'Out of Stock'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
};

export default Library;
