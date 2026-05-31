import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import { useAuth, useUser } from '@clerk/clerk-react';
import { ShieldAlert, BookPlus, Loader2, UploadCloud, Users, Library, ArrowLeft, Lock, CheckCircle2, XCircle, Settings, Pencil, Trash2, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

const LibraryAdmin = () => {
  const [activeTab, setActiveTab] = useState('manage'); // 'add', 'transactions', 'manage'
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [books, setBooks] = useState([]);
  const [booksLoading, setBooksLoading] = useState(false);
  const [editingBook, setEditingBook] = useState(null);
  const [catalogSearch, setCatalogSearch] = useState('');
  
  // Form State
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [isbn, setIsbn] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [totalCopies, setTotalCopies] = useState(1);
  const [coverImage, setCoverImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  const { getToken } = useAuth();
  const { user } = useUser();
  const navigate = useNavigate();

  const userEmail = user?.primaryEmailAddress?.emailAddress;
  const isAdmin = userEmail === import.meta.env.VITE_ADMIN_EMAIL || userEmail === import.meta.env.VITE_LIBRARIAN_EMAIL;

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setCoverImage(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const fetchCatalog = async () => {
    setBooksLoading(true);
    try {
      const { data } = await axios.get(`/api/library/books?search=${catalogSearch}`);
      if (data.success) {
        setBooks(data.books);
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error('Failed to load catalog');
    } finally {
      setBooksLoading(false);
    }
  };

  const handleDeleteBook = async (bookId) => {
    if (!window.confirm("Are you sure you want to delete this book?")) return;
    try {
      const token = await getToken();
      const { data } = await axios.delete(`/api/library/admin/books/${bookId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (data.success) {
        toast.success(data.message);
        fetchCatalog();
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete book');
    }
  };

  const startEditing = (book) => {
    setEditingBook(book);
    setTitle(book.title);
    setAuthor(book.author);
    setIsbn(book.isbn || '');
    setCategory(book.category || '');
    setDescription(book.description || '');
    setTotalCopies(book.total_copies);
    setPreviewUrl(book.cover_image_url || null);
    setCoverImage(null);
    setActiveTab('add'); // Reusing the add tab for editing
  };

  const cancelEditing = () => {
    setEditingBook(null);
    setTitle(''); setAuthor(''); setIsbn(''); setCategory('');
    setDescription(''); setTotalCopies(1); setCoverImage(null); setPreviewUrl(null);
  };

  const handleAddBook = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) return;

      const formData = new FormData();
      formData.append('title', title);
      formData.append('author', author);
      formData.append('isbn', isbn);
      formData.append('category', category);
      formData.append('description', description);
      formData.append('total_copies', totalCopies);
      if (coverImage) {
        formData.append('coverImage', coverImage);
      }

      const method = editingBook ? 'put' : 'post';
      const endpoint = editingBook 
        ? `/api/library/admin/books/${editingBook.id}`
        : '/api/library/admin/books';

      const { data } = await axios[method](
        endpoint,
        formData,
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' } }
      );

      if (data.success) {
        toast.success(data.message);
        if (editingBook) {
            cancelEditing();
            setActiveTab('manage');
        } else {
            // Reset form
            setTitle(''); setAuthor(''); setIsbn(''); setCategory('');
            setDescription(''); setTotalCopies(1); setCoverImage(null); setPreviewUrl(null);
        }
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to add book');
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async () => {
    setTransactionsLoading(true);
    try {
      const token = await getToken();
      const { data } = await axios.get(
        '/api/library/admin/transactions',
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (data.success) {
        setTransactions(data.transactions);
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load transactions');
    } finally {
      setTransactionsLoading(false);
    }
  };

  const handleAction = async (action, recordId) => {
    try {
      const token = await getToken();
      const endpoint = `/api/library/admin/${action}`;
      const { data } = await axios.post(
        endpoint,
        { recordId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (data.success) {
        toast.success(data.message);
        fetchTransactions();
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Action failed');
    }
  };

  useEffect(() => {
    if (activeTab === 'transactions' && isAdmin) {
      fetchTransactions();
    } else if (activeTab === 'manage' && isAdmin) {
      fetchCatalog();
    }
  }, [activeTab, isAdmin, catalogSearch]);

  if (!isAdmin) {
    return (
      <div className='flex flex-col h-full bg-[#F4F7FB] overflow-y-auto p-4 md:p-8 items-center justify-center'>
        <div className='bg-white p-8 rounded-3xl shadow-sm border border-slate-200 text-center max-w-md w-full'>
          <Lock className='w-16 h-16 text-red-500 mx-auto mb-4' />
          <h2 className='text-2xl font-bold text-slate-800 mb-2'>Access Denied</h2>
          <p className='text-slate-500 mb-6'>You do not have administrator privileges to access this page.</p>
          <button 
            onClick={() => navigate('/ai/library')}
            className='px-6 py-3 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors shadow-sm font-medium w-full flex items-center justify-center gap-2'
          >
            <ArrowLeft className='w-4 h-4' /> Return to Library
          </button>
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className='flex flex-col h-full bg-transparent overflow-y-auto p-4 md:p-8 text-white'
    >
      {/* Header */}
      <div className='mb-8'>
        <button 
          onClick={() => navigate('/ai/library')}
          className='text-slate-400 hover:text-white flex items-center gap-2 mb-4 transition-colors text-sm font-medium'
        >
          <ArrowLeft className='w-4 h-4' /> Back to Library
        </button>
        <h1 className='text-2xl md:text-3xl font-bold text-white flex items-center gap-2 drop-shadow-md'>
          <ShieldAlert className='w-8 h-8 text-red-400 drop-shadow-[0_0_10px_rgba(248,113,113,0.8)]' />
          Library Administration
        </h1>
        <p className='text-slate-400 mt-1 text-sm md:text-base'>
          Manage inventory, add new books, and oversee all borrowing activity.
        </p>
      </div>

      {/* Tabs */}
      <div className='flex flex-wrap gap-2 mb-8 bg-black/20 p-1 rounded-xl w-full sm:w-max shadow-lg border border-white/10 backdrop-blur-md'>
        <button
          onClick={() => { setActiveTab('manage'); cancelEditing(); }}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'manage' ? 'bg-white/10 text-white shadow-md border border-white/10' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
          }`}
        >
          <Settings className='w-4 h-4' /> Manage Catalog
        </button>
        <button
          onClick={() => { setActiveTab('add'); cancelEditing(); }}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'add' ? 'bg-white/10 text-white shadow-md border border-white/10' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
          }`}
        >
          <BookPlus className='w-4 h-4' /> {editingBook ? 'Edit Book' : 'Add New Book'}
        </button>
        <button
          onClick={() => { setActiveTab('transactions'); cancelEditing(); }}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'transactions' ? 'bg-white/10 text-white shadow-md border border-white/10' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
          }`}
        >
          <Users className='w-4 h-4' /> Borrowing Activity
        </button>
      </div>

      {/* Content */}
      {activeTab === 'manage' && (
        <motion.div initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} className='bg-white/5 rounded-3xl p-6 md:p-8 shadow-lg border border-white/10 backdrop-blur-xl'>
          <div className='flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4'>
            <h2 className='text-xl font-bold text-white'>Manage Catalog</h2>
            <div className='relative w-full md:w-64'>
              <div className='absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none'>
                <Search className='h-4 w-4 text-slate-400' />
              </div>
              <input
                type='text'
                placeholder='Search catalog...'
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                className='block w-full pl-9 pr-3 py-2 border border-white/10 rounded-xl text-sm leading-5 bg-black/20 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-shadow shadow-sm'
              />
            </div>
          </div>
          
          {booksLoading && books.length === 0 ? (
             <div className='flex justify-center py-12'><Loader2 className='w-8 h-8 text-blue-400 animate-spin' /></div>
          ) : books.length === 0 ? (
            <div className='text-center py-12 text-slate-400'>No books found.</div>
          ) : (
            <div className='overflow-x-auto'>
              <table className='w-full text-left border-collapse'>
                <thead>
                  <tr className='bg-black/40 border-b border-white/10 text-slate-400 text-sm'>
                    <th className='px-6 py-4 font-medium'>Book</th>
                    <th className='px-6 py-4 font-medium'>Category</th>
                    <th className='px-6 py-4 font-medium'>Available / Total</th>
                    <th className='px-6 py-4 font-medium'>Actions</th>
                  </tr>
                </thead>
                <tbody className='divide-y divide-white/5'>
                  {books.map(book => (
                    <tr key={book.id} className='hover:bg-white/5 transition-colors'>
                      <td className='px-6 py-4'>
                        <div className='flex items-center gap-3'>
                          {book.cover_image_url ? (
                            <img src={book.cover_image_url} alt={book.title} className='w-10 h-14 object-cover rounded shadow-sm border border-white/10' />
                          ) : (
                            <div className='w-10 h-14 bg-black/40 border border-white/5 rounded flex items-center justify-center'><Library className='w-4 h-4 text-slate-500'/></div>
                          )}
                          <div>
                            <p className='font-semibold text-white drop-shadow-sm'>{book.title}</p>
                            <p className='text-xs text-slate-400'>{book.author}</p>
                          </div>
                        </div>
                      </td>
                      <td className='px-6 py-4 text-sm text-slate-300'>
                        {book.category || 'N/A'}
                      </td>
                      <td className='px-6 py-4'>
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${book.available_copies > 0 ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}`}>
                          {book.available_copies} / {book.total_copies}
                        </span>
                      </td>
                      <td className='px-6 py-4'>
                        <div className='flex items-center gap-2'>
                          <button 
                            onClick={() => startEditing(book)}
                            className='p-2 bg-blue-500/20 text-blue-400 hover:bg-blue-500/40 border border-blue-500/30 rounded-lg transition-colors' 
                            title='Edit Book'
                          >
                            <Pencil className='w-4 h-4'/>
                          </button>
                          <button 
                            onClick={() => handleDeleteBook(book.id)}
                            className='p-2 bg-red-500/20 text-red-400 hover:bg-red-500/40 border border-red-500/30 rounded-lg transition-colors' 
                            title='Delete Book'
                          >
                            <Trash2 className='w-4 h-4'/>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      )}

      {activeTab === 'add' && (
        <motion.div initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} className='bg-white/5 rounded-3xl p-6 md:p-8 shadow-lg border border-white/10 max-w-4xl backdrop-blur-xl'>
          <div className='flex justify-between items-center mb-6'>
            <h2 className='text-xl font-bold text-white'>{editingBook ? 'Edit Book' : 'Add Book to Catalog'}</h2>
            {editingBook && (
                <button onClick={cancelEditing} className='text-sm text-slate-400 hover:text-white transition-colors'>Cancel Editing</button>
            )}
          </div>
          
          <form onSubmit={handleAddBook} className='grid grid-cols-1 md:grid-cols-2 gap-8'>
            {/* Left Column - Details */}
            <div className='space-y-5'>
              <div>
                <label className='block text-sm font-medium text-slate-300 mb-1'>Title *</label>
                <input required type="text" value={title} onChange={e => setTitle(e.target.value)}
                  className='w-full px-4 py-2.5 bg-black/20 text-white border border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500/50 outline-none transition-all' />
              </div>
              
              <div>
                <label className='block text-sm font-medium text-slate-300 mb-1'>Author *</label>
                <input required type="text" value={author} onChange={e => setAuthor(e.target.value)}
                  className='w-full px-4 py-2.5 bg-black/20 text-white border border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500/50 outline-none transition-all' />
              </div>

              <div className='grid grid-cols-2 gap-4'>
                <div>
                  <label className='block text-sm font-medium text-slate-300 mb-1'>ISBN</label>
                  <input type="text" value={isbn} onChange={e => setIsbn(e.target.value)}
                    className='w-full px-4 py-2.5 bg-black/20 text-white border border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500/50 outline-none transition-all' />
                </div>
                <div>
                  <label className='block text-sm font-medium text-slate-300 mb-1'>Category</label>
                  <input type="text" value={category} onChange={e => setCategory(e.target.value)} placeholder="e.g. Fiction"
                    className='w-full px-4 py-2.5 bg-black/20 text-white border border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500/50 outline-none transition-all placeholder:text-slate-500' />
                </div>
              </div>

              <div>
                <label className='block text-sm font-medium text-slate-300 mb-1'>Total Copies *</label>
                <input required type="number" min="1" value={totalCopies} onChange={e => setTotalCopies(e.target.value)}
                  onWheel={(e) => e.target.blur()}
                  className='w-full px-4 py-2.5 bg-black/20 text-white border border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500/50 outline-none transition-all' />
              </div>

              <div>
                <label className='block text-sm font-medium text-slate-300 mb-1'>Description</label>
                <textarea rows="4" value={description} onChange={e => setDescription(e.target.value)}
                  className='w-full px-4 py-2.5 bg-black/20 text-white border border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500/50 outline-none transition-all resize-none'></textarea>
              </div>
            </div>

            {/* Right Column - Image */}
            <div className='flex flex-col'>
              <label className='block text-sm font-medium text-slate-300 mb-1'>Cover Image</label>
              <div className='flex-1 border-2 border-dashed border-white/20 rounded-2xl bg-black/20 flex flex-col items-center justify-center p-6 relative overflow-hidden group hover:bg-white/5 transition-colors cursor-pointer'>
                <input type="file" accept="image/*" onChange={handleImageChange} className='absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10' />
                {previewUrl ? (
                  <img src={previewUrl} alt="Preview" className='w-full h-full object-contain' />
                ) : (
                  <div className='text-center flex flex-col items-center'>
                    <UploadCloud className='w-12 h-12 text-slate-500 mb-3 group-hover:text-blue-400 transition-colors' />
                    <p className='text-sm font-medium text-slate-400'>Click or drag to upload cover</p>
                    <p className='text-xs text-slate-500 mt-1'>PNG, JPG up to 5MB</p>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className='mt-8 w-full py-3.5 bg-gradient-to-r from-blue-600 to-cyan-500 hover:scale-[1.02] active:scale-95 text-white rounded-xl font-bold transition-all shadow-[0_0_15px_rgba(59,130,246,0.4)] flex items-center justify-center gap-2 cursor-pointer'
              >
                {loading ? <Loader2 className='w-5 h-5 animate-spin' /> : (editingBook ? <Pencil className='w-5 h-5' /> : <BookPlus className='w-5 h-5' />)}
                {loading ? (editingBook ? 'Saving...' : 'Adding Book...') : (editingBook ? 'Save Changes' : 'Add Book to Library')}
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {activeTab === 'transactions' && (
        <motion.div initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} className='bg-white/5 rounded-3xl p-6 md:p-8 shadow-lg border border-white/10 backdrop-blur-xl'>
          <h2 className='text-xl font-bold text-white mb-6'>All Transactions</h2>
          
          {transactionsLoading ? (
             <div className='flex justify-center py-12'><Loader2 className='w-8 h-8 text-blue-400 animate-spin' /></div>
          ) : transactions.length === 0 ? (
            <div className='text-center py-12 text-slate-400'>No transactions found.</div>
          ) : (
            <div className='overflow-x-auto'>
              <table className='w-full text-left border-collapse'>
                <thead>
                  <tr className='bg-black/40 border-b border-white/10 text-slate-400 text-sm'>
                    <th className='px-6 py-4 font-medium'>Student Details</th>
                    <th className='px-6 py-4 font-medium'>Book</th>
                    <th className='px-6 py-4 font-medium'>Borrowed On</th>
                    <th className='px-6 py-4 font-medium'>Due Date</th>
                    <th className='px-6 py-4 font-medium'>Status</th>
                  </tr>
                </thead>
                <tbody className='divide-y divide-white/5'>
                  {transactions.map(record => (
                    <tr key={record.id} className='hover:bg-white/5 transition-colors'>
                      <td className='px-6 py-4'>
                        {record.user_name ? (
                            <>
                                <p className='font-semibold text-white drop-shadow-sm'>{record.user_name}</p>
                                <p className='text-xs text-slate-400'>Roll: {record.roll_no}</p>
                            </>
                        ) : (
                            <span className='truncate w-32 block text-xs text-slate-500' title={record.user_id}>{record.user_id}</span>
                        )}
                      </td>
                      <td className='px-6 py-4'>
                        <p className='font-semibold text-white drop-shadow-sm'>{record.title}</p>
                        <p className='text-xs text-slate-400'>{record.author}</p>
                      </td>
                      <td className='px-6 py-4 text-sm text-slate-300'>
                        {new Date(record.borrow_date).toLocaleDateString()}
                      </td>
                      <td className='px-6 py-4 text-sm text-slate-300'>
                        {record.due_date ? new Date(record.due_date).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className='px-6 py-4'>
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${
                          record.status === 'borrowed' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                          record.status === 'returned' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                          record.status === 'pending_borrow' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                          record.status === 'pending_return' ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' :
                          'bg-red-500/20 text-red-400 border-red-500/30'
                        }`}>
                          {record.status.toUpperCase().replace('_', ' ')}
                        </span>
                        
                        {(record.status === 'pending_borrow' || record.status === 'pending_return') && (
                          <div className='flex items-center gap-2 mt-2'>
                            <button 
                              onClick={() => handleAction(record.status === 'pending_borrow' ? 'approve-borrow' : 'approve-return', record.id)} 
                              className='p-1.5 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/40 border border-emerald-500/30 rounded-lg transition-colors cursor-pointer' 
                              title='Approve'
                            >
                                <CheckCircle2 className='w-4 h-4'/>
                            </button>
                            {record.status === 'pending_borrow' && (
                                <button 
                                  onClick={() => handleAction('reject-borrow', record.id)} 
                                  className='p-1.5 bg-red-500/20 text-red-400 hover:bg-red-500/40 border border-red-500/30 rounded-lg transition-colors cursor-pointer' 
                                  title='Reject'
                                >
                                    <XCircle className='w-4 h-4'/>
                                </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      )}
    </motion.div>
  );
};

export default LibraryAdmin;
