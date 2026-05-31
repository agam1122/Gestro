import React, { useRef } from 'react'
import { AiToolsData } from '../assets/assets'
import { useNavigate } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

const TiltCard = ({ tool, navigate, user, index }) => {
    const ref = useRef(null);
    const x = useMotionValue(0);
    const y = useMotionValue(0);
    
    const mouseXSpring = useSpring(x, { stiffness: 300, damping: 30 });
    const mouseYSpring = useSpring(y, { stiffness: 300, damping: 30 });
    
    const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["17.5deg", "-17.5deg"]);
    const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-17.5deg", "17.5deg"]);
    
    const handleMouseMove = (e) => {
        if (!ref.current) return;
        const rect = ref.current.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const xPct = mouseX / width - 0.5;
        const yPct = mouseY / height - 0.5;
        x.set(xPct);
        y.set(yPct);
    };
    
    const handleMouseLeave = () => {
        x.set(0);
        y.set(0);
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: false, amount: 0.2 }}
            transition={{ duration: 0.6, delay: index * 0.1, ease: "easeOut" }}
            style={{ perspective: "1000px" }}
            className="flex"
        >
            <motion.div 
                ref={ref}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
                className='p-8 mx-4 my-2 w-full max-w-xs rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl cursor-pointer relative transition-colors hover:bg-white/10 h-full group' 
                onClick={() => user && navigate(tool.path)}
            >
                <div style={{ transform: "translateZ(50px)", transformStyle: "preserve-3d" }}>
                    <tool.Icon className='w-14 h-14 p-3.5 text-white rounded-2xl shadow-[0_0_20px_rgba(255,255,255,0.1)] mb-6 group-hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] transition-shadow' 
                    style={{background: `linear-gradient(to bottom right, ${tool.bg.from}, ${tool.bg.to})`}} />

                    <h3 className='mb-3 text-xl font-bold text-white tracking-tight'>{tool.title}</h3>
                    <p className='text-slate-400 text-sm leading-relaxed'>{tool.description}</p>
                </div>
            </motion.div>
        </motion.div>
    );
};

const AITools = () => {
    const navigate = useNavigate();
    const { user } = useUser();

  return (
    <div className='px-4 sm:px-20 xl:px-32 py-32 bg-slate-950 relative overflow-hidden perspective-1000'>
        {/* Subtle background glow */}
        <div className="absolute top-[20%] right-[-5%] w-[30%] h-[50%] bg-purple-600/10 rounded-full blur-[150px] pointer-events-none" />

        <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, amount: 0.2 }}
            transition={{ duration: 0.8 }}
            className='text-center mb-16 relative z-10'
        >
            <h2 className='text-white text-4xl md:text-5xl font-bold mb-6 tracking-tight'>
                Platform Features
            </h2>
            <p className='text-slate-400 max-w-2xl mx-auto text-lg'>
                Everything you need to learn, teach, and collaborate with cutting-edge AI technology.
            </p>
        </motion.div>

        <div className='flex flex-wrap justify-center items-stretch relative z-10 gap-y-12 gap-x-4' style={{ perspective: "1000px" }}>
            {AiToolsData.filter(tool => {
                if (tool.path === '/ai/generate-question-paper') {
                    return user?.publicMetadata?.role === 'teacher';
                }
                return true;
            }).map((tool, index) => (
                <TiltCard key={index} index={index} tool={tool} navigate={navigate} user={user} />
            ))}
        </div>
    </div>
  )
}

export default AITools
