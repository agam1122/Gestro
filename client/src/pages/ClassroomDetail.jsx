import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth, useUser } from '@clerk/clerk-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { ArrowLeft, Users, School, Copy, Check, Loader2, Send, Pencil, X, Paperclip, Download, FileText, Trash2, BotMessageSquare, MessageSquareText } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const ClassroomDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const { user } = useUser();
  
  const [classroom, setClassroom] = useState(null);
  const [isTeacher, setIsTeacher] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [newPostContent, setNewPostContent] = useState('');
  const [posting, setPosting] = useState(false);
  const [editingPostId, setEditingPostId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [attachmentFile, setAttachmentFile] = useState(null);

  const [tutorOpen, setTutorOpen] = useState(false);
  const [tutorMessages, setTutorMessages] = useState([]);
  const [tutorInput, setTutorInput] = useState('');
  const [tutorLoading, setTutorLoading] = useState(false);

  useEffect(() => {
    fetchClassroom();
  }, [id]);

  const fetchClassroom = async () => {
    try {
      const token = await getToken();
      const { data } = await axios.get(`/api/classrooms/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (data.success) {
        setClassroom(data.data);
        setIsTeacher(data.isTeacher);
      } else {
        toast.error(data.message);
        navigate('/ai/classrooms');
      }
    } catch (error) {
      toast.error('Failed to fetch classroom details');
      navigate('/ai/classrooms');
    } finally {
      setLoading(false);
    }
  };

  const copyInviteCode = () => {
    if (!classroom?.invite_code) return;
    navigator.clipboard.writeText(classroom.invite_code);
    setCopied(true);
    toast.success("Invite code copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!newPostContent.trim()) return;
    
    setPosting(true);
    try {
      const token = await getToken();
      
      const formData = new FormData();
      formData.append('content', newPostContent);
      if (attachmentFile) {
        formData.append('file', attachmentFile);
      }

      const { data } = await axios.post(`/api/classrooms/${id}/posts`, 
        formData,
        { 
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          } 
        }
      );
      
      if (data.success) {
        toast.success("Post created!");
        setClassroom(prev => ({
          ...prev,
          posts: [data.data, ...(prev.posts || [])]
        }));
        setNewPostContent('');
        setAttachmentFile(null);
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error('Failed to create post');
    } finally {
      setPosting(false);
    }
  };

  const startEditing = (post) => {
    setEditingPostId(post.id);
    setEditContent(post.content);
  };

  const handleUpdatePost = async (e, postId) => {
    e.preventDefault();
    if (!editContent.trim()) return;

    setSavingEdit(true);
    try {
      const token = await getToken();
      const { data } = await axios.put(`/api/classrooms/posts/${postId}`, 
        { content: editContent },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (data.success) {
        toast.success("Post updated!");
        setClassroom(prev => ({
          ...prev,
          posts: prev.posts.map(p => p.id === postId ? { ...p, content: editContent } : p)
        }));
        setEditingPostId(null);
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error('Failed to update post');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeletePost = async (postId) => {
    if (!window.confirm("Are you sure you want to delete this post?")) return;
    
    try {
      const token = await getToken();
      const { data } = await axios.delete(`/api/classrooms/posts/${postId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (data.success) {
        toast.success("Post deleted");
        setClassroom(prev => ({
          ...prev,
          posts: prev.posts.filter(p => p.id !== postId)
        }));
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error('Failed to delete post');
    }
  };

  const handleDeleteClassroom = async () => {
    if (!window.confirm("Are you sure you want to delete this classroom? This action is permanent and will remove all posts and students.")) return;
    
    try {
      const token = await getToken();
      const { data } = await axios.delete(`/api/classrooms/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (data.success) {
        toast.success("Classroom deleted successfully");
        navigate('/ai/classrooms');
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error('Failed to delete classroom');
    }
  };

  const handleRemoveStudent = async (studentId, studentName) => {
    if (!window.confirm(`Are you sure you want to remove ${studentName} from the classroom?`)) return;
    
    try {
      const token = await getToken();
      const { data } = await axios.delete(`/api/classrooms/${id}/students/${studentId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (data.success) {
        toast.success("Student removed");
        setClassroom(prev => ({
          ...prev,
          students: prev.students.filter(s => s.student_id !== studentId)
        }));
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error('Failed to remove student');
    }
  };

  const handleTutorSubmit = async (e) => {
    e.preventDefault();
    if (!tutorInput.trim() || tutorLoading) return;

    const userMessage = { role: 'user', text: tutorInput.trim() };
    const currentMessages = [...tutorMessages, userMessage];
    
    setTutorMessages(currentMessages);
    setTutorInput('');
    setTutorLoading(true);

    try {
      const token = await getToken();
      // Format history for Gemini ({role: 'user'|'model', parts: [{text}]})
      // Skip the first welcome message to maintain user->model alternating sequence
      const historyToPass = tutorMessages.slice(1);
      const history = historyToPass.map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));

      const { data } = await axios.post(`/api/classrooms/${id}/tutor`, 
        { message: userMessage.text, history },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (data.success) {
        setTutorMessages([...currentMessages, { role: 'model', text: data.text }]);
      } else {
        setTutorMessages(tutorMessages); // Revert to before the user sent the message
        toast.error(data.message);
      }
    } catch (error) {
      setTutorMessages(tutorMessages); // Revert on network/server error
      toast.error('Failed to get response');
    } finally {
      setTutorLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-transparent">
        <Loader2 className="w-10 h-10 animate-spin text-purple-500" />
      </div>
    );
  }

  if (!classroom) return null;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-full overflow-y-auto bg-transparent text-white"
    >
      {/* Banner */}
      <div className="bg-gradient-to-r from-blue-600/50 to-indigo-700/50 backdrop-blur-xl border-b border-white/10 h-48 md:h-64 relative shadow-lg">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_bottom_right,_var(--tw-gradient-stops))] from-white via-transparent to-transparent"></div>
        <div className="max-w-6xl mx-auto px-6 h-full flex flex-col justify-between py-6">
          <button 
            onClick={() => navigate('/ai/classrooms')}
            className="self-start bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 text-white p-2 rounded-full transition-colors flex items-center gap-2 pr-4 text-sm font-medium cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Classrooms
          </button>
          
          <div className="relative z-10 text-white pb-4">
            <h1 className="text-3xl md:text-5xl font-bold mb-2 drop-shadow-md">{classroom.name}</h1>
            <p className="text-blue-200 font-medium text-lg flex items-center gap-2">
              <School className="w-5 h-5" /> {classroom.subject}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Post Composer for Teachers */}
            {isTeacher && (
              <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-3xl p-6 shadow-lg">
                <form onSubmit={handleCreatePost}>
                  <textarea 
                    value={newPostContent}
                    onChange={(e) => setNewPostContent(e.target.value)}
                    placeholder="Announce something to your class..."
                    className="w-full bg-black/20 text-white border border-white/10 rounded-2xl p-4 focus:ring-2 focus:ring-blue-500/50 outline-none resize-none min-h-[120px] transition-all placeholder:text-slate-400"
                  ></textarea>
                  
                  {attachmentFile && (
                    <div className="flex items-center gap-2 mt-3 p-3 bg-blue-500/20 rounded-xl border border-blue-500/30">
                      <FileText className="w-5 h-5 text-blue-400" />
                      <span className="text-sm font-medium text-slate-300 flex-1 truncate">{attachmentFile.name}</span>
                      <button 
                        type="button" 
                        onClick={() => setAttachmentFile(null)}
                        className="p-1 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  <div className="flex flex-wrap justify-between items-center mt-4 gap-4">
                    <div>
                      <input 
                        type="file" 
                        id="file-upload" 
                        className="hidden" 
                        onChange={(e) => setAttachmentFile(e.target.files[0])}
                        accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                      />
                      <label 
                        htmlFor="file-upload" 
                        className="flex items-center gap-2 px-4 py-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-xl font-medium cursor-pointer transition-colors border border-transparent hover:border-white/10"
                      >
                        <Paperclip className="w-5 h-5" />
                        <span className="text-sm">Attach File</span>
                      </label>
                    </div>
                    
                    <button 
                      type="submit" 
                      disabled={posting || !newPostContent.trim()}
                      className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:scale-[1.02] active:scale-95 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl font-semibold flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(59,130,246,0.4)] cursor-pointer"
                    >
                      {posting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                      Post
                    </button>
                  </div>
                </form>
              </motion.div>
            )}

            {/* Posts Feed */}
            <div className="space-y-6">
              {!classroom.posts || classroom.posts.length === 0 ? (
                <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-3xl p-8 shadow-lg text-center py-20">
                  <div className="w-20 h-20 bg-black/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/5">
                    <School className="w-10 h-10 text-slate-500" />
                  </div>
                  <h2 className="text-xl font-bold text-white mb-2">No Posts Yet</h2>
                  <p className="text-slate-400 max-w-md mx-auto">
                    {isTeacher 
                      ? "Share an announcement, assignment, or resource with your class."
                      : "Your teacher hasn't posted anything to this classroom yet."}
                  </p>
                </div>
              ) : (
                classroom.posts.map((post, index) => (
                  <motion.div 
                    initial={{ y: 20, opacity: 0 }} 
                    animate={{ y: 0, opacity: 1 }} 
                    transition={{ delay: index * 0.1 }}
                    key={post.id} 
                    className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-3xl p-6 shadow-lg"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold">
                          {post.teacher_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-white">{post.teacher_name}</p>
                          <p className="text-xs text-slate-400">{new Date(post.created_at).toLocaleString()}</p>
                        </div>
                      </div>
                      
                      {isTeacher && post.teacher_id === user.id && editingPostId !== post.id && (
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={() => startEditing(post)}
                            className="p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-500/20 rounded-lg transition-colors cursor-pointer"
                            title="Edit Post"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDeletePost(post.id)}
                            className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/20 rounded-lg transition-colors cursor-pointer"
                            title="Delete Post"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                    
                    {editingPostId === post.id ? (
                      <form onSubmit={(e) => handleUpdatePost(e, post.id)}>
                        <textarea 
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="w-full bg-black/20 text-white border border-blue-500/30 rounded-2xl p-4 focus:ring-2 focus:ring-blue-500/50 outline-none resize-none min-h-[100px] transition-all"
                        ></textarea>
                        <div className="flex justify-end gap-2 mt-3">
                          <button 
                            type="button" 
                            onClick={() => setEditingPostId(null)}
                            className="px-4 py-2 text-slate-300 hover:bg-white/10 rounded-xl font-medium transition-colors cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button 
                            type="submit" 
                            disabled={savingEdit || !editContent.trim()}
                            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-colors cursor-pointer"
                          >
                            {savingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="text-slate-300 whitespace-pre-wrap leading-relaxed">
                        {post.content}
                        
                        {post.attachment_url && (
                          <div className="mt-4 p-4 rounded-xl border border-white/10 bg-black/20 hover:bg-white/5 transition-colors flex items-center justify-between group">
                            <div className="flex items-center gap-3 overflow-hidden">
                              <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                                <FileText className="w-5 h-5" />
                              </div>
                              <span className="font-medium text-slate-300 group-hover:text-white transition-colors truncate">{post.attachment_name}</span>
                            </div>
                            <a 
                              href={post.attachment_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="w-10 h-10 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-slate-400 group-hover:text-blue-400 group-hover:border-blue-500/30 shrink-0 transition-colors cursor-pointer"
                            >
                              <Download className="w-4 h-4" />
                            </a>
                          </div>
                        )}
                      </div>
                    )}
                  </motion.div>
                ))
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Invite Code Card */}
            {isTeacher && (
              <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="bg-white/5 border border-blue-500/30 backdrop-blur-xl rounded-3xl p-6 shadow-lg relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-cyan-500"></div>
                <h3 className="font-bold text-white mb-1">Invite Code</h3>
                <p className="text-xs text-slate-400 mb-4">Share this code with your students so they can join.</p>
                <div className="flex items-center justify-between bg-black/20 p-3 rounded-xl border border-white/10">
                  <span className="font-mono font-bold text-cyan-400 tracking-wider text-lg">{classroom.invite_code}</span>
                  <button 
                    onClick={copyInviteCode}
                    className="p-2 bg-white/10 hover:bg-white/20 text-blue-400 rounded-lg transition-colors cursor-pointer shadow-sm"
                    title="Copy Code"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </motion.div>
            )}

            {/* Students List */}
            <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-3xl p-6 shadow-lg">
              <h3 className="font-bold text-white mb-4 flex items-center justify-between">
                <span>Classmates</span>
                <span className="text-xs bg-black/40 text-slate-300 px-2 py-1 rounded-full border border-white/10">{classroom.students.length}</span>
              </h3>
              
              {!isTeacher && (
                <div className="flex items-center gap-3 p-3 bg-black/20 rounded-xl mb-4 border border-white/10">
                  <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold border border-blue-500/30">
                    T
                  </div>
                  <div>
                    <p className="font-semibold text-white text-sm">{classroom.teacher_name}</p>
                    <p className="text-xs text-slate-400">Teacher</p>
                  </div>
                </div>
              )}

              {classroom.students.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">No students have joined yet.</p>
              ) : (
                <div className="space-y-3">
                  {classroom.students.map((student) => (
                    <div key={student.student_id} className="flex items-center gap-3 p-2 hover:bg-white/5 rounded-xl transition-colors border border-transparent hover:border-white/5">
                      <div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold text-xs">
                        {student.student_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-300 text-sm truncate">{student.student_name}</p>
                        <p className="text-xs text-slate-500">Joined {new Date(student.joined_at).toLocaleDateString()}</p>
                      </div>
                      
                      {isTeacher && (
                        <button 
                          onClick={() => handleRemoveStudent(student.student_id, student.student_name)}
                          className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                          title="Remove Student"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </motion.div>

            {/* Admin Controls */}
            {isTeacher && (
              <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.2 }} className="bg-red-950/30 border border-red-500/30 backdrop-blur-xl rounded-3xl p-6 shadow-lg text-center">
                <h3 className="font-bold text-red-400 mb-2">Danger Zone</h3>
                <p className="text-xs text-red-400/80 mb-4">Deleting this classroom will remove all posts and enrolled students permanently.</p>
                <button 
                  onClick={handleDeleteClassroom}
                  className="w-full bg-red-500/20 hover:bg-red-500/40 text-red-400 border border-red-500/30 px-4 py-2.5 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Classroom
                </button>
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {/* AI Tutor Floating Widget */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
        {tutorOpen && (
          <div className="bg-slate-900 border border-white/10 rounded-3xl shadow-2xl w-[calc(100vw-3rem)] sm:w-80 md:w-96 h-[60vh] max-h-[500px] mb-4 flex flex-col overflow-hidden animate-in slide-in-from-bottom-5">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-4 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <BotMessageSquare className="w-5 h-5" />
                <h3 className="font-bold">AI Classroom Tutor</h3>
              </div>
              <button onClick={() => setTutorOpen(false)} className="text-white/80 hover:text-white p-1 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-950">
              {tutorMessages.length === 0 && (
                <div className="text-center text-slate-500 mt-10">
                  <BotMessageSquare className="w-12 h-12 mx-auto mb-3 opacity-20 text-blue-400" />
                  <p className="text-sm">Hi! I'm your AI Teaching Assistant.<br/>Ask me anything about the class materials.</p>
                </div>
              )}
              {tutorMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-slate-800 border border-white/5 text-slate-300 rounded-bl-sm shadow-sm prose prose-sm prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-black/40 prose-pre:text-slate-300'}`}>
                    <ReactMarkdown 
                      components={{
                        a: ({node, ...props}) => <a {...props} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline" />
                      }}
                    >
                      {msg.text}
                    </ReactMarkdown>
                  </div>
                </div>
              ))}
              {tutorLoading && (
                <div className="flex justify-start">
                  <div className="bg-slate-800 border border-white/5 p-3 rounded-2xl rounded-bl-sm shadow-sm flex gap-1">
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                  </div>
                </div>
              )}
            </div>

            <form onSubmit={handleTutorSubmit} className="p-3 bg-slate-900 border-t border-white/10 flex gap-2 shrink-0">
              <input 
                type="text" 
                value={tutorInput}
                onChange={e => setTutorInput(e.target.value)}
                placeholder="Ask a question..."
                className="flex-1 bg-black/40 border border-white/10 text-white rounded-full px-4 py-2 text-sm outline-none focus:border-blue-500/50 transition-colors"
              />
              <button 
                type="submit" 
                disabled={!tutorInput.trim() || tutorLoading}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white p-2 rounded-full flex items-center justify-center cursor-pointer transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}

        <button 
          onClick={() => setTutorOpen(!tutorOpen)}
          className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:scale-105 active:scale-95 text-white p-4 rounded-full shadow-[0_0_15px_rgba(59,130,246,0.5)] transition-all cursor-pointer flex items-center gap-2"
        >
          {tutorOpen ? <X className="w-6 h-6" /> : <MessageSquareText className="w-6 h-6" />}
        </button>
      </div>

    </motion.div>
  );
};

export default ClassroomDetail;
