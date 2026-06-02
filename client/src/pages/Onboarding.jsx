import React, { useState } from 'react';
import { useUser, useAuth } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { GraduationCap, BookOpen, Sparkles, Key } from 'lucide-react';

import { getApiBaseUrl } from '../utils/resolveUrl';

axios.defaults.baseURL = getApiBaseUrl();

const Onboarding = () => {
    const { user, isLoaded } = useUser();
    const { getToken } = useAuth();
    const navigate = useNavigate();
    
    const [role, setRole] = useState(null);
    const [secretCode, setSecretCode] = useState('');
    const [loading, setLoading] = useState(false);

    if (!isLoaded || !user) {
        return (
            <div className="h-screen flex items-center justify-center bg-slate-950">
                <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
            </div>
        );
    }

    const handleSetRole = async (selectedRole) => {
        if (selectedRole === 'teacher' && !secretCode) {
            toast.error("Please enter the Teacher Access Code");
            return;
        }

        setLoading(true);
        try {
            const token = await getToken();
            const response = await axios.post('/api/user/set-role', {
                role: selectedRole,
                secretCode: selectedRole === 'teacher' ? secretCode : undefined
            }, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            if (response.data.success) {
                // Reload user data so that publicMetadata gets updated in Clerk client state
                await user.reload();
                toast.success(response.data.message);
                navigate('/ai');
            } else {
                toast.error(response.data.message);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || "An error occurred");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
            {/* Ambient Background Glows */}
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/20 rounded-full blur-[150px] pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-600/20 rounded-full blur-[150px] pointer-events-none" />

            <motion.div 
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="bg-white/5 backdrop-blur-xl border border-white/10 p-8 sm:p-10 rounded-3xl shadow-2xl max-w-lg w-full text-center relative z-10"
            >
                <div className="flex justify-center mb-6">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow-[0_0_20px_rgba(147,51,234,0.4)]">
                        <Sparkles className="w-10 h-10 text-white" />
                    </div>
                </div>

                <h1 className="text-3xl font-bold mb-2 text-white tracking-tight drop-shadow-sm">Welcome to GESTRO</h1>
                <p className="text-slate-400 mb-8 font-medium">Select your role to configure your platform experience.</p>

                <div className="space-y-4">
                    {/* Student Option */}
                    <button 
                        onClick={() => { setRole('student'); handleSetRole('student'); }}
                        disabled={loading}
                        className={`w-full p-5 rounded-2xl border-2 transition-all duration-300 cursor-pointer ${role === 'student' ? 'border-blue-500 bg-blue-500/10 shadow-[0_0_20px_rgba(59,130,246,0.3)]' : 'border-white/10 bg-white/5 hover:border-blue-400/50 hover:bg-white/10'} flex flex-col items-center justify-center gap-3`}
                    >
                        <div className={`p-3 rounded-xl ${role === 'student' ? 'bg-blue-500 text-white' : 'bg-white/10 text-slate-300'}`}>
                            <BookOpen className="w-6 h-6" />
                        </div>
                        <div>
                            <span className="block text-lg font-bold text-white drop-shadow-sm">I am a Student</span>
                            <span className="block text-sm text-slate-400 mt-1">Access study tools, library, and community</span>
                        </div>
                    </button>

                    {/* Teacher Option */}
                    <div className={`w-full p-5 rounded-2xl border-2 transition-all duration-300 ${role === 'teacher' ? 'border-purple-500 bg-purple-500/10 shadow-[0_0_20px_rgba(168,85,247,0.3)]' : 'border-white/10 bg-white/5 hover:border-purple-400/50 hover:bg-white/10'}`}>
                        <button 
                            onClick={() => setRole('teacher')}
                            className="w-full flex flex-col items-center justify-center gap-3 cursor-pointer"
                        >
                            <div className={`p-3 rounded-xl ${role === 'teacher' ? 'bg-purple-500 text-white' : 'bg-white/10 text-slate-300'}`}>
                                <GraduationCap className="w-6 h-6" />
                            </div>
                            <div>
                                <span className="block text-lg font-bold text-white drop-shadow-sm">I am a Teacher</span>
                                <span className="block text-sm text-slate-400 mt-1">Manage classes, create content, and administer library</span>
                            </div>
                        </button>

                        {/* Secret Code Input (Expands when Teacher is selected) */}
                        <motion.div 
                            initial={false}
                            animate={{ height: role === 'teacher' ? 'auto' : 0, opacity: role === 'teacher' ? 1 : 0, marginTop: role === 'teacher' ? 24 : 0 }}
                            className="overflow-hidden"
                        >
                            <div className="flex flex-col gap-4">
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Key className="h-4 w-4 text-purple-400" />
                                    </div>
                                    <input 
                                        type="text" 
                                        placeholder="Enter Teacher Access Code" 
                                        value={secretCode}
                                        onChange={(e) => setSecretCode(e.target.value)}
                                        className="w-full pl-10 pr-4 py-3 bg-black/40 border border-purple-500/30 rounded-xl focus:outline-none focus:border-purple-500 text-white placeholder-slate-500 transition-colors"
                                    />
                                </div>
                                <button 
                                    onClick={() => handleSetRole('teacher')}
                                    disabled={loading}
                                    className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-90 active:scale-95 text-white font-semibold py-3.5 rounded-xl shadow-[0_0_15px_rgba(147,51,234,0.5)] transition-all cursor-pointer flex justify-center items-center"
                                >
                                    {loading ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    ) : 'Verify & Continue'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default Onboarding;
