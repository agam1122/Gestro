import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, School, BookOpen, Megaphone, Video, FileText, 
  Timer, SquarePen, Calendar, ArrowRight, ChevronDown, ChevronUp, 
  Copy, Check, ExternalLink, Download, Search, Clock, Award
} from 'lucide-react';
import { useAuth, useUser } from '@clerk/clerk-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import useCreationStore from '../store/useCreationStore';
import { getApiBaseUrl } from '../utils/resolveUrl';
import { useNavigate } from 'react-router-dom';
import Markdown from 'react-markdown';

axios.defaults.baseURL = getApiBaseUrl();

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const { getToken } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const { creations, setCreations } = useCreationStore();
  
  // Additional aggregated state
  const [classrooms, setClassrooms] = useState([]);
  const [activeBorrows, setActiveBorrows] = useState([]);
  const [notices, setNotices] = useState([]);
  
  // UI states
  const [filterType, setFilterType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCreation, setExpandedCreation] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [timeString, setTimeString] = useState('');

  // Clock update effect
  useEffect(() => {
    const updateTime = () => {
      const options = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true };
      setTimeString(new Date().toLocaleTimeString([], options));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const getDashboardData = async () => {
    try {
      setLoading(true);
      const token = await getToken();
      const headers = { Authorization: `Bearer ${token}` };

      // Fetch all required dashboard metrics in parallel
      const [docsRes, classRes, libraryRes, noticesRes] = await Promise.all([
        axios.get("/api/user/get-user-documents", { headers }),
        axios.get("/api/classrooms/my-classes", { headers }),
        axios.get("/api/library/my-books", { headers }),
        axios.get("/api/user/notifications", { headers }),
      ]);

      if (docsRes.data.success) {
        setCreations(docsRes.data.data);
      }
      if (classRes.data.success) {
        setClassrooms(classRes.data.data);
      }
      if (libraryRes.data.success) {
        setActiveBorrows(libraryRes.data.active || []);
      }
      if (noticesRes.data.success) {
        setNotices(noticesRes.data.data || []);
      }
    } catch (error) {
      console.error("Dashboard data fetch error:", error);
      toast.error(error.response?.data?.message || "Failed to load dashboard metrics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getDashboardData();
  }, []);

  // Filter creations based on search and type tab
  const filteredCreations = creations.filter(item => {
    const matchesSearch = item.prompt.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'all' || 
                        (filterType === 'question-paper' && item.type === 'question-paper') ||
                        (filterType === 'resume-review' && item.type === 'resume-review');
    return matchesSearch && matchesType;
  });

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Content copied to clipboard!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const isTeacher = user?.publicMetadata?.role === 'teacher';

  // Get dynamic personalized study advice
  const getPersonalizedTip = () => {
    if (isTeacher) {
      return {
        title: "Instructor Briefing",
        text: "You can create question papers aligned directly with your subjects in the Question Paper tab, or schedule a live video call to start classroom sign-language translations.",
        badge: "Teaching Assistant"
      };
    }
    if (activeBorrows.length === 0) {
      return {
        title: "Expand Your Library",
        text: "Your bookshelf is currently empty. Visit the Digital Library to browse and borrow reference guides, textbooks, or custom AI learning materials.",
        badge: "Quick suggestion"
      };
    }
    const overdueBook = activeBorrows.find(b => new Date(b.due_date) < new Date());
    if (overdueBook) {
      return {
        title: "Library Due Notice",
        text: `The book "${overdueBook.title}" is past its return date. Please request a return to avoid academic locks.`,
        badge: "Critical action required"
      };
    }
    return {
      title: "Active Learning",
      text: `You have ${activeBorrows.length} books in your bookshelf. Set a Pomodoro session in the Study Lounge to complete your target reading pages!`,
      badge: "Focus Tip"
    };
  };

  const currentTip = getPersonalizedTip();

  return (
    <div className='h-full overflow-y-auto p-4 md:p-8 bg-transparent text-white space-y-8 select-none'>
      
      {/* 1. WELCOME HERO PANEL */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-r from-slate-900/90 via-indigo-950/20 to-slate-950 p-6 md:p-8 shadow-2xl backdrop-blur-xl"
      >
        {/* Decorative corner glows */}
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-purple-500/10 rounded-full blur-[80px] pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-blue-500/10 rounded-full blur-[80px] pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-semibold text-blue-300">
              <Sparkles className="w-3.5 h-3.5" /> 
              {isTeacher ? "Educator Mode Enabled" : "Personalized Student Portal"}
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white">
              Welcome back, <span className="bg-gradient-to-r from-blue-400 via-indigo-200 to-purple-400 text-transparent bg-clip-text">
                {isTeacher ? `Professor ${user?.lastName || user?.firstName || 'Educator'}` : (user?.firstName || 'Scholar')}
              </span>!
            </h1>
            <p className="text-slate-400 text-sm md:text-base max-w-2xl leading-relaxed">
              {isTeacher 
                ? "Manage your virtual classrooms, generate syllabus-aligned exam guides, and coordinate real-time sign translations for inclusive education."
                : "Explore classrooms, request library resources, review resume scores, and participate in collaborative study lounges."}
            </p>
          </div>

          {/* Real-time Clock widget */}
          <div className="flex flex-col items-end max-sm:items-start text-right bg-white/5 border border-white/10 p-4 rounded-2xl backdrop-blur-md min-w-[200px] shadow-lg">
            <span className="text-2xl font-bold font-mono tracking-widest text-indigo-300 drop-shadow-sm">
              {timeString || "00:00:00 AM"}
            </span>
            <span className="text-slate-400 text-xs font-semibold flex items-center gap-1.5 mt-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              {new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
        </div>
      </motion.div>

      {/* 2. REAL-TIME METRICS GRID */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        
        {/* Metric 1: Creations */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          onClick={() => {
            const el = document.getElementById("creations-section");
            el?.scrollIntoView({ behavior: 'smooth' });
          }}
          className="group relative flex justify-between items-center p-5 bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 shadow-lg hover:bg-white/10 hover:border-purple-500/30 transition-all duration-300 cursor-pointer overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-xl group-hover:bg-purple-500/10 transition-colors" />
          <div className="text-left">
            <p className="text-xs md:text-sm text-slate-400 font-semibold uppercase tracking-wider">AI Creations</p>
            <h2 className="text-3xl font-extrabold text-white mt-1 group-hover:text-purple-300 transition-colors">
              {loading ? "..." : creations.length}
            </h2>
          </div>
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 text-white flex justify-center items-center shadow-[0_0_15px_rgba(147,51,234,0.3)]">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
        </motion.div>

        {/* Metric 2: Classrooms */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          onClick={() => navigate('/ai/classrooms')}
          className="group relative flex justify-between items-center p-5 bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 shadow-lg hover:bg-white/10 hover:border-blue-500/30 transition-all duration-300 cursor-pointer overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-xl group-hover:bg-blue-500/10 transition-colors" />
          <div className="text-left">
            <p className="text-xs md:text-sm text-slate-400 font-semibold uppercase tracking-wider">Classrooms</p>
            <h2 className="text-3xl font-extrabold text-white mt-1 group-hover:text-blue-300 transition-colors">
              {loading ? "..." : classrooms.length}
            </h2>
          </div>
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-600 text-white flex justify-center items-center shadow-[0_0_15px_rgba(59,130,246,0.3)]">
            <School className="w-5 h-5 text-white" />
          </div>
        </motion.div>

        {/* Metric 3: Library Borrows */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          onClick={() => navigate('/ai/library/my-books')}
          className="group relative flex justify-between items-center p-5 bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 shadow-lg hover:bg-white/10 hover:border-emerald-500/30 transition-all duration-300 cursor-pointer overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl group-hover:bg-emerald-500/10 transition-colors" />
          <div className="text-left">
            <p className="text-xs md:text-sm text-slate-400 font-semibold uppercase tracking-wider">Borrowed Books</p>
            <h2 className="text-3xl font-extrabold text-white mt-1 group-hover:text-emerald-300 transition-colors">
              {loading ? "..." : activeBorrows.length}
            </h2>
          </div>
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-600 text-white flex justify-center items-center shadow-[0_0_15px_rgba(16,185,129,0.3)]">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
        </motion.div>

        {/* Metric 4: Notices */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
          onClick={() => navigate('/ai/community')}
          className="group relative flex justify-between items-center p-5 bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 shadow-lg hover:bg-white/10 hover:border-amber-500/30 transition-all duration-300 cursor-pointer overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-xl group-hover:bg-amber-500/10 transition-colors" />
          <div className="text-left">
            <p className="text-xs md:text-sm text-slate-400 font-semibold uppercase tracking-wider">Announcements</p>
            <h2 className="text-3xl font-extrabold text-white mt-1 group-hover:text-amber-300 transition-colors">
              {loading ? "..." : notices.length}
            </h2>
          </div>
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-600 to-rose-600 text-white flex justify-center items-center shadow-[0_0_15px_rgba(245,158,11,0.3)]">
            <Megaphone className="w-5 h-5 text-white" />
          </div>
        </motion.div>

      </div>

      {/* 3. AI QUICK ACTIONS PANEL */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="space-y-4"
      >
        <h2 className="text-lg font-bold text-slate-200 tracking-wide uppercase">AI Workspace Quick Access</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Action 1: Join Call */}
          <div 
            onClick={() => navigate('/ai/video-call')}
            className="group relative p-5 bg-slate-900/60 hover:bg-slate-900 border border-white/10 hover:border-blue-500/40 rounded-2xl cursor-pointer transition-all duration-300 shadow-md flex flex-col justify-between min-h-[140px]"
          >
            <div className="flex justify-between items-start">
              <div className="w-10 h-10 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
                <Video className="w-5 h-5" />
              </div>
              <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm group-hover:text-blue-300 transition-colors">WebRTC Video Call</h3>
              <p className="text-xs text-slate-500 mt-1 leading-snug">Join active class lectures and translate real-time hand signs.</p>
            </div>
          </div>

          {/* Action 2: Review Resume */}
          <div 
            onClick={() => navigate('/ai/review-resume')}
            className="group relative p-5 bg-slate-900/60 hover:bg-slate-900 border border-white/10 hover:border-purple-500/40 rounded-2xl cursor-pointer transition-all duration-300 shadow-md flex flex-col justify-between min-h-[140px]"
          >
            <div className="flex justify-between items-start">
              <div className="w-10 h-10 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
              <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm group-hover:text-purple-300 transition-colors">ATS Resume Reviewer</h3>
              <p className="text-xs text-slate-500 mt-1 leading-snug">Upload your resume to get instant scoring and interview preparation guides.</p>
            </div>
          </div>

          {/* Action 3: Study Lounge */}
          <div 
            onClick={() => navigate('/ai/study-lounge')}
            className="group relative p-5 bg-slate-900/60 hover:bg-slate-900 border border-white/10 hover:border-emerald-500/40 rounded-2xl cursor-pointer transition-all duration-300 shadow-md flex flex-col justify-between min-h-[140px]"
          >
            <div className="flex justify-between items-start">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <Timer className="w-5 h-5" />
              </div>
              <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm group-hover:text-emerald-300 transition-colors">3D Study Lounge</h3>
              <p className="text-xs text-slate-500 mt-1 leading-snug">Boost productivity with custom timers and interactive 3D notes workspace.</p>
            </div>
          </div>

          {/* Action 4: Question Paper Generator (Teachers) / Browse Library (Students) */}
          {isTeacher ? (
            <div 
              onClick={() => navigate('/ai/generate-question-paper')}
              className="group relative p-5 bg-slate-900/60 hover:bg-slate-900 border border-white/10 hover:border-amber-500/40 rounded-2xl cursor-pointer transition-all duration-300 shadow-md flex flex-col justify-between min-h-[140px]"
            >
              <div className="flex justify-between items-start">
                <div className="w-10 h-10 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <SquarePen className="w-5 h-5" />
                </div>
                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm group-hover:text-amber-300 transition-colors">Generate Question Paper</h3>
                <p className="text-xs text-slate-500 mt-1 leading-snug">Compile professional, syllabus-aligned exams using Gemini Models.</p>
              </div>
            </div>
          ) : (
            <div 
              onClick={() => navigate('/ai/library')}
              className="group relative p-5 bg-slate-900/60 hover:bg-slate-900 border border-white/10 hover:border-cyan-500/40 rounded-2xl cursor-pointer transition-all duration-300 shadow-md flex flex-col justify-between min-h-[140px]"
            >
              <div className="flex justify-between items-start">
                <div className="w-10 h-10 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                  <BookOpen className="w-5 h-5" />
                </div>
                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm group-hover:text-cyan-300 transition-colors">Browse Digital Books</h3>
                <p className="text-xs text-slate-500 mt-1 leading-snug">Browse core categories, request to borrow, or access downloaded content.</p>
              </div>
            </div>
          )}

        </div>
      </motion.div>

      {/* 4. SPLIT LAYOUT: CREATIONS & SIDEBAR WIDGETS */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN: CREATIONS FEED */}
        <div id="creations-section" className="xl:col-span-2 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                Recent AI Creations
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-white/10 text-slate-400">
                  {filteredCreations.length} items
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {isTeacher 
                  ? "Explore your generated PDFs, resumes, and study exams." 
                  : "Explore your uploaded resumes and interview feedback reports."}
              </p>
            </div>

            {/* Creations Search Bar */}
            <div className="relative w-full sm:w-60">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
              <input 
                type="text"
                placeholder="Search creations..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-black/20 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500/50 transition-colors placeholder-slate-500"
              />
            </div>
          </div>

          {/* Creations Filter Tabs */}
          {isTeacher && (
            <div className="flex gap-2">
              {['all', 'question-paper', 'resume-review'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setFilterType(tab)}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                    filterType === tab
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 border-white/10 text-white shadow-md'
                      : 'bg-white/5 border-white/5 text-slate-400 hover:text-white'
                  }`}
                >
                  {tab === 'all' ? 'Show All' : tab === 'question-paper' ? 'Question Papers' : 'Resume Reviews'}
                </button>
              ))}
            </div>
          )}

          {/* Creations List */}
          {loading ? (
            <div className="py-20 text-center text-slate-500">Loading documents...</div>
          ) : filteredCreations.length === 0 ? (
            <div className="py-20 text-center border border-dashed border-white/10 rounded-2xl bg-white/5">
              <p className="text-slate-400 font-medium">No creations found matching the criteria.</p>
              <button 
                onClick={() => { setFilterType('all'); setSearchQuery(''); }}
                className="text-xs text-blue-400 hover:underline mt-2 cursor-pointer"
              >
                {isTeacher ? "Clear all filters" : "Clear search"}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredCreations.map((item, index) => {
                const isExpanded = expandedCreation === item.id;
                const isCopied = copiedId === item.id;
                return (
                  <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    key={item.id}
                    className={`border rounded-2xl overflow-hidden shadow-lg transition-all duration-300 ${
                      isExpanded 
                        ? 'bg-slate-900 border-indigo-500/40 shadow-indigo-950/20' 
                        : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-slate-800'
                    }`}
                  >
                    {/* Header Click Area */}
                    <div 
                      onClick={() => setExpandedCreation(isExpanded ? null : item.id)}
                      className="p-5 flex items-start justify-between gap-4 cursor-pointer select-none"
                    >
                      <div className="space-y-1 text-left">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded ${
                            item.type === 'question-paper' 
                              ? 'bg-blue-500/20 border border-blue-500/30 text-blue-400' 
                              : 'bg-purple-500/20 border border-purple-500/30 text-purple-400'
                          }`}>
                            {item.type === 'question-paper' ? 'Question Paper' : 'Resume Analyzer'}
                          </span>
                          <span className="text-xs text-slate-500 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-white mt-1 group-hover:text-blue-300 transition-colors drop-shadow-sm">
                          {item.prompt}
                        </h3>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopy(item.content, item.id);
                          }}
                          className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 text-slate-400 hover:text-white transition-colors"
                          title="Copy content"
                        >
                          {isCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                        </button>
                        <div className="text-slate-400">
                          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                        </div>
                      </div>
                    </div>

                    {/* Expandable Content Area */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3 }}
                          className="border-t border-white/10 bg-black/40"
                        >
                          <div className="p-5 overflow-y-auto max-h-[400px] text-sm text-slate-300 leading-relaxed font-sans select-text">
                            <div className="reset-tw prose prose-invert max-w-none text-left">
                              <Markdown>{item.content}</Markdown>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: SIDEBAR WIDGETS */}
        <div className="space-y-6">
          
          {/* WIDGET 1: PERSIONAlIZED STUDY TIPS */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="p-6 rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900 via-indigo-950/20 to-slate-900 shadow-xl backdrop-blur-md relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-20 h-20 bg-indigo-500/5 rounded-full blur-xl pointer-events-none" />
            <div className="flex items-center gap-2 justify-between">
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                {currentTip.badge}
              </span>
              <Award className="w-5 h-5 text-indigo-400" />
            </div>
            
            <h3 className="font-extrabold text-white text-base mt-3">{currentTip.title}</h3>
            <p className="text-xs text-slate-400 leading-relaxed mt-1.5">{currentTip.text}</p>
            
            <div className="mt-5 border-t border-white/10 pt-4 flex justify-between items-center text-xs text-indigo-300 font-bold group hover:text-white cursor-pointer transition-colors" onClick={() => navigate(isTeacher ? '/ai/generate-question-paper' : '/ai/library')}>
              <span>{isTeacher ? "Open Question Paper panel" : "View available books"}</span>
              <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
            </div>
          </motion.div>

          {/* WIDGET 2: RECENT NOTICE BOARD ANNOUNCEMENTS */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="p-6 rounded-2xl border border-white/10 bg-slate-900/60 shadow-xl backdrop-blur-md space-y-4"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-amber-400" />
                Latest Announcements
              </h3>
              <button 
                onClick={() => navigate('/ai/community')}
                className="text-xs text-slate-500 hover:text-white flex items-center gap-0.5 transition-colors"
              >
                All <ExternalLink className="w-3 h-3" />
              </button>
            </div>

            {loading ? (
              <div className="py-6 text-center text-slate-500 text-xs">Loading announcements...</div>
            ) : notices.length === 0 ? (
              <div className="py-6 text-center text-slate-500 text-xs">No announcements posted yet.</div>
            ) : (
              <div className="space-y-4">
                {notices.slice(0, 2).map((notice) => (
                  <div key={notice.id} className="space-y-1.5 text-left border-l-2 border-amber-500/50 pl-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-[10px] text-slate-500 font-semibold">
                        {new Date(notice.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                      {notice.attachment_url && (
                        <a 
                          href={notice.attachment_url} 
                          target="_blank" 
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[9px] font-bold text-blue-400 hover:underline"
                        >
                          <Download className="w-2.5 h-2.5" /> File
                        </a>
                      )}
                    </div>
                    <h4 className="font-bold text-slate-200 text-xs tracking-tight line-clamp-1">{notice.prompt}</h4>
                    <p className="text-[11px] text-slate-400 leading-snug line-clamp-2">{notice.content}</p>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
          
        </div>

      </div>

    </div>
  );
};

export default Dashboard;