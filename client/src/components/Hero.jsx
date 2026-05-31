import React, { Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { assets } from "../assets/assets";
import { motion } from "framer-motion";
import Hero3D from "./Hero3D";

const Hero = () => {
    const navigate = useNavigate()
  return (
    <div
      className="px-4 sm:px-20 xl:px-32 relative flex w-full justify-center overflow-hidden
      bg-slate-950 min-h-[90vh] pt-20"
    >
      {/* Deep radial glow effect behind the text */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/20 rounded-full blur-[120px] pointer-events-none" />

      <div className="container mx-auto grid grid-cols-1 lg:grid-cols-2 items-center gap-12 relative z-10 w-full">
        
        {/* Left Column: Text & CTA */}
        <div className="text-center lg:text-left flex flex-col justify-center relative z-30">
          <motion.h1 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="text-4xl sm:text-5xl md:text-6xl 2xl:text-7xl font-bold leading-[1.1] text-white tracking-tight"
          >
            Empowering Education <br className="hidden lg:block" />
            with <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">Next-Gen Tech</span>
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
            className="mt-6 max-w-lg mx-auto lg:mx-0 text-lg sm:text-xl text-slate-300 leading-relaxed"
          >
            Transform your learning experience with our suite of powerful tools.
            Join virtual classrooms, access digital libraries, and collaborate seamlessly.
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
            className="flex flex-wrap justify-center lg:justify-start gap-4 mt-8"
          >
            <button onClick={() => navigate('/ai')} className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-10 py-4 rounded-xl hover:scale-105 active:scale-95 transition-all shadow-[0_0_20px_rgba(147,51,234,0.4)] font-medium cursor-pointer text-lg border border-white/10 hover:shadow-[0_0_30px_rgba(147,51,234,0.6)]">
                Go to Dashboard
            </button>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.8 }}
            className="flex items-center justify-center lg:justify-start gap-4 mt-12 text-slate-400 font-medium"
          >
            <img src={assets.user_group} alt="user group" className="h-8 opacity-70 grayscale contrast-125 brightness-150"/> 
            Trusted by 10,000+ students & educators
          </motion.div>
        </div>

        {/* Right Column: 3D Canvas */}
        <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.2, delay: 0.2, ease: "easeOut" }}
            className="w-full relative z-20 flex justify-center lg:justify-end"
        >
          <Suspense fallback={<div className="w-full h-[400px] flex items-center justify-center text-slate-500">Loading 3D Experience...</div>}>
            <Hero3D />
          </Suspense>
        </motion.div>

      </div>
    </div>
  );
};

export default Hero;
