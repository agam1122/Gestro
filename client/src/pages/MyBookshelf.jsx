import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import { useAuth } from '@clerk/clerk-react';
import { BookOpen, Clock, Loader2, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

const MyBookshelf = () => {
  const [activeBorrows, setActiveBorrows] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [returningId, setReturningId] = useState(null);
  const { getToken } = useAuth();
  const navigate = useNavigate();

  const fetchMyBooks = async () => {
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) return;

      const { data } = await axios.get('/api/library/my-books', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (data.success) {
        setActiveBorrows(data.active);
        setHistory(data.history);
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error('Failed to load your bookshelf');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyBooks();
  }, []);

  const handleReturn = async (recordId) => {
    setReturningId(recordId);
    try {
      const token = await getToken();
      const { data } = await axios.post(
        '/api/library/return',
        { recordId },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (data.success) {
        toast.success(data.message);
        fetchMyBooks(); // Refresh list
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error('Failed to return book');
    } finally {
      setReturningId(null);
    }
  };

  const isOverdue = (dueDate) => {
    return new Date(dueDate) < new Date();
  };

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
          <BookOpen className='w-8 h-8 text-blue-400 drop-shadow-[0_0_10px_rgba(96,165,250,0.8)]' />
          My Bookshelf
        </h1>
        <p className='text-slate-400 mt-1 text-sm md:text-base'>
          Manage your currently borrowed books and viewing history.
        </p>
      </div>

      {loading ? (
        <div className='flex-1 flex justify-center items-center'>
          <Loader2 className='w-8 h-8 text-blue-400 animate-spin' />
        </div>
      ) : (
        <div className='flex flex-col gap-12'>
          {/* Active Borrows */}
          <section>
            <h2 className='text-xl font-bold text-white mb-6 flex items-center gap-2'>
              Currently Reading
              <span className='bg-blue-500/20 border border-blue-500/30 text-blue-400 px-2.5 py-0.5 rounded-full text-sm'>{activeBorrows.length}</span>
            </h2>
            
            {activeBorrows.length === 0 ? (
              <motion.div initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} className='bg-white/5 rounded-2xl border border-white/10 border-dashed backdrop-blur-md p-12 text-center'>
                <BookOpen className='w-12 h-12 text-slate-600 mx-auto mb-4 opacity-50' />
                <p className='text-slate-400 font-medium'>You have no active borrowed books.</p>
                <button 
                  onClick={() => navigate('/ai/library')}
                  className='mt-4 text-blue-400 hover:text-blue-300 hover:underline font-medium transition-colors'
                >
                  Browse Library
                </button>
              </motion.div>
            ) : (
              <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'>
                {activeBorrows.map((record, index) => {
                  const overdue = isOverdue(record.due_date);
                  return (
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: index * 0.1 }}
                      key={record.id} 
                      className={`bg-white/5 backdrop-blur-xl rounded-2xl border ${overdue ? 'border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : 'border-white/10 shadow-lg'} p-5 flex flex-col relative overflow-hidden`}
                    >
                      {overdue && (
                        <div className='absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-red-500 to-rose-600'></div>
                      )}
                      
                      <div className='flex gap-4 mb-4'>
                        <div className='w-20 h-28 bg-black/40 rounded-lg overflow-hidden flex-shrink-0 border border-white/10'>
                          {record.cover_image_url ? (
                            <img src={record.cover_image_url} alt={record.title} className='w-full h-full object-cover' />
                          ) : (
                            <BookOpen className='w-8 h-8 m-auto text-slate-500 h-full opacity-50' />
                          )}
                        </div>
                        <div className='flex-1 flex flex-col'>
                          <h3 className='font-bold text-white line-clamp-2 drop-shadow-sm'>{record.title}</h3>
                          <p className='text-sm text-slate-400 mt-1'>{record.author}</p>
                        </div>
                      </div>

                      <div className={`mt-auto p-3 rounded-xl mb-4 text-sm flex items-start gap-2 border ${overdue ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-black/20 border-white/5 text-slate-300'}`}>
                        {record.status === 'pending_borrow' ? (
                            <div className='flex items-center gap-2 font-medium text-amber-400 w-full'>
                                <Clock className='w-4 h-4' /> Awaiting Admin Approval
                            </div>
                        ) : (
                            <>
                            {overdue ? <AlertCircle className='w-4 h-4 mt-0.5 flex-shrink-0' /> : <Clock className='w-4 h-4 mt-0.5 flex-shrink-0' />}
                            <div>
                              <p className='font-semibold'>Due Date</p>
                              <p>{record.due_date ? new Date(record.due_date).toLocaleDateString() : 'N/A'}</p>
                              {overdue && <p className='text-xs mt-1 font-bold'>OVERDUE</p>}
                            </div>
                            </>
                        )}
                      </div>

                      {record.status === 'pending_return' ? (
                          <button disabled className='w-full py-2.5 bg-white/10 text-slate-400 rounded-xl font-medium flex items-center justify-center gap-2 border border-white/5'>
                              <Clock className='w-4 h-4' /> Return Pending
                          </button>
                      ) : record.status === 'pending_borrow' ? (
                          <button disabled className='w-full py-2.5 bg-amber-500/20 text-amber-500 rounded-xl font-medium flex items-center justify-center gap-2 border border-amber-500/30'>
                              <Clock className='w-4 h-4' /> Borrow Pending
                          </button>
                      ) : (
                          <button
                            onClick={() => handleReturn(record.id)}
                            disabled={returningId === record.id}
                            className='w-full py-2.5 bg-gradient-to-r from-slate-800 to-slate-700 hover:from-slate-700 hover:to-slate-600 border border-white/10 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg'
                          >
                            {returningId === record.id ? <Loader2 className='w-4 h-4 animate-spin' /> : <CheckCircle2 className='w-4 h-4' />}
                            Request Return
                          </button>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}
          </section>

          {/* History */}
          {history.length > 0 && (
            <motion.section initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} transition={{delay: 0.2}}>
              <h2 className='text-xl font-bold text-white mb-6'>Borrowing History</h2>
              <div className='bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden shadow-lg'>
                <div className='overflow-x-auto'>
                  <table className='w-full text-left border-collapse'>
                    <thead>
                      <tr className='bg-black/40 border-b border-white/10 text-slate-400 text-sm'>
                        <th className='px-6 py-4 font-medium'>Book</th>
                        <th className='px-6 py-4 font-medium'>Borrowed On</th>
                        <th className='px-6 py-4 font-medium'>Returned On</th>
                        <th className='px-6 py-4 font-medium'>Status</th>
                      </tr>
                    </thead>
                    <tbody className='divide-y divide-white/5'>
                      {history.map(record => (
                        <tr key={record.id} className='hover:bg-white/5 transition-colors'>
                          <td className='px-6 py-4'>
                            <div className='flex items-center gap-3'>
                              <div className='w-8 h-12 bg-black/40 border border-white/5 rounded overflow-hidden flex-shrink-0'>
                                {record.cover_image_url ? (
                                  <img src={record.cover_image_url} alt={record.title} className='w-full h-full object-cover' />
                                ) : (
                                  <BookOpen className='w-4 h-4 m-auto text-slate-600 h-full opacity-50' />
                                )}
                              </div>
                              <div>
                                <p className='font-semibold text-white drop-shadow-sm'>{record.title}</p>
                                <p className='text-xs text-slate-400'>{record.author}</p>
                              </div>
                            </div>
                          </td>
                          <td className='px-6 py-4 text-sm text-slate-300'>
                            {new Date(record.borrow_date).toLocaleDateString()}
                          </td>
                          <td className='px-6 py-4 text-sm text-slate-300'>
                            {record.return_date ? new Date(record.return_date).toLocaleDateString() : '-'}
                          </td>
                          <td className='px-6 py-4'>
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${record.status === 'rejected' ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'}`}>
                              {record.status === 'rejected' ? <AlertCircle className='w-3 h-3' /> : <CheckCircle2 className='w-3 h-3' />} 
                              {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.section>
          )}
        </div>
      )}
    </motion.div>
  );
};

export default MyBookshelf;
