import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useUser, useAuth } from '@clerk/clerk-react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { FileText, Loader2, Megaphone, Plus, X, Upload, Pencil, Trash2, BotMessageSquare, Send } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

import { getApiBaseUrl } from '../utils/resolveUrl'

axios.defaults.baseURL = getApiBaseUrl()

const NoticeBoard = () => {
  const { user, isLoaded } = useUser()
  const { getToken } = useAuth()

  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editFile, setEditFile] = useState(null)
  const [editRemoveAttachment, setEditRemoveAttachment] = useState(false)

  // Tutor state
  const [tutorOpen, setTutorOpen] = useState(false)
  const [tutorMessages, setTutorMessages] = useState([])
  const [tutorInput, setTutorInput] = useState('')
  const [tutorLoading, setTutorLoading] = useState(false)

  const isAdmin = user?.primaryEmailAddress?.emailAddress === import.meta.env.VITE_ADMIN_EMAIL

  const fetchNotifications = async () => {
    try {
      setLoading(true)
      const token = await getToken()
      const { data } = await axios.get("/api/user/notifications", {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (data.success) {
        setNotifications(data.data)
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isLoaded && user) {
      fetchNotifications()
    }
  }, [isLoaded, user])

  const handlePostNotification = async (e) => {
    e.preventDefault()
    if (!newTitle.trim() || !newContent.trim()) {
      return toast.error("Title and content are required")
    }

    setUploading(true)
    try {
      const token = await getToken()
      const formData = new FormData()
      formData.append('title', newTitle)
      formData.append('content', newContent)
      if (file) {
        formData.append('file', file)
      }

      const { data } = await axios.post("/api/user/notifications", formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      })

      if (data.success) {
        toast.success("Notification posted successfully!")
        setNotifications([data.data, ...notifications])
        setIsModalOpen(false)
        setNewTitle('')
        setNewContent('')
        setFile(null)
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      toast.error("Failed to post notification")
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this notice?")) return;
    try {
      const token = await getToken()
      const { data } = await axios.delete(`/api/user/notifications/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (data.success) {
        toast.success("Notice deleted")
        setNotifications(notifications.filter(n => n.id !== id))
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      toast.error("Failed to delete notice")
    }
  }

  const handleEditSubmit = async (e, id) => {
    e.preventDefault()
    if (!newTitle.trim() || !newContent.trim()) return toast.error("Title and content are required")

    setUploading(true)
    try {
      const token = await getToken()
      
      const formData = new FormData()
      formData.append('title', newTitle)
      formData.append('content', newContent)
      
      if (editRemoveAttachment) {
        formData.append('removeAttachment', 'true')
      } else if (editFile) {
        formData.append('file', editFile)
      }

      const { data } = await axios.put(`/api/user/notifications/${id}`, formData, { 
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        } 
      })
      if (data.success) {
        toast.success("Notice updated")
        setNotifications(notifications.map(n => n.id === id ? data.data : n))
        setEditingId(null)
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      toast.error("Failed to update notice")
    } finally {
      setUploading(false)
    }
  }

  const startEditing = (notice) => {
    setEditingId(notice.id)
    setNewTitle(notice.prompt)
    setNewContent(notice.content)
    setEditFile(null)
    setEditRemoveAttachment(false)
  }

  const openNewModal = () => {
    setEditingId(null)
    setNewTitle('')
    setNewContent('')
    setFile(null)
    setIsModalOpen(true)
  }

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
      const historyToPass = tutorMessages.slice(1);
      const history = historyToPass.map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));

      const { data } = await axios.post("/api/user/notice-tutor", 
        { message: userMessage.text, history },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (data.success) {
        setTutorMessages([...currentMessages, { role: 'model', text: data.text }]);
      } else {
        toast.error(data.message || 'Failed to get response');
        setTutorMessages(currentMessages);
      }
    } catch (error) {
      toast.error('AI Tutor is unavailable right now');
      setTutorMessages(currentMessages);
    } finally {
      setTutorLoading(false);
    }
  };

  return (
    <div className='flex-1 h-full flex flex-col bg-transparent overflow-hidden text-white'>
      {/* Header */}
      <div className="bg-white/5 backdrop-blur-xl border-b border-white/10 p-4 sm:p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="bg-purple-600/20 p-2 rounded-xl text-purple-400 shadow-[0_0_15px_rgba(147,51,234,0.3)] border border-purple-500/20">
            <Megaphone className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Notice Board</h1>
            <p className="text-slate-400 text-sm">Official announcements and documents</p>
          </div>
        </div>
        
        {isAdmin && (
          <button 
            onClick={openNewModal}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:scale-[1.02] active:scale-95 text-white px-4 py-2.5 rounded-xl font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-[0_0_15px_rgba(147,51,234,0.4)]"
          >
            <Plus className="w-4 h-4" /> New Notice
          </button>
        )}
      </div>

      {/* Main Content */}
      <div className='flex-1 overflow-y-auto p-6'>
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="w-10 h-10 animate-spin text-purple-500" />
          </div>
        ) : notifications.length === 0 ? (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} className="h-full flex flex-col items-center justify-center text-slate-500">
            <Megaphone className="w-16 h-16 text-slate-600 mb-4 opacity-50" />
            <p className="text-lg font-medium text-slate-400">No notices yet</p>
            <p className="text-sm">Official announcements will appear here.</p>
          </motion.div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-6">
            {notifications.map((notice, index) => (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                key={notice.id} 
                className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl p-6 shadow-lg hover:bg-white/10 transition-colors relative"
              >
                {editingId === notice.id ? (
                  <form onSubmit={(e) => handleEditSubmit(e, notice.id)} className="space-y-4">
                    <input 
                      type="text" 
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2 font-bold outline-none text-white focus:border-purple-500/50 transition-colors"
                    />
                    <textarea 
                      value={newContent}
                      onChange={(e) => setNewContent(e.target.value)}
                      className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 outline-none text-white focus:border-purple-500/50 transition-colors min-h-[100px] resize-none"
                    ></textarea>
                    
                    <div className="flex flex-col gap-2 p-4 bg-black/20 rounded-xl border border-white/10">
                      <p className="text-sm font-medium text-slate-300">Attachment Settings</p>
                      {notice.attachment_url && !editRemoveAttachment && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-slate-400 truncate max-w-[200px]">Current: {notice.attachment_name}</span>
                          <button type="button" onClick={() => setEditRemoveAttachment(true)} className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded hover:bg-red-500/30 cursor-pointer">Remove</button>
                        </div>
                      )}
                      {editRemoveAttachment && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-red-400 italic">Attachment will be deleted</span>
                          <button type="button" onClick={() => setEditRemoveAttachment(false)} className="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded hover:bg-slate-600 cursor-pointer">Undo</button>
                        </div>
                      )}
                      {!editRemoveAttachment && (
                        <input 
                          type="file" 
                          accept=".pdf"
                          onChange={(e) => setEditFile(e.target.files[0])}
                          className="text-sm text-slate-400 file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-purple-600/20 file:text-purple-300 hover:file:bg-purple-600/30 cursor-pointer"
                        />
                      )}
                    </div>

                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => setEditingId(null)} className="px-4 py-2 text-slate-400 hover:bg-white/10 rounded-xl cursor-pointer">Cancel</button>
                      <button type="submit" disabled={uploading} className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-xl hover:scale-[1.02] active:scale-95 cursor-pointer disabled:opacity-50 flex items-center gap-2 shadow-[0_0_10px_rgba(147,51,234,0.3)] transition-all">
                        {uploading && <Loader2 className="w-4 h-4 animate-spin" />} Save
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    {isAdmin && (
                      <div className="absolute top-6 right-6 flex gap-2">
                        <button onClick={() => startEditing(notice)} className="text-slate-400 hover:text-purple-400 transition-colors p-1" title="Edit">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(notice.id)} className="text-slate-400 hover:text-red-400 transition-colors p-1" title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    <div className="flex justify-between items-start mb-4 pr-16">
                      <h2 className="text-xl font-bold text-white">{notice.prompt}</h2>
                    </div>
                    <span className="inline-block mb-4 text-xs font-medium text-purple-300 bg-purple-600/20 border border-purple-500/20 px-3 py-1 rounded-full shadow-[0_0_10px_rgba(147,51,234,0.2)]">
                      {new Date(notice.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </span>
                    <p className="text-slate-300 whitespace-pre-wrap mb-6">{notice.content}</p>
                    
                    {notice.attachment_url && (
                      <a 
                        href={notice.attachment_url} 
                        target="_blank" 
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 bg-blue-600/20 border border-blue-500/30 hover:bg-blue-600/30 text-blue-300 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
                      >
                        <FileText className="w-4 h-4" />
                        {notice.attachment_name || "View Attached Document"}
                      </a>
                    )}
                  </>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-md">
          <motion.div initial={{scale:0.9, opacity:0}} animate={{scale:1, opacity:1}} className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center bg-white/5">
              <h2 className="text-xl font-bold text-white">Post New Notice</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer p-1 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handlePostNotification} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Notice Title</label>
                <input 
                  type="text" 
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. End of Semester Results Declared"
                  className="w-full bg-black/20 border border-white/10 text-white rounded-xl px-4 py-3 outline-none focus:border-purple-500/50 transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
                <textarea 
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="Provide the details of the notice..."
                  className="w-full bg-black/20 border border-white/10 text-white rounded-xl px-4 py-3 outline-none focus:border-purple-500/50 transition-colors min-h-[120px] resize-none"
                  required
                ></textarea>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Attach PDF (Optional)</label>
                <div className="relative">
                  <input 
                    type="file" 
                    accept=".pdf"
                    onChange={(e) => setFile(e.target.files[0])}
                    className="hidden"
                    id="pdf-upload"
                  />
                  <label 
                    htmlFor="pdf-upload" 
                    className="flex items-center justify-center gap-2 w-full border-2 border-dashed border-white/20 bg-black/20 rounded-xl p-6 hover:bg-white/5 hover:border-purple-500/50 transition-colors cursor-pointer"
                  >
                    <Upload className="w-5 h-5 text-slate-400" />
                    <span className="text-slate-300 font-medium">
                      {file ? file.name : "Click to select a PDF file"}
                    </span>
                  </label>
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-3 rounded-xl font-medium text-slate-300 hover:bg-white/10 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={uploading}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-3 rounded-xl font-medium flex items-center justify-center gap-2 disabled:opacity-50 transition-all cursor-pointer hover:scale-[1.02] active:scale-95 shadow-[0_0_15px_rgba(147,51,234,0.4)]"
                >
                  {uploading ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Posting...</>
                  ) : (
                    <><Megaphone className="w-5 h-5" /> Post Notice</>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
      {/* AI Tutor Floating Widget */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
        {tutorOpen && (
          <div className="bg-slate-900 border border-white/10 rounded-3xl shadow-2xl w-[calc(100vw-3rem)] sm:w-80 md:w-96 h-[60vh] max-h-[500px] mb-4 flex flex-col overflow-hidden animate-in slide-in-from-bottom-5">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-4 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <BotMessageSquare className="w-5 h-5" />
                <h3 className="font-bold">Notice Board AI</h3>
              </div>
              <button onClick={() => setTutorOpen(false)} className="text-white/80 hover:text-white p-1 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-950">
              {tutorMessages.length === 0 && (
                <div className="text-center text-slate-500 mt-10">
                  <BotMessageSquare className="w-12 h-12 mx-auto mb-3 opacity-20 text-blue-400" />
                  <p className="text-sm">Hi! I'm your Notice Board AI Assistant.<br/>Ask me anything about the latest campus updates.</p>
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
                placeholder="Ask about a notice..."
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

        {!tutorOpen && (
          <button 
            onClick={() => setTutorOpen(true)}
            className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-4 rounded-full shadow-[0_0_20px_rgba(37,99,235,0.4)] hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center gap-2 group"
          >
            <BotMessageSquare className="w-6 h-6" />
            <span className="font-medium pr-1 max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 ease-in-out whitespace-nowrap">
              Ask AI
            </span>
          </button>
        )}
      </div>
    </div>
  )
}

export default NoticeBoard