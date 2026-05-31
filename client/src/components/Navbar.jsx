import React, { useState, useEffect } from 'react'
import { assets } from '../assets/assets'
import { useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { useClerk, UserButton, useUser } from "@clerk/clerk-react"

const Navbar = () => {
    const navigate = useNavigate();
    const { user } = useUser();
    const { openSignIn } = useClerk();
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            if (window.scrollY > 20) {
                setScrolled(true);
            } else {
                setScrolled(false);
            }
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <div className={`fixed z-50 w-full flex justify-between items-center py-4 px-4 sm:px-20 xl:px-32 transition-all duration-300 ${scrolled ? 'backdrop-blur-xl bg-slate-950/80 border-b border-white/10 shadow-xl py-3' : 'bg-transparent border-b border-transparent py-5'}`}>
            <img 
                src={assets.logo} 
                alt="logo" 
                className='w-32 sm:w-44 cursor-pointer brightness-0 invert' 
                onClick={() => navigate("/")} 
            />

            {
                user ? <UserButton />
                :
                (
                    <button onClick={openSignIn} className='flex items-center gap-2 rounded-xl text-sm font-medium
                    cursor-pointer bg-white text-slate-900 px-6 py-2.5 hover:bg-slate-200 transition-colors shadow-[0_0_15px_rgba(255,255,255,0.1)]'>
                        Get Started <ArrowRight className='w-4 h-4' />
                    </button>
                )
            }
        </div>
    )
}

export default Navbar
