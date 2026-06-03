import React, { useState, useEffect } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { assets } from '../assets/assets'
import { Menu, X } from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { SignIn, useUser } from '@clerk/clerk-react'
import { motion } from 'framer-motion'
import VideoCall from './VideoCall'

const Layout = () => {
    const navigate = useNavigate();
    const [sidebar, setSidebar] = useState(false);
    const { user, isLoaded } = useUser();

    useEffect(() => {
        if (isLoaded && user && !user.publicMetadata?.role) {
            navigate('/onboarding');
        }
    }, [isLoaded, user, navigate]);

    return user ? (
        <div className='flex flex-col items-start justify-start h-screen bg-slate-950 text-white relative overflow-hidden'>
            {/* Subtle background glows for the app shell */}
            <div className="absolute top-0 left-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[150px] pointer-events-none" />
            <div className="absolute bottom-0 right-[-10%] w-[40%] h-[40%] bg-purple-600/10 rounded-full blur-[150px] pointer-events-none" />

            <nav className='w-full px-8 min-h-16 flex items-center justify-between border-b border-white/10 bg-slate-950/80 backdrop-blur-xl relative z-20'>
                <img src={assets.logo} alt="logo" onClick={() => navigate("/")} className='cursor-pointer w-24 sm:w-44 h-auto py-2 brightness-0 invert' />

                <div className='flex items-center gap-4'>
                    {
                        sidebar ? <X onClick={() => setSidebar(false)} className='w-6 h-6 text-white sm:hidden cursor-pointer' /> 
                        : <Menu onClick={() => setSidebar(true)} className='w-6 h-6 text-white sm:hidden cursor-pointer' />
                    }
                </div>
            </nav>
            <div className='flex-1 w-full flex h-[calc(100vh-64px)] relative z-10'>
                {/* Mobile Sidebar Overlay */}
                {sidebar && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 sm:hidden"
                        onClick={() => setSidebar(false)}
                    />
                )}
                
                <Sidebar sidebar={sidebar} setSidebar={setSidebar} />
                <div className='flex-1 bg-transparent overflow-y-auto relative z-10'>
                    <Outlet />
                    <VideoCall />
                </div>
            </div>
        </div>
    ) : (
        <div className='flex items-center justify-center h-screen bg-slate-950'>
            <SignIn />
        </div>
    )
}

export default Layout
