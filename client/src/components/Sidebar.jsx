import { useClerk, useUser } from '@clerk/clerk-react'
import { Eraser, FileText, Hash, House, Image, Scissors, SquarePen, Users, LogOut, Video, Hand, BookMarked, School, Megaphone, Timer } from 'lucide-react';
import React from 'react'
import { NavLink } from 'react-router-dom';

const Sidebar = ({sidebar, setSidebar}) => {

    const { user } = useUser();
    const { signOut, openUserProfile} =  useClerk()

    const navItems = [
        {to: "/ai" , label:"Dashboard", Icon: House},
        {to: "/ai/classrooms" , label:"Classrooms", Icon: School},
        {to: "/ai/video-call" , label:"Video Call", Icon: Video},
        {to: "/ai/library" , label:"Digital Library", Icon: BookMarked},
        {to: "/ai/community" , label:"Notice Board", Icon: Megaphone},
        {to: "/ai/review-resume" , label:"Review Resume", Icon: FileText},
        {to: "/ai/study-lounge" , label:"Study Lounge", Icon: Timer}
    ];

    if (user?.publicMetadata?.role === 'teacher') {
        navItems.splice(1, 0, {to: "/ai/generate-question-paper" , label:"Question Paper", Icon: SquarePen});
    }
  return (
    <div className={`w-60 bg-slate-950/80 backdrop-blur-xl border-r border-white/10 flex flex-col 
    justify-between items-center max-sm:absolute top-16 bottom-0 ${sidebar ? 'translate-x-0' : 'max-sm:-translate-x-full'} 
    transition-all duration-300 ease-in-out z-50`}>
      
        <div className='my-7 w-full'>
            <img src={user.imageUrl} alt="User avatar" className='w-13 rounded-full mx-auto shadow-[0_0_15px_rgba(255,255,255,0.1)]'/>
            <h1 className='m-1 text-center font-medium text-white'>{user.fullName}</h1>

            <div className='px-6 mt-5 text-sm text-slate-400 font-medium'>
                {navItems.map(({to, label, Icon}) => (
                    
                        <NavLink key={to} to={to} end={to === "/ai"} onClick={() => setSidebar(false)} 
                        className={({isActive}) => `px-3.5 py-2.5 flex items-center gap-3 rounded-lg mb-1 transition-all duration-200
                            ${isActive ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-[0_0_15px_rgba(147,51,234,0.4)] border border-white/10' : 'hover:bg-white/5 hover:text-white' }`}>

                        {
                            ({isActive}) => (
                                <>
                                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : ''}`} />
                                {label}
                                </>
                            )
                        }
                            
                        </NavLink>
                    
                ))}
            </div>
        </div>
        <div className='w-full p-4 px-7 flex items-center justify-between border-t border-white/10 bg-white/5'>
            <div onClick={openUserProfile} className='flex gap-2 items-center cursor-pointer'>
                <img src={user.imageUrl} alt="User avatar" className='rounded-full h-8'/>
                <div>
                    <h1 className='text-xs font-medium text-slate-200'>{user.fullName}</h1>
                    <p className='text-xs text-slate-500 capitalize'>
                        {user.publicMetadata?.role || 'Student'}
                    </p>
                </div>
            </div>
            <LogOut className="text-gray-500 hover:text-red-500" onClick={signOut}/>
        </div>
    </div>
  )
}

export default Sidebar
