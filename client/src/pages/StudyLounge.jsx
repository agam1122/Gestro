import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Pause, RotateCcw, Plus, Trash2, Sparkles, BookOpen, CheckSquare, Eye, Coffee, HelpCircle, Sun, Moon } from 'lucide-react'
import DeskScene from '../components/DeskScene'
import toast from 'react-hot-toast'
import html2pdf from 'html2pdf.js'



const StudyLounge = () => {
  // Responsive / Mobile Interaction State
  const [isMobile, setIsMobile] = useState(false)
  const [is3DActive, setIs3DActive] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1280) // 1280px matches tailwind xl
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // 3D Scene Interactive State
  const [cameraPreset, setCameraPreset] = useState('desk') // desk, focus, wide
  const [lampOn, setLampOn] = useState(true)
  const [coffeeSteam, setCoffeeSteam] = useState(true)

  // Pomodoro Timer State
  const [timerStatus, setTimerStatus] = useState('study') // study (25m), shortBreak (5m), longBreak (15m)
  const [timeLeft, setTimeLeft] = useState(25 * 60)
  const [isRunning, setIsRunning] = useState(false)

  const totalDuration = timerStatus === 'study' ? 25 * 60 : timerStatus === 'shortBreak' ? 5 * 60 : 15 * 60

  const [notes, setNotes] = useState(() => {
    return localStorage.getItem('study_lounge_notes') || ''
  })

  // Auto-save notes to localStorage
  useEffect(() => {
    localStorage.setItem('study_lounge_notes', notes)
  }, [notes])



  // To-do Checklist State
  const [tasks, setTasks] = useState(() => {
    const saved = localStorage.getItem('study_lounge_tasks')
    return saved ? JSON.parse(saved) : []
  })
  const [taskInput, setTaskInput] = useState('')

  // Sync tasks to localStorage
  useEffect(() => {
    localStorage.setItem('study_lounge_tasks', JSON.stringify(tasks))
  }, [tasks])

  // Synthesize double-chime alarm sound via Web Audio API (Zero dependency chime)
  const playAlarmChime = () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext
      if (!AudioContext) return
      const ctx = new AudioContext()
      
      const playChimeNode = (time, freq) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq, time)
        
        gain.gain.setValueAtTime(0, time)
        gain.gain.linearRampToValueAtTime(0.25, time + 0.04)
        gain.gain.exponentialRampToValueAtTime(0.0001, time + 1.0)
        
        osc.connect(gain)
        gain.connect(ctx.destination)
        
        osc.start(time)
        osc.stop(time + 1.0)
      }
      
      const now = ctx.currentTime
      playChimeNode(now, 523.25) // C5
      playChimeNode(now + 0.12, 659.25) // E5
    } catch (err) {
      console.warn("Web Audio API Chime failed to play:", err)
    }
  }

  // Pomodoro timer core countdown logic
  useEffect(() => {
    let intervalId = null
    if (isRunning) {
      intervalId = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(intervalId)
            setIsRunning(false)
            playAlarmChime()
            
            // Auto transition state
            if (timerStatus === 'study') {
              toast.success("Congratulations! Focus block complete. Time for a short break!")
              setTimerStatus('shortBreak')
              return 5 * 60
            } else {
              toast.success("Break complete! Ready to start focusing again?")
              setTimerStatus('study')
              return 25 * 60
            }
          }
          return prev - 1
        })
      }, 1000)
    }
    return () => clearInterval(intervalId)
  }, [isRunning, timerStatus])



  // Add Task to checklist
  const addTask = (e) => {
    e.preventDefault()
    if (!taskInput.trim()) return
    setTasks([...tasks, { id: Date.now(), text: taskInput.trim(), completed: false }])
    setTaskInput('')
    toast.success("Task added!")
  }

  // Toggle task complete
  const toggleTask = (id) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t))
  }

  // Delete Task
  const deleteTask = (id) => {
    setTasks(tasks.filter(t => t.id !== id))
    toast.error("Task removed")
  }

  // Manual reset of timer
  const resetTimer = () => {
    setIsRunning(false)
    if (timerStatus === 'study') setTimeLeft(25 * 60)
    else if (timerStatus === 'shortBreak') setTimeLeft(5 * 60)
    else setTimeLeft(15 * 60)
    toast("Timer reset")
  }

  // Change Pomodoro setting
  const changeMode = (mode) => {
    setIsRunning(false)
    setTimerStatus(mode)
    if (mode === 'study') setTimeLeft(25 * 60)
    else if (mode === 'shortBreak') setTimeLeft(5 * 60)
    else setTimeLeft(15 * 60)
    toast(`Switched to ${mode === 'study' ? 'Study' : mode === 'shortBreak' ? 'Short Break' : 'Long Break'}`)
  }

  // Formats time left (e.g. 1500 -> "25:00")
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // Exports journal notes to a beautiful styled PDF with custom markings
  const exportPDF = () => {
    if (!notes.trim()) {
      toast.error("Notepad is empty. Write some notes first!")
      return
    }

    const toastId = toast.loading("Generating PDF...")
    try {
      const element = document.createElement('div')
      element.innerHTML = `
        <div style="font-family: 'Georgia', 'Times New Roman', serif; padding: 40px; background: #fffbeb; color: #1e293b; border: 3px double #b45309; min-height: 800px; display: flex; flex-direction: column; justify-content: space-between; box-sizing: border-box;">
          <div>
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #b45309; padding-bottom: 12px; margin-bottom: 30px;">
              <div>
                <h1 style="font-size: 24px; color: #78350f; font-weight: bold; margin: 0; letter-spacing: 0.05em;">STUDY JOURNAL NOTES</h1>
                <p style="font-size: 10px; color: #92400e; margin: 4px 0 0 0; font-family: monospace; text-transform: uppercase; letter-spacing: 0.1em;">GESTRO Focus Lounge</p>
              </div>
              <div style="text-align: right;">
                <p style="font-size: 11px; color: #78350f; font-weight: bold; margin: 0;">DATE: ${new Date().toLocaleDateString()}</p>
                <p style="font-size: 9px; color: #92400e; margin: 2px 0 0 0; font-family: monospace;">TIME: ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            </div>
            
            <div style="font-size: 13px; line-height: 1.7; white-space: pre-wrap; color: #334155; padding: 0 10px;">
              ${notes.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}
            </div>
          </div>
          
          <div style="border-top: 1px solid #e2e8f0; padding-top: 15px; text-align: center; font-size: 9px; color: #94a3b8; margin-top: 40px; font-family: monospace; letter-spacing: 0.05em;">
            &bull; DOWNLOADED FROM GESTRO STUDY LOUNGE &bull; KEEP FOCUSING &bull;
          </div>
        </div>
      `
      
      const options = {
        margin: 10,
        filename: `Study-Journal-Notes-${new Date().toISOString().slice(0, 10)}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      }

      html2pdf().from(element).set(options).save().then(() => {
        toast.dismiss(toastId)
        toast.success("PDF downloaded successfully!")
      }).catch(err => {
        toast.dismiss(toastId)
        console.error("PDF generation failed:", err)
        toast.error("Failed to generate PDF.")
      })
    } catch (error) {
      toast.dismiss(toastId)
      console.error("PDF generation error:", error)
      toast.error("Failed to generate PDF.")
    }
  }

  const showOverlay = isMobile && !is3DActive

  return (
    <div className="w-full flex flex-col xl:flex-row p-4 md:p-6 gap-4 md:gap-6 text-white xl:h-full xl:overflow-hidden bg-transparent relative">
      {/* Decorative Glowing Background Blurs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none z-0" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-500/10 blur-[120px] pointer-events-none z-0" />
      
      {/* LEFT: 3D Scene Viewport */}
      <div className="w-full flex-1 h-[320px] md:h-[450px] xl:h-full relative flex flex-col bg-slate-950/20 border border-white/10 backdrop-blur-2xl rounded-3xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] shadow-indigo-950/10 z-10">
        
        {/* Header Overlay info */}
        <div className="absolute top-4 left-4 z-20 flex items-center gap-2.5 px-4 py-2 bg-black/40 backdrop-blur-md rounded-xl border border-white/10 shadow-lg pointer-events-none">
          <Coffee className="w-4 h-4 text-pink-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-200">Study Desk Lounge</span>
        </div>

        {/* Lock Camera Button on Mobile */}
        {isMobile && is3DActive && (
          <button
            onClick={() => setIs3DActive(false)}
            className="absolute top-4 right-4 z-30 px-3 py-1.5 bg-red-600/90 hover:bg-red-600 text-white rounded-xl text-[10px] font-bold transition-all active:scale-95 shadow-lg border border-white/15 cursor-pointer flex items-center gap-1.5"
          >
            <span>Lock Camera 🔒</span>
          </button>
        )}

        {/* 3D Scene Controls (Floating bottom left) */}
        <div className="absolute bottom-3 left-3 right-3 md:right-auto z-20 flex flex-wrap items-center justify-center md:justify-start gap-1 md:gap-2 p-1.5 md:p-2 bg-black/45 backdrop-blur-md rounded-2xl border border-white/10 shadow-lg">
          <button
            onClick={() => setCameraPreset('desk')}
            className={`px-2 py-1 md:px-3 md:py-1.5 rounded-lg text-[10px] md:text-xs font-semibold transition-all cursor-pointer ${cameraPreset === 'desk' ? 'bg-white/15 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Desk
          </button>
          <button
            onClick={() => setCameraPreset('focus')}
            className={`px-2 py-1 md:px-3 md:py-1.5 rounded-lg text-[10px] md:text-xs font-semibold transition-all cursor-pointer ${cameraPreset === 'focus' ? 'bg-white/15 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Focus
          </button>
          <button
            onClick={() => setCameraPreset('wide')}
            className={`px-2 py-1 md:px-3 md:py-1.5 rounded-lg text-[10px] md:text-xs font-semibold transition-all cursor-pointer ${cameraPreset === 'wide' ? 'bg-white/15 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Wide
          </button>
          <button
            onClick={() => setCameraPreset(cameraPreset === 'notebook' ? 'desk' : 'notebook')}
            className={`px-2 py-1 md:px-3 md:py-1.5 rounded-lg text-[10px] md:text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 md:gap-1.5 ${cameraPreset === 'notebook' ? 'bg-amber-500/25 text-amber-300' : 'text-slate-400 hover:text-white'}`}
            title="Toggle Study Journal Notebook View"
          >
            <span>Journal</span>
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          </button>
          <span className="w-[1px] h-4 md:h-5 bg-white/10 mx-0.5 md:mx-1" />
          <button
            onClick={() => setLampOn(!lampOn)}
            className={`p-1 md:p-1.5 rounded-lg transition-all cursor-pointer ${lampOn ? 'bg-amber-500/20 text-amber-400' : 'text-slate-400 hover:text-white'}`}
            title="Toggle Desk Lamp Light"
          >
            <Sun className="w-3.5 h-3.5 md:w-4 h-4" />
          </button>
          <button
            onClick={() => setCoffeeSteam(!coffeeSteam)}
            className={`p-1 md:p-1.5 rounded-lg transition-all cursor-pointer ${coffeeSteam ? 'bg-pink-500/20 text-pink-400' : 'text-slate-400 hover:text-white'}`}
            title="Toggle Coffee Steam Particles"
          >
            <Coffee className="w-3.5 h-3.5 md:w-4 h-4" />
          </button>
        </div>

        {/* The R3F Canvas component */}
        <DeskScene
          pointerEventsClass={showOverlay ? "pointer-events-none" : "pointer-events-auto"}
          cameraPreset={cameraPreset}
          setCameraPreset={setCameraPreset}
          lampOn={lampOn}
          setLampOn={setLampOn}
          coffeeSteam={coffeeSteam}
          setCoffeeSteam={setCoffeeSteam}
          timerText={formatTime(timeLeft)}
          timerStatus={timerStatus}
          timeLeft={timeLeft}
          totalDuration={totalDuration}
          notes={notes}
        />

        {/* Mobile Interaction Overlay */}
        {showOverlay && (
          <div className="absolute inset-0 bg-slate-950/30 backdrop-blur-[2px] z-25 flex flex-col items-center justify-center p-4 transition-all">
            <button
              onClick={() => setIs3DActive(true)}
              className="px-5 py-2.5 bg-indigo-600/95 hover:bg-indigo-600 text-white rounded-xl text-xs font-bold transition-all hover:scale-105 active:scale-95 shadow-lg border border-white/20 backdrop-blur-md cursor-pointer flex items-center gap-2"
            >
              <span>Tap to Navigate 3D Scene 🔍</span>
            </button>
            <p className="text-[10px] text-slate-300 mt-2.5 font-medium bg-black/60 px-3 py-1 rounded-full border border-white/5 pointer-events-none">
              Rotate, zoom & explore desk. Touch outside to scroll page.
            </p>
          </div>
        )}
      </div>

      {/* RIGHT: Study Dashboard controls / Notebook Editor */}
      <div className="w-full xl:w-96 flex flex-col gap-4 md:gap-6 shrink-0 h-auto xl:h-full xl:overflow-y-auto pr-0 xl:pr-1 z-10">
        <AnimatePresence mode="wait">
          {cameraPreset !== 'notebook' ? (
            <motion.div
              key="dashboard-controls"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col gap-6 w-full h-full"
            >
              {/* WIDGET 1: Pomodoro Control Panel */}
              <div className="bg-slate-950/40 border border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15),0_15px_35px_rgba(0,0,0,0.4)] backdrop-blur-2xl p-6 rounded-3xl">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-bold text-sm tracking-wide uppercase text-slate-300 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-400" /> Pomodoro Timer
                  </h3>
                  <span className="text-[10px] bg-white/5 px-2.5 py-0.5 border border-white/10 rounded-full font-mono font-semibold text-slate-400 uppercase tracking-widest">
                    Classic Ratios
                  </span>
                </div>

                {/* Time Picker Mode tabs */}
                <div className="grid grid-cols-3 p-1 bg-black/25 rounded-xl border border-white/5 mb-6 text-xs">
                  <button
                    onClick={() => changeMode('study')}
                    className={`py-2 rounded-lg font-semibold transition-all cursor-pointer ${timerStatus === 'study' ? 'bg-red-500/80 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                  >
                    Study
                  </button>
                  <button
                    onClick={() => changeMode('shortBreak')}
                    className={`py-2 rounded-lg font-semibold transition-all cursor-pointer ${timerStatus === 'shortBreak' ? 'bg-emerald-500/80 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                  >
                    Short <span className="hidden sm:inline">Break</span>
                  </button>
                  <button
                    onClick={() => changeMode('longBreak')}
                    className={`py-2 rounded-lg font-semibold transition-all cursor-pointer ${timerStatus === 'longBreak' ? 'bg-blue-500/80 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                  >
                    Long <span className="hidden sm:inline">Break</span>
                  </button>
                </div>

                {/* Circular Progress Ring & Numeric Countdown */}
                <div className="relative w-48 h-48 mx-auto mb-6 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90 absolute inset-0 drop-shadow-[0_0_15px_rgba(0,0,0,0.5)]" viewBox="0 0 100 100">
                    <defs>
                      <linearGradient id="dashboardTimerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor={
                          timerStatus === 'study' ? '#ec4899' :
                          timerStatus === 'shortBreak' ? '#059669' : '#2563eb'
                        } />
                        <stop offset="100%" stopColor={
                          timerStatus === 'study' ? '#ef4444' :
                          timerStatus === 'shortBreak' ? '#34d399' : '#60a5fa'
                        } />
                      </linearGradient>
                      <filter id="dashboardTimerGlow" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="3" result="blur" />
                        <feMerge>
                          <feMergeNode in="blur" />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                    </defs>
                    
                    {/* Outer Track */}
                    <circle
                      cx="50"
                      cy="50"
                      r="42"
                      stroke="rgba(255, 255, 255, 0.03)"
                      strokeWidth="4"
                      fill="transparent"
                    />

                    {/* Glowing ring underlay */}
                    <circle
                      cx="50"
                      cy="50"
                      r="42"
                      stroke="url(#dashboardTimerGrad)"
                      strokeWidth="4.5"
                      fill="transparent"
                      strokeDasharray="263.89"
                      strokeDashoffset={263.89 * (1 - (totalDuration ? (timeLeft / totalDuration) : 1))}
                      strokeLinecap="round"
                      filter="url(#dashboardTimerGlow)"
                      opacity="0.4"
                      className="transition-[stroke-dashoffset] duration-1000 ease-linear"
                    />

                    {/* Main Ring */}
                    <circle
                      cx="50"
                      cy="50"
                      r="42"
                      stroke="url(#dashboardTimerGrad)"
                      strokeWidth="4"
                      fill="transparent"
                      strokeDasharray="263.89"
                      strokeDashoffset={263.89 * (1 - (totalDuration ? (timeLeft / totalDuration) : 1))}
                      strokeLinecap="round"
                      className="transition-[stroke-dashoffset] duration-1000 ease-linear"
                    />
                  </svg>

                  {/* Centered Content */}
                  <div className="text-center z-10 flex flex-col items-center justify-center">
                    <motion.h1 
                      key={timeLeft}
                      initial={{ scale: 0.94, opacity: 0.9 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                      className="text-4xl font-mono font-black leading-none tracking-tight text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]"
                    >
                      {formatTime(timeLeft)}
                    </motion.h1>
                    <div className={`mt-2 px-2.5 py-0.5 rounded-full text-[8px] font-bold tracking-widest uppercase border ${
                      timerStatus === 'study' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                      timerStatus === 'shortBreak' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                      'bg-blue-500/10 border-blue-500/20 text-blue-400'
                    }`}>
                      {timerStatus === 'study' ? 'Studying' : 'Resting'}
                    </div>
                  </div>
                </div>

                {/* Controller Triggers */}
                <div className="flex gap-4">
                  <button
                    onClick={() => setIsRunning(!isRunning)}
                    className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm text-white flex justify-center items-center gap-2 hover:scale-[1.02] active:scale-95 transition-all shadow-md cursor-pointer ${
                      isRunning 
                        ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/30' 
                        : 'bg-gradient-to-r from-blue-600 to-indigo-600 shadow-blue-600/30'
                    }`}
                  >
                    {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    {isRunning ? 'Pause Timer' : 'Start Session'}
                  </button>
                  <button
                    onClick={resetTimer}
                    className="p-3 bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 rounded-xl transition-all hover:text-white active:scale-95 cursor-pointer shadow-md"
                    title="Reset Timer"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* WIDGET 3: Simple Study Todo Board */}
              <div className="bg-slate-950/40 border border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15),0_15px_35px_rgba(0,0,0,0.4)] backdrop-blur-2xl p-6 rounded-3xl flex-1 flex flex-col min-h-[300px]">
                <h3 className="font-bold text-sm tracking-wide uppercase text-slate-300 flex items-center gap-2 mb-4">
                  <CheckSquare className="w-4 h-4 text-pink-400" /> Study Checklist
                </h3>

                {/* Form to add task */}
                <form onSubmit={addTask} className="flex gap-2 mb-4">
                  <input
                    type="text"
                    value={taskInput}
                    onChange={(e) => setTaskInput(e.target.value)}
                    placeholder="Study goal for this block..."
                    className="flex-1 bg-black/35 border border-white/10 text-white placeholder-slate-500 px-3.5 py-2 rounded-xl focus:border-pink-500/50 focus:outline-none text-xs"
                  />
                  <button
                    type="submit"
                    className="p-2.5 bg-pink-600 hover:bg-pink-500 text-white rounded-xl transition-all cursor-pointer shadow-md hover:scale-105 active:scale-95 flex items-center justify-center"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </form>

                {/* Tasks list */}
                <div className="flex-1 overflow-y-auto max-h-[160px] space-y-2">
                  <AnimatePresence>
                    {tasks.map((task) => (
                      <motion.div
                        key={task.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -15 }}
                        transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                        className={`flex items-center justify-between p-3 rounded-2xl border transition-all duration-300 hover:bg-white/[0.04] ${
                          task.completed 
                            ? 'bg-black/10 border-white/5 opacity-50' 
                            : 'bg-black/30 border-white/10 hover:border-pink-500/20'
                        }`}
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                          <input
                            type="checkbox"
                            checked={task.completed}
                            onChange={() => toggleTask(task.id)}
                            className="w-4 h-4 text-pink-500 rounded-lg border-white/20 cursor-pointer accent-pink-500 focus:ring-0 focus:ring-offset-0 transition-transform duration-200 hover:scale-110"
                          />
                          <span className={`text-xs font-medium truncate transition-all duration-300 ${task.completed ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                            {task.text}
                          </span>
                        </div>
                        <button
                          onClick={() => deleteTask(task.id)}
                          className="text-slate-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 cursor-pointer transition-all duration-250 active:scale-90"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {tasks.length === 0 && (
                    <div className="text-center text-slate-500 py-6 text-xs font-medium">
                      No items on your checklist.
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="notebook-editor"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col h-auto xl:h-[500px] xl:max-h-[540px] my-auto bg-slate-950/45 border border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15),0_15px_35px_rgba(0,0,0,0.4)] backdrop-blur-2xl p-6 rounded-3xl"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-sm tracking-wide uppercase text-slate-300 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-amber-500 animate-pulse" /> Study Journal
                </h3>
                <span className="text-[9px] bg-amber-500/10 px-2.5 py-0.5 border border-amber-500/20 rounded-full font-mono text-amber-400 font-semibold uppercase tracking-widest">
                  Active Notebook
                </span>
              </div>

              {/* Textarea container */}
              <div className="flex-1 flex flex-col mb-4">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Start typing your study journal notes here... (scrolls directly on the 3D desk)"
                  className="w-full flex-1 bg-amber-50/95 border border-amber-200 text-slate-800 placeholder-slate-400 p-4 rounded-2xl focus:outline-none focus:ring-1 focus:ring-amber-500 font-serif text-sm resize-none shadow-inner leading-relaxed min-h-[220px]"
                />
                <div className="flex justify-between text-[10px] text-slate-400 mt-2 font-medium">
                  <span>Font: Cozy Serif</span>
                  <span>
                    {notes.length} characters
                  </span>
                </div>
              </div>

              {/* Controls */}
              <div className="flex flex-col gap-2.5">
                <button
                  onClick={exportPDF}
                  className="w-full py-2.5 bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-white rounded-xl text-xs font-bold transition-all hover:scale-[1.02] active:scale-95 shadow-md shadow-amber-600/20 cursor-pointer text-center"
                >
                  Download Notes (PDF)
                </button>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      if (window.confirm("Are you sure you want to clear your notes?")) {
                        setNotes('')
                        toast.error("Notes cleared")
                      }
                    }}
                    className="flex-1 py-2.5 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-red-500/30 hover:text-red-400 text-slate-300 rounded-xl text-xs font-semibold transition-all active:scale-95 cursor-pointer text-center"
                  >
                    Clear Note
                  </button>
                  <button
                    onClick={() => setCameraPreset('desk')}
                    className="flex-1 py-2.5 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs font-semibold transition-all active:scale-95 cursor-pointer text-center"
                  >
                    Close Notebook
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

export default StudyLounge
