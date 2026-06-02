import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Edit, Sparkles, Download, Lock } from 'lucide-react'
import { useAuth, useUser } from '@clerk/clerk-react'
import { Link } from 'react-router-dom';

import axios from 'axios';  
import toast from 'react-hot-toast';

import Markdown from 'react-markdown';
import html2pdf from 'html2pdf.js';

import { getApiBaseUrl } from '../utils/resolveUrl';

axios.defaults.baseURL = getApiBaseUrl();

const GenerateQuestionPaper = () => {

  const [universityName, setUniversityName] = useState('');
  const [branch, setBranch] = useState('Computer Science');
  const [semester, setSemester] = useState('Semester 1');
  const [subject, setSubject] = useState('');
  const [syllabus, setSyllabus] = useState('');
  const [totalMarks, setTotalMarks] = useState(50);
  
  const [mcqCount, setMcqCount] = useState(0);
  const [shortCount, setShortCount] = useState(0);
  const [longCount, setLongCount] = useState(0);

  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState('');
  const [answerKeyContent, setAnswerKeyContent] = useState('');

  const {getToken} = useAuth()
  const { user } = useUser()

  if (user?.publicMetadata?.role !== 'teacher') {
    return (
      <motion.div initial={{opacity:0}} animate={{opacity:1}} className="h-full flex flex-col items-center justify-center p-6 text-center bg-transparent">
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 max-w-md shadow-lg flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-red-500/20 border border-red-500/30 flex justify-center items-center mb-4 shadow-[0_0_15px_rgba(239,68,68,0.3)]">
            <Lock className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2 drop-shadow-sm">Teachers Only</h2>
          <p className="text-slate-400 mb-6 text-sm">
            The Question Paper Generator is an exclusive tool for educators. If you are a teacher, please update your role in the onboarding section.
          </p>
          <Link to="/onboarding" className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:scale-105 active:scale-95 transition-all text-white font-medium rounded-lg shadow-[0_0_15px_rgba(147,51,234,0.4)]">
            Update Role
          </Link>
        </div>
      </motion.div>
    )
  }

  const onSubmitHandler = async (e) => {
     e.preventDefault();
     
     if (mcqCount === 0 && shortCount === 0 && longCount === 0) {
       toast.error("Please request at least one type of question.");
       return;
     }

     try {
      setLoading(true);
      const {data} = await axios.post('/api/ai/generate-question-paper', {
        universityName,
        branch,
        semester,
        subject,
        syllabus,
        totalMarks,
        mcqCount,
        shortCount,
        longCount
      }, {
        headers: {
          Authorization: `Bearer ${await getToken()}`
        }
      });
      if(data.success) {
        if (data.content.includes('====ANSWER_KEY====')) {
          const [paper, answerKey] = data.content.split('====ANSWER_KEY====');
          setContent(paper.trim());
          setAnswerKeyContent(answerKey.trim());
        } else {
          setContent(data.content.trim());
          setAnswerKeyContent('');
        }
      } else {
        toast.error(data.message);
      } 
     } catch (error) {
      toast.error(error.response?.data?.message || error.message);
     }
     setLoading(false);
  }

  const handleDownloadPdf = () => {
    const element = document.getElementById('pdf-content');
    const opt = {
      margin:       10,
      filename:     `${branch}_${subject}_Paper.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2 },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak:    { mode: ['css', 'legacy'] }
    };
    html2pdf().set(opt).from(element).save();
  };

  const handleDownloadAnswerKeyPdf = () => {
    const element = document.getElementById('answer-key-content');
    const opt = {
      margin:       10,
      filename:     `${branch}_${subject}_AnswerKey.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2 },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak:    { mode: ['css', 'legacy'] }
    };
    html2pdf().set(opt).from(element).save();
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className='h-full overflow-y-scroll p-6 flex items-start flex-wrap gap-4 text-white'
    >
      {/* left col */}
      <form onSubmit={onSubmitHandler} className='w-full max-w-lg p-6 bg-white/5 backdrop-blur-xl rounded-xl border border-white/10 shadow-lg transition-colors hover:bg-white/10'>
        <div className='flex items-center gap-3 mb-6'>
          <Sparkles className='w-6 text-blue-400 drop-shadow-[0_0_10px_rgba(96,165,250,0.8)]'/>
          <h1 className='text-xl font-semibold'>Engineering Paper Setup</h1>
        </div>

        <p className='text-sm font-medium text-slate-300'>University / College Name (Optional)</p>
        <input onChange={(e) => setUniversityName(e.target.value)} value={universityName} type="text" className='border border-white/10 bg-black/20 rounded-md w-full p-2 px-3 outline-none text-sm mt-2 text-slate-300 focus:border-blue-500/50 transition-colors'
        placeholder='e.g. MIT, Stanford' />

        <div className='flex gap-4 mt-4'>
          <div className='flex-1'>
            <p className='text-sm font-medium text-slate-300'>Branch / Dept</p>
            <input onChange={(e) => setBranch(e.target.value)} value={branch} type="text" className='border border-white/10 bg-black/20 rounded-md w-full p-2 px-3 outline-none text-sm mt-2 text-slate-300 focus:border-blue-500/50 transition-colors' placeholder='e.g. Computer Science' required/>
          </div>
          <div className='flex-1'>
            <p className='text-sm font-medium text-slate-300'>Semester</p>
            <select onChange={(e) => setSemester(e.target.value)} value={semester} className='border border-white/10 bg-black/20 rounded-md w-full p-2 px-3 outline-none text-sm mt-2 text-slate-300 focus:border-blue-500/50 transition-colors'>
              {[...Array(8)].map((_, i) => (
                <option className="bg-slate-900" key={i}>Semester {i + 1}</option>
              ))}
            </select>
          </div>
        </div>

        <div className='flex gap-4 mt-4'>
          <div className='flex-1'>
            <p className='text-sm font-medium text-slate-300'>Subject</p>
            <input onChange={(e) => setSubject(e.target.value)} value={subject} type="text" className='border border-white/10 bg-black/20 rounded-md w-full p-2 px-3 outline-none text-sm mt-2 text-slate-300 focus:border-blue-500/50 transition-colors'
            placeholder='e.g. Operating Systems' required/>
          </div>
          <div className='w-1/3'>
            <p className='text-sm font-medium text-slate-300'>Total Marks</p>
            <input onChange={(e) => setTotalMarks(e.target.value)} value={totalMarks} type="number" min="10" max="200" className='border border-white/10 bg-black/20 rounded-md w-full p-2 px-3 outline-none text-sm mt-2 text-slate-300 focus:border-blue-500/50 transition-colors' required/>
          </div>
        </div>

        <p className='mt-4 text-sm font-medium text-slate-300'>Syllabus Content</p>
        <textarea onChange={(e) => setSyllabus(e.target.value)} value={syllabus} rows="4" className='border border-white/10 bg-black/20 rounded-md w-full p-2 px-3 outline-none text-sm mt-2 text-slate-300 focus:border-blue-500/50 transition-colors'
        placeholder='Paste the units/topics to be covered...' required></textarea>

        <p className='mt-4 text-sm font-medium text-cyan-400'>Question Quantities (Max 5 each)</p>
        <div className='flex gap-4 mt-2'>
          <div className='flex-1'>
            <p className='text-xs font-medium text-slate-400'>MCQs</p>
            <input onChange={(e) => setMcqCount(parseInt(e.target.value) || 0)} value={mcqCount} type="number" min="0" max="5" className='border border-white/10 bg-black/20 rounded-md w-full p-2 px-3 outline-none text-sm mt-1 text-slate-300' />
          </div>
          <div className='flex-1'>
            <p className='text-xs font-medium text-slate-400'>Short Qs</p>
            <input onChange={(e) => setShortCount(parseInt(e.target.value) || 0)} value={shortCount} type="number" min="0" max="5" className='border border-white/10 bg-black/20 rounded-md w-full p-2 px-3 outline-none text-sm mt-1 text-slate-300' />
          </div>
          <div className='flex-1'>
            <p className='text-xs font-medium text-slate-400'>Long Qs</p>
            <input onChange={(e) => setLongCount(parseInt(e.target.value) || 0)} value={longCount} type="number" min="0" max="5" className='border border-white/10 bg-black/20 rounded-md w-full p-2 px-3 outline-none text-sm mt-1 text-slate-300' />
          </div>
        </div>

        <button disabled={loading} className='w-full flex justify-center items-center gap-2 bg-gradient-to-r 
        from-blue-600 to-cyan-500 text-white px-4 py-3 mt-6 text-sm rounded-lg cursor-pointer hover:scale-[1.02] active:scale-95 transition-all shadow-[0_0_15px_rgba(59,130,246,0.4)] font-medium' >
          {loading ? <span className='w-4 h-4 my-1 rounded-full border-2 border-t-transparent animate-spin'></span> : <Edit className='w-5' />}
          Generate Paper
        </button>
      </form>

      {/* right col */}
        <div className='w-full max-w-lg p-6 bg-white/5 backdrop-blur-xl rounded-xl flex flex-col border 
        border-white/10 shadow-lg min-h-[400px] max-h-[600px] transition-colors hover:bg-white/10'>
          <div className='flex items-center justify-between mb-4'>
            <div className='flex items-center gap-3'>
              <Edit className='w-5 h-5 text-blue-400 drop-shadow-[0_0_10px_rgba(96,165,250,0.8)]' />
              <h1 className='text-xl font-semibold' >Generated Paper</h1>
            </div>
            <div className='flex gap-2 flex-wrap justify-end'>
              {answerKeyContent && (
                <button onClick={handleDownloadAnswerKeyPdf} type='button' className='flex items-center gap-2 text-xs text-emerald-400 border border-emerald-500/50 px-3 py-1.5 rounded-lg hover:bg-emerald-500/10 transition-colors cursor-pointer'>
                  <Download className='w-4 h-4' />
                  Answer Key PDF
                </button>
              )}
              {content && (
                <button onClick={handleDownloadPdf} type='button' className='flex items-center gap-2 text-xs text-cyan-400 border border-cyan-500/50 px-3 py-1.5 rounded-lg hover:bg-cyan-500/10 transition-colors cursor-pointer'>
                  <Download className='w-4 h-4' />
                  Paper PDF
                </button>
              )}
            </div>
          </div>

          {!content ? (<div className='flex-1 flex justify-center items-center'>
            <div className='text-sm flex flex-col items-center gap-5 text-slate-400 text-center'>
              <Edit className='w-12 h-12 opacity-50' />
              <p>Configure your question paper and click generate.</p>
            </div>

          </div>
          ) : (
            <div className='h-full overflow-y-scroll pr-2 text-sm text-slate-300'>
              <div id="pdf-content" className='reset-tw bg-black/20 p-4 mb-4 rounded-lg'>
                <Markdown>{content}</Markdown>
              </div>

              {answerKeyContent && (
                <div className='mt-6 border-t pt-4 border-white/10'>
                  <h2 className='text-lg font-semibold mb-2 text-white'>Answer Key Preview</h2>
                  <div id="answer-key-content" className='reset-tw bg-black/20 p-4 border border-white/5 rounded-lg'>
                    <Markdown>{answerKeyContent}</Markdown>
                  </div>
                </div>
              )}
            </div>
            )
          }
          
        </div>
    </motion.div>
  )
}

export default GenerateQuestionPaper
