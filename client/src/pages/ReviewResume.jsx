import React, { useState } from 'react'
import { motion } from 'framer-motion'
import {Eraser, FileText, Sparkles } from 'lucide-react'
import axios from "axios";
import { useAuth } from "@clerk/clerk-react";
import toast from "react-hot-toast";
import FormData from 'form-data';
import Markdown from "react-markdown";

import { getApiBaseUrl } from '../utils/resolveUrl';

axios.defaults.baseURL = getApiBaseUrl();

const ReviewResume = () => {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState("");
    
  const { getToken } = useAuth(); 
  
  const onSubmitHandler = async (e) => {
      e.preventDefault();
      try {
        setLoading(true);

         
        const formData = new FormData();
        formData.append('resume', input);

        const { data } = await axios.post(
          "/api/ai/resume-review",
          formData,
          {
            headers: {
              Authorization: `Bearer ${await getToken()}`,
            },
          }
        );
        if (data.success) {
          setContent(data.content);
          toast.success("Resume Reviewed successfully!");
        } else {
          toast.error(data.message);
        }
      } catch (error) {
        toast.error(error.message);
      }
      setLoading(false);
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className='h-full overflow-y-scroll p-6 flex items-start flex-wrap gap-4 text-white'
    >
      {/* left col */}
      <form onSubmit={onSubmitHandler} className='w-full max-w-lg p-6 bg-white/5 backdrop-blur-xl rounded-xl border border-white/10 shadow-lg transition-colors hover:bg-white/10'>
        <div className='flex items-center gap-3'>
          <Sparkles className='w-6 text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.8)]'/>
          <h1 className='text-xl font-semibold'>Resume Review</h1>
        </div>

        <p className='mt-6 text-sm font-medium text-slate-300'>Upload Resume</p>
        <input onChange={(e) => setInput(e.target.files[0])} type="file" accept='application/pdf'
         className='border border-white/10 bg-black/20 rounded-md w-full p-2 px-3 outline-none text-sm text-slate-300 mt-2 focus:border-emerald-500/50 transition-colors' required/>

        <p className='text-xs text-slate-500 font-light mt-1'>Supports PDF resume only.</p>
        
        <button className='w-full flex justify-center items-center gap-2 bg-gradient-to-r 
        from-emerald-500 to-cyan-500 text-white px-4 py-3 mt-6 text-sm rounded-lg cursor-pointer hover:scale-[1.02] active:scale-95 transition-all shadow-[0_0_15px_rgba(16,185,129,0.4)] font-medium' >
          {
            loading ? <span className='w-4 h-4 my-1 rounded-full border-2 border-t-transparent animate-spin'></span> : <FileText className='w-5' />
          }
          
          Review Resume
        </button>
      </form>

      {/* right col */}
        <div className='w-full max-w-lg p-6 bg-white/5 backdrop-blur-xl rounded-xl flex flex-col border 
        border-white/10 shadow-lg min-h-[400px] max-h-[600px] transition-colors hover:bg-white/10'>
          <div className='flex items-center gap-3 mb-4'>
            <FileText className='w-5 h-5 text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.8)]' />
            <h1 className='text-xl font-semibold' >Analysis Results</h1>
          </div>

          {
            !content ? (
              <div className='flex-1 flex justify-center items-center'>
            <div className='text-sm flex flex-col items-center gap-5 text-slate-400 text-center'>
              <FileText className='w-12 h-12 opacity-50' />
              <p>Upload a resume and click "Review Resume" to get started</p> 
            </div>

          </div>
            ) : (
              <div className='h-full overflow-y-scroll text-sm text-slate-300 bg-black/20 p-4 rounded-lg'>
                <div className='reset-tw'>
                  <Markdown>{content}</Markdown>
                </div>
              </div>

            )

          }
          
        </div>


    </motion.div>

    
  )
}

export default ReviewResume
