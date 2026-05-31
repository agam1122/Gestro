import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth, useUser } from '@clerk/clerk-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { School, Plus, LogIn, Users, Loader2, ArrowRight } from 'lucide-react';

const Classrooms = () => {
  const { getToken } = useAuth();
  const { user } = useUser();
  const navigate = useNavigate();
  
  const [classrooms, setClassrooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isTeacher, setIsTeacher] = useState(false);
  
  // Forms state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [className, setClassName] = useState('');
  const [subject, setSubject] = useState('');
  
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchClassrooms();
  }, []);

  const fetchClassrooms = async () => {
    try {
      const token = await getToken();
      const { data } = await axios.get('/api/classrooms/my-classes', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (data.success) {
        setClassrooms(data.data);
        setIsTeacher(data.isTeacher);
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error('Failed to fetch classrooms');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateClass = async (e) => {
    e.preventDefault();
    if (!className.trim() || !subject.trim()) return;
    
    setActionLoading(true);
    try {
      const token = await getToken();
      const { data } = await axios.post('/api/classrooms/create', 
        { name: className, subject },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (data.success) {
        toast.success(data.message);
        setClassrooms([data.data, ...classrooms]);
        setShowCreateModal(false);
        setClassName('');
        setSubject('');
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create classroom');
    } finally {
      setActionLoading(false);
    }
  };

  const handleJoinClass = async (e) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    
    setActionLoading(true);
    try {
      const token = await getToken();
      const { data } = await axios.post('/api/classrooms/join', 	
        { inviteCode },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (data.success) {
        toast.success(data.message);
        setClassrooms([data.data, ...classrooms]);
        setShowJoinModal(false);
        setInviteCode('');
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to join classroom');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-full overflow-y-auto bg-transparent text-white p-6 md:p-8"
    >
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <School className="w-8 h-8 text-blue-400 drop-shadow-[0_0_10px_rgba(96,165,250,0.8)]" />
              My Classrooms
            </h1>
            <p className="text-slate-400 mt-1">Manage and access all your digital classrooms</p>
          </div>
          
          {!loading && (
            <div>
              {isTeacher ? (
                <button 
                  onClick={() => setShowCreateModal(true)}
                  className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:scale-[1.02] active:scale-95 text-white px-5 py-2.5 rounded-xl font-semibold flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(59,130,246,0.4)]"
                >
                  <Plus className="w-5 h-5" /> Create Class
                </button>
              ) : (
                <button 
                  onClick={() => setShowJoinModal(true)}
                  className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:scale-[1.02] active:scale-95 text-white px-5 py-2.5 rounded-xl font-semibold flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(99,102,241,0.4)]"
                >
                  <LogIn className="w-5 h-5" /> Join Class
                </button>
              )}
            </div>
          )}
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Loader2 className="w-10 h-10 animate-spin text-blue-400 mb-4" />
            <p>Loading classrooms...</p>
          </div>
        ) : (
          /* Classrooms Grid */
          <>
            {classrooms.length === 0 ? (
              <motion.div initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-3xl p-12 text-center shadow-lg">
                <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-5 shadow-[0_0_15px_rgba(59,130,246,0.3)]">
                  <School className="w-10 h-10 text-blue-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">No Classrooms Yet</h3>
                <p className="text-slate-400 max-w-md mx-auto mb-6">
                  {isTeacher 
                    ? "You haven't created any classrooms yet. Create one to invite your students!" 
                    : "You haven't joined any classrooms yet. Ask your teacher for an invite code!"}
                </p>
                {isTeacher ? (
                  <button onClick={() => setShowCreateModal(true)} className="text-blue-400 font-semibold hover:text-blue-300 transition-colors">Create your first class</button>
                ) : (
                  <button onClick={() => setShowJoinModal(true)} className="text-indigo-400 font-semibold hover:text-indigo-300 transition-colors">Join your first class</button>
                )}
              </motion.div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {classrooms.map((cls, index) => (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: index * 0.1 }}
                    key={cls.id} 
                    onClick={() => navigate(`/ai/classrooms/${cls.id}`)}
                    className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl overflow-hidden hover:bg-white/10 transition-colors cursor-pointer group flex flex-col h-full shadow-lg"
                  >
                    <div className="h-24 bg-gradient-to-r from-blue-600/50 to-indigo-600/50 p-5 relative overflow-hidden border-b border-white/10">
                      <div className="absolute right-0 top-0 opacity-20 transform translate-x-4 -translate-y-4">
                        <School className="w-32 h-32 text-white" />
                      </div>
                      <h3 className="text-xl font-bold text-white relative z-10 line-clamp-1 drop-shadow-md">{cls.name}</h3>
                      <p className="text-blue-200 relative z-10 text-sm line-clamp-1">{cls.subject}</p>
                    </div>
                    
                    <div className="p-5 flex-1 flex flex-col justify-between">
                      <div>
                        <p className="text-sm text-slate-300 flex items-center gap-2 mb-1">
                          <Users className="w-4 h-4 text-slate-400" /> {isTeacher ? "Your Class" : `Teacher: ${cls.teacher_name}`}
                        </p>
                      </div>
                      
                      <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4">
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                          {isTeacher ? `Code: ${cls.invite_code}` : "Enrolled"}
                        </span>
                        <div className="w-8 h-8 rounded-full bg-white/5 text-slate-300 flex items-center justify-center group-hover:bg-blue-500/20 group-hover:text-blue-400 transition-colors border border-white/10">
                          <ArrowRight className="w-4 h-4" />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Modals */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <motion.div initial={{scale:0.95, opacity:0}} animate={{scale:1, opacity:1}} className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-md p-6 shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-2">Create Classroom</h2>
            <p className="text-slate-400 mb-6 text-sm">Set up a new space for your students.</p>
            
            <form onSubmit={handleCreateClass} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Class Name *</label>
                <input 
                  required type="text" value={className} onChange={e => setClassName(e.target.value)}
                  placeholder="e.g. Computer Science 101"
                  className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl focus:border-blue-500/50 outline-none text-white transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Subject</label>
                <input 
                  required type="text" value={subject} onChange={e => setSubject(e.target.value)}
                  placeholder="e.g. Technology"
                  className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl focus:border-blue-500/50 outline-none text-white transition-colors"
                />
              </div>
              <div className="flex gap-3 mt-6 pt-4 border-t border-white/10">
                <button type="button" onClick={() => setShowCreateModal(false)} className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-slate-300 font-semibold rounded-xl transition-colors">Cancel</button>
                <button type="submit" disabled={actionLoading} className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-cyan-500 hover:scale-[1.02] active:scale-95 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 shadow-[0_0_10px_rgba(59,130,246,0.4)]">
                  {actionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {showJoinModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <motion.div initial={{scale:0.95, opacity:0}} animate={{scale:1, opacity:1}} className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-md p-6 shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-2">Join Classroom</h2>
            <p className="text-slate-400 mb-6 text-sm">Enter the invite code provided by your teacher.</p>
            
            <form onSubmit={handleJoinClass} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Invite Code *</label>
                <input 
                  required type="text" value={inviteCode} onChange={e => setInviteCode(e.target.value)}
                  placeholder="e.g. CS-101-X7"
                  className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl focus:border-indigo-500/50 outline-none text-white transition-colors font-mono uppercase"
                />
              </div>
              <div className="flex gap-3 mt-6 pt-4 border-t border-white/10">
                <button type="button" onClick={() => setShowJoinModal(false)} className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-slate-300 font-semibold rounded-xl transition-colors">Cancel</button>
                <button type="submit" disabled={actionLoading} className="flex-1 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:scale-[1.02] active:scale-95 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 shadow-[0_0_10px_rgba(99,102,241,0.4)]">
                  {actionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Join'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
};

export default Classrooms;
