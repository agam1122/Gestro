import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Eraser, FileText, Sparkles, Mic, MicOff, Send, Volume2, VolumeX, X, Play, Award, FileDown } from 'lucide-react'
import axios from "axios";
import { useAuth } from "@clerk/clerk-react";
import toast from "react-hot-toast";
import FormData from 'form-data';
import Markdown from "react-markdown";
import html2pdf from 'html2pdf.js'

import { getApiBaseUrl } from '../utils/resolveUrl';

axios.defaults.baseURL = getApiBaseUrl();

const ReviewResume = () => {
  // Resume upload states
  const [fileInput, setFileInput] = useState(null);
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState("");
  const [resumeText, setResumeText] = useState("");
  
  // Interview Simulator states
  const [isInterviewOpen, setIsInterviewOpen] = useState(false);
  const [chatHistory, setChatHistory] = useState([]); // [{ role: 'user' | 'assistant', text: '...' }]
  const [inputText, setInputText] = useState('');
  const [voiceActive, setVoiceActive] = useState(false);
  const [speechMuted, setSpeechMuted] = useState(false);
  const [isSubmittingChat, setIsSubmittingChat] = useState(false);
  const [interviewReport, setInterviewReport] = useState("");
  const [isEvaluating, setIsEvaluating] = useState(false);

  const { getToken } = useAuth();
  const recognitionRef = useRef(null);
  const chatEndRef = useRef(null);

  // Auto-scroll chat window
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, isSubmittingChat]);

  // Handle SpeechSynthesis audio questions
  const speakQuestion = (text) => {
    if (speechMuted) return;
    window.speechSynthesis.cancel(); // Stop any currently speaking voice
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Choose a clean English voice
    const voices = window.speechSynthesis.getVoices();
    const naturalVoice = voices.find(v => v.lang.startsWith('en') && v.name.includes('Google')) || voices.find(v => v.lang.startsWith('en'));
    if (naturalVoice) utterance.voice = naturalVoice;
    
    window.speechSynthesis.speak(utterance);
  };

  // Safe voice capture handler (STT)
  const handleVoiceInput = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Speech recognition is not supported in this browser. Please use Chrome/Edge.");
      return;
    }

    if (voiceActive) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setVoiceActive(false);
      return;
    }

    try {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-US';

      rec.onstart = () => {
        setVoiceActive(true);
        toast.success("Listening... Speak now.", { id: 'voice-listening', duration: 2000 });
      };

      rec.onresult = (event) => {
        const text = event.results[0][0].transcript;
        setInputText(prev => prev ? `${prev} ${text}` : text);
      };

      rec.onerror = (err) => {
        console.error("STT Error:", err);
        setVoiceActive(false);
        toast.dismiss('voice-listening');
      };

      rec.onend = () => {
        setVoiceActive(false);
        toast.dismiss('voice-listening');
      };

      recognitionRef.current = rec;
      rec.start();
    } catch (err) {
      console.error(err);
      setVoiceActive(false);
    }
  };

  // Submit resume ATS analysis
  const onSubmitHandler = async (e) => {
    e.preventDefault();
    if (!fileInput) return;
    
    try {
      setLoading(true);
      setContent("");
      setResumeText("");
       
      const formData = new FormData();
      formData.append('resume', fileInput);

      const token = await getToken();
      const { data } = await axios.post(
        "/api/ai/resume-review",
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      
      if (data.success) {
        setContent(data.content);
        setResumeText(data.resumeText || "");
        toast.success("Resume reviewed successfully!");
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || error.message);
    } finally {
      setLoading(false);
    }
  };

  // Start the simulated interview room
  const startInterview = async () => {
    if (!resumeText) {
      toast.error("Please upload and review a resume first.");
      return;
    }

    setIsInterviewOpen(true);
    setChatHistory([]);
    setInterviewReport("");
    setIsSubmittingChat(true);
    
    try {
      const token = await getToken();
      const { data } = await axios.post('/api/ai/interview-chat', {
        history: [],
        resumeText
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (data.success && data.question) {
        setChatHistory([{ role: 'assistant', text: data.question }]);
        speakQuestion(data.question);
      } else {
        toast.error("Failed to start mock interview.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error connecting to interview server.");
    } finally {
      setIsSubmittingChat(false);
    }
  };

  // Send answer and fetch follow-up question
  const submitAnswer = async (e) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isSubmittingChat) return;

    const candidateAnswer = inputText.trim();
    const updatedHistory = [...chatHistory, { role: 'user', text: candidateAnswer }];
    
    setChatHistory(updatedHistory);
    setInputText('');
    setIsSubmittingChat(true);

    try {
      const token = await getToken();
      const { data } = await axios.post('/api/ai/interview-chat', {
        history: updatedHistory,
        resumeText
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (data.success && data.question) {
        setChatHistory(prev => [...prev, { role: 'assistant', text: data.question }]);
        speakQuestion(data.question);
      } else {
        toast.error("Could not fetch follow-up question.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error communicating with AI interviewer.");
    } finally {
      setIsSubmittingChat(false);
    }
  };

  // Terminate interview and generate review scorecard
  const triggerInterviewAnalysis = async () => {
    if (chatHistory.length < 2) {
      toast.error("The interview is too short to evaluate. Answer at least one question.");
      return;
    }

    setIsEvaluating(true);
    setInterviewReport("");
    window.speechSynthesis.cancel(); // Stop talking
    const toastId = toast.loading("Evaluating your interview scorecard...");

    try {
      const token = await getToken();
      const { data } = await axios.post('/api/ai/analyze-interview', {
        history: chatHistory,
        resumeText
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (data.success && data.content) {
        setInterviewReport(data.content);
        toast.dismiss(toastId);
        toast.success("Evaluation complete!");
      } else {
        toast.dismiss(toastId);
        toast.error("Failed to compile evaluation scorecard.");
      }
    } catch (err) {
      toast.dismiss(toastId);
      console.error(err);
      toast.error("Error compiling interview report.");
    } finally {
      setIsEvaluating(false);
    }
  };

  // Download final scorecard PDF
  const downloadInterviewReportPDF = () => {
    if (!interviewReport) return;
    const toastId = toast.loading("Downloading PDF scorecard...");

    try {
      const element = document.createElement('div');
      element.innerHTML = `
        <div style="padding: 30px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1e293b; background-color: #ffffff; min-height: 297mm; box-sizing: border-box; line-height: 1.6;">
          <div style="border-bottom: 2px solid #10b981; padding-bottom: 20px; margin-bottom: 25px; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <h1 style="color: #059669; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.025em; text-transform: uppercase;">Interview Performance Scorecard</h1>
              <p style="color: #64748b; margin: 5px 0 0 0; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em;">GESTRO AI Mock Interview Simulator</p>
            </div>
            <div style="text-align: right;">
              <span style="background-color: #ecfdf5; color: #065f46; padding: 6px 12px; border-radius: 20px; font-size: 10px; font-weight: bold; border: 1px solid #a7f3d0; font-family: monospace;">AI SCORE CARD</span>
              <p style="color: #94a3b8; margin: 5px 0 0 0; font-size: 10px; font-weight: 500;">Date: ${new Date().toLocaleDateString()}</p>
            </div>
          </div>
          
          <div style="font-size: 13px; color: #334155; margin-bottom: 30px; line-height: 1.8;">
            ${interviewReport.split('\n').map(line => {
              const clean = line.trim();
              if (clean.startsWith('# ')) {
                return `<h1 style="color: #064e3b; font-size: 20px; font-weight: 800; margin-top: 25px; margin-bottom: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">${clean.replace('# ', '')}</h1>`;
              } else if (clean.startsWith('## ')) {
                return `<h2 style="color: #065f46; font-size: 16px; font-weight: 700; margin-top: 20px; margin-bottom: 10px;">${clean.replace('## ', '')}</h2>`;
              } else if (clean.startsWith('### ')) {
                return `<h3 style="color: #047857; font-size: 14px; font-weight: 700; margin-top: 15px; margin-bottom: 8px;">${clean.replace('### ', '')}</h3>`;
              } else if (clean.startsWith('- ') || clean.startsWith('* ')) {
                return `<li style="margin-left: 20px; margin-bottom: 6px; list-style-type: square; color: #475569;">${clean.replace(/^[-*]\s+/, '')}</li>`;
              } else if (clean.match(/^\d+\.\s+/)) {
                return `<li style="margin-left: 20px; margin-bottom: 6px; list-style-type: decimal; color: #475569;">${clean.replace(/^\d+\.\s+/, '')}</li>`;
              } else if (clean === '') {
                return '<div style="height: 10px;"></div>';
              } else {
                return `<p style="margin: 0 0 10px 0; color: #334155;">${clean}</p>`;
              }
            }).join('')}
          </div>
          
          <div style="border-top: 1px solid #e2e8f0; padding-top: 15px; text-align: center; font-size: 9px; color: #94a3b8; margin-top: 40px; font-family: monospace; letter-spacing: 0.05em;">
            &bull; SYSTEM GENERATED REPORT &bull; FOR GESTRO CAREER WORKSPACE &bull;
          </div>
        </div>
      `;

      const options = {
        margin: 10,
        filename: `Gestro-Interview-Scorecard-${new Date().toISOString().slice(0, 10)}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      html2pdf().from(element).set(options).save().then(() => {
        toast.dismiss(toastId);
        toast.success("Report PDF downloaded successfully!");
      }).catch(err => {
        toast.dismiss(toastId);
        console.error("PDF generation failed:", err);
        toast.error("Failed to generate PDF.");
      });
    } catch (error) {
      toast.dismiss(toastId);
      console.error("PDF generation error:", error);
      toast.error("An error occurred during PDF generation.");
    }
  };

  // Terminate simulated session
  const closeInterview = () => {
    setIsInterviewOpen(false);
    setChatHistory([]);
    setInterviewReport("");
    window.speechSynthesis.cancel(); // Stop talking
  };

  return (
    <div className="h-full w-full relative">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className='h-full overflow-y-auto p-6 flex flex-col xl:flex-row items-stretch justify-start gap-6 text-white bg-transparent'
      >
        {/* Left column: Resume uploader */}
        <div className='flex-1 max-w-xl flex flex-col gap-6'>
          <form onSubmit={onSubmitHandler} className='p-6 bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 shadow-lg transition-all hover:bg-white/10 flex flex-col justify-between'>
            <div>
              <div className='flex items-center gap-3'>
                <Sparkles className='w-6 text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.8)]'/>
                <h1 className='text-xl font-bold'>Resume Review</h1>
              </div>

              <p className='mt-6 text-xs font-bold text-slate-400 uppercase tracking-wider'>Upload Resume</p>
              <input 
                onChange={(e) => setFileInput(e.target.files[0])} 
                type="file" 
                accept='application/pdf'
                className='border border-white/10 bg-black/20 rounded-xl w-full p-3 outline-none text-sm text-slate-300 mt-2 focus:border-emerald-500/50 transition-colors file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-white/10 file:text-white hover:file:bg-white/20' 
                required
              />
              <p className='text-[10px] text-slate-500 mt-1.5'>Supports PDF resume only (Max 5MB).</p>
            </div>
            
            <button type="submit" className='w-full flex justify-center items-center gap-2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white px-4 py-3.5 mt-8 text-sm font-bold rounded-xl cursor-pointer hover:scale-[1.02] active:scale-95 transition-all shadow-[0_0_15px_rgba(16,185,129,0.4)]' >
              {
                loading ? <span className='w-4 h-4 my-1 rounded-full border-2 border-t-transparent animate-spin'></span> : <FileText className='w-5' />
              }
              Review Resume
            </button>
          </form>

          {/* Prompt card for Mock Interview */}
          {resumeText && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-6 bg-gradient-to-br from-emerald-950/40 to-slate-900/60 backdrop-blur-xl rounded-3xl border border-emerald-500/20 shadow-2xl flex flex-col justify-between"
            >
              <div>
                <h2 className="text-lg font-bold text-emerald-400 flex items-center gap-2 mb-2">
                  <Play className="w-5 h-5 fill-emerald-400 animate-pulse" /> AI Interview Practice Ready!
                </h2>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Based on your resume, we have prepared a customized technical and HR mock interview session. Test your skills, respond with voice, and get evaluated instantly.
                </p>
              </div>
              <button 
                onClick={startInterview}
                className="w-full flex justify-center items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-4 py-3.5 mt-6 text-sm font-bold rounded-xl cursor-pointer transition-all hover:scale-[1.02] active:scale-95 shadow-[0_0_20px_rgba(16,185,129,0.3)]"
              >
                <Sparkles className="w-4 h-4" /> Start AI Interview Prep
              </button>
            </motion.div>
          )}
        </div>

        {/* Right column: Results display */}
        <div className='flex-1 p-6 bg-white/5 backdrop-blur-xl rounded-3xl flex flex-col border border-white/10 shadow-lg min-h-[450px] transition-all hover:bg-white/10'>
          <div className='flex items-center gap-3 mb-4'>
            <FileText className='w-5 h-5 text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.8)]' />
            <h1 className='text-xl font-bold'>Analysis Scorecard</h1>
          </div>

          {
            !content ? (
              <div className='flex-1 flex justify-center items-center'>
                <div className='text-sm flex flex-col items-center gap-4 text-slate-400 text-center max-w-xs'>
                  <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-1">
                    <FileText className='w-8 h-8 opacity-40' />
                  </div>
                  <h3 className="font-semibold text-white">Review Pending</h3>
                  <p className="text-xs font-light text-slate-500">Upload your PDF resume on the left to analyze missing skills, ATS compatibility, and formatting tips.</p> 
                </div>
              </div>
            ) : (
              <div className='flex-1 overflow-y-auto text-sm text-slate-300 bg-black/30 p-5 rounded-2xl border border-white/5 text-left select-text'>
                <div className='reset-tw prose prose-invert max-w-none text-xs leading-relaxed'>
                  <Markdown>{content}</Markdown>
                </div>
              </div>
            )
          }
        </div>
      </motion.div>

      {/* INTERVIEW SIMULATOR OVERLAY MODAL */}
      <AnimatePresence>
        {isInterviewOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-4xl h-[85vh] bg-slate-950 border border-emerald-500/20 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
              style={{ boxShadow: '0 20px 50px -10px rgba(16, 185, 129, 0.2)' }}
            >
              {/* Header */}
              <div className="p-5 border-b border-white/10 bg-slate-900/80 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <div>
                    <h2 className="text-sm font-bold text-white flex items-center gap-2">
                      Gestro Mock Interviewer
                    </h2>
                    <p className="text-[10px] text-slate-400">Audio & Chat-based Interview Room</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setSpeechMuted(!speechMuted)}
                    className={`p-2 rounded-lg border transition-all cursor-pointer ${speechMuted ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-white/5 border-white/10 text-emerald-400'}`}
                    title={speechMuted ? "Unmute Interviewer Voice" : "Mute Interviewer Voice"}
                  >
                    {speechMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </button>
                  <button 
                    onClick={closeInterview}
                    className="p-2 bg-white/5 border border-white/10 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white cursor-pointer transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Main Body */}
              <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
                
                {/* Left Side: Live chat log */}
                <div className="flex-1 flex flex-col min-w-0 bg-transparent border-b md:border-b-0 md:border-r border-white/10 h-full">
                  <div className="flex-1 overflow-y-auto p-5 space-y-4">
                    {chatHistory.map((item, index) => (
                      <div key={index} className={`flex items-start gap-3 ${item.role === 'user' ? 'flex-row-reverse text-right' : 'text-left'}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border ${
                          item.role === 'user' 
                            ? 'bg-gradient-to-r from-emerald-600 to-teal-600 border-emerald-400/20 text-white' 
                            : 'bg-slate-900 border-white/10 text-purple-400'
                        }`}>
                          {item.role === 'user' ? 'You' : 'AI'}
                        </div>
                        
                        <div className="flex flex-col max-w-[80%]">
                          <span className="text-[10px] text-slate-500 mb-0.5 font-medium px-1">
                            {item.role === 'user' ? 'Candidate' : 'Interviewer'}
                          </span>
                          <div className={`p-3.5 rounded-2xl text-xs leading-relaxed shadow-lg select-text ${
                            item.role === 'user' 
                              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-tr-none' 
                              : 'bg-white/5 backdrop-blur-md text-white rounded-tl-none border border-white/5 text-slate-200'
                          }`}>
                            {item.text}
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {isSubmittingChat && (
                      <div className="flex items-start gap-3 text-left">
                        <div className="w-8 h-8 rounded-full bg-slate-900 border border-white/10 text-purple-400 flex items-center justify-center shrink-0">
                          AI
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] text-slate-500 mb-0.5 font-medium">Interviewer</span>
                          <div className="p-3.5 bg-white/5 border border-white/5 rounded-2xl rounded-tl-none flex items-center gap-1.5 py-3">
                            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span>
                            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  {/* Input Form */}
                  <form onSubmit={submitAnswer} className="p-4 border-t border-white/10 bg-slate-900/40 flex items-center gap-3">
                    <button 
                      type="button"
                      onClick={handleVoiceInput}
                      className={`p-3 rounded-xl border transition-all cursor-pointer shrink-0 ${
                        voiceActive 
                          ? 'bg-red-500/20 border-red-500/40 text-red-400 animate-pulse' 
                          : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white'
                      }`}
                      title={voiceActive ? "Stop voice transcription" : "Speak answer (Speech-to-Text)"}
                    >
                      {voiceActive ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    </button>
                    
                    <input 
                      type="text"
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder="Type or speak your answer here..."
                      className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 transition-colors"
                      disabled={isSubmittingChat}
                    />

                    <button 
                      type="submit"
                      disabled={!inputText.trim() || isSubmittingChat}
                      className="p-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800/40 text-white rounded-xl transition-all cursor-pointer shrink-0 disabled:cursor-not-allowed shadow-md"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                </div>

                {/* Right Side: Evaluation Scorecard Display */}
                <div className="w-full md:w-96 flex flex-col bg-slate-950 h-full p-5 justify-between min-h-0">
                  <div className="flex-1 flex flex-col min-h-0">
                    <div className="flex items-center gap-2 mb-3 border-b border-white/10 pb-2">
                      <Award className="w-5 h-5 text-emerald-400" />
                      <h3 className="text-sm font-bold text-white">AI Evaluation Scorecard</h3>
                    </div>

                    {isEvaluating ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-center gap-3">
                        <span className="w-8 h-8 rounded-full border-3 border-emerald-500 border-t-transparent animate-spin"></span>
                        <p className="text-xs text-slate-400">Analysing your transcripts & scoring answers...</p>
                      </div>
                    ) : interviewReport ? (
                      <div className="flex-1 overflow-y-auto text-slate-300 text-xs bg-black/40 border border-white/5 p-4 rounded-xl text-left select-text max-h-[50vh] md:max-h-none">
                        <div className="reset-tw prose prose-invert prose-emerald leading-relaxed">
                          <Markdown>{interviewReport}</Markdown>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-500 gap-2.5 p-4">
                        <Award className="w-10 h-10 opacity-30 text-emerald-400" />
                        <p className="text-xs font-medium">Interview scorecard pending</p>
                        <p className="text-[10px] text-slate-600 max-w-[200px]">Complete the interview session and click "End & Evaluate" below to generate a detailed scorecard.</p>
                      </div>
                    )}
                  </div>

                  <div className="pt-4 border-t border-white/10 flex flex-col gap-2">
                    {interviewReport ? (
                      <button 
                        onClick={downloadInterviewReportPDF}
                        className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-lg hover:scale-[1.02]"
                      >
                        <FileDown className="w-4 h-4" /> Download Scorecard (PDF)
                      </button>
                    ) : (
                      <button 
                        onClick={triggerInterviewAnalysis}
                        disabled={chatHistory.length < 2 || isEvaluating}
                        className={`w-full py-3 rounded-xl text-xs font-bold transition-all shadow-md text-center flex items-center justify-center gap-1.5 cursor-pointer ${
                          chatHistory.length < 2 || isEvaluating
                            ? 'bg-emerald-800/40 text-slate-500 cursor-not-allowed border border-white/5'
                            : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white hover:scale-[1.02] active:scale-95'
                        }`}
                      >
                        End & Evaluate Interview
                      </button>
                    )}
                  </div>
                </div>

              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default ReviewResume
