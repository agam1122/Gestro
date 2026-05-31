import { assets } from "../assets/assets";
import { Twitter, Linkedin, Github } from "lucide-react";

export default function Footer() {
    return (
        <footer className="bg-slate-950 border-t border-white/10 mt-auto w-full relative z-10">
            <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-24 py-16">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-12 lg:gap-8">
                    
                    {/* Brand Section */}
                    <div className="col-span-1 md:col-span-5 lg:col-span-4">
                        <img src={assets.logo} alt="Gestro Logo" className="h-9 mb-6 brightness-0 invert" />
                        <p className="text-slate-400 text-sm leading-relaxed max-w-sm mb-8">
                            Experience the future of education with Gestro. Transform your learning experience with our suite of powerful tools. Join virtual classrooms, access digital libraries, and collaborate seamlessly.
                        </p>
                        <div className="flex gap-4">
                            <a href="#" className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:bg-white/10 hover:text-white transition-all cursor-pointer">
                                <Twitter className="w-4 h-4" />
                            </a>
                            <a href="#" className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:bg-white/10 hover:text-white transition-all cursor-pointer">
                                <Linkedin className="w-4 h-4" />
                            </a>
                            <a href="#" className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:bg-white/10 hover:text-white transition-all cursor-pointer">
                                <Github className="w-4 h-4" />
                            </a>
                        </div>
                    </div>

                    {/* Links Section */}
                    <div className="col-span-1 md:col-span-7 lg:col-span-8 grid grid-cols-2 sm:grid-cols-3 gap-8 md:pl-10">
                        <div>
                            <h3 className="font-bold text-white mb-6 tracking-wide text-sm uppercase">Platform</h3>
                            <ul className="space-y-4 text-sm font-medium text-slate-400">
                                <li><a href="/ai/classrooms" className="hover:text-blue-400 transition-colors">Classrooms</a></li>
                                <li><a href="/ai/library" className="hover:text-blue-400 transition-colors">Digital Library</a></li>
                                <li><a href="/ai/notice-board" className="hover:text-blue-400 transition-colors">Notice Board</a></li>
                                <li><a href="/ai/video-call" className="hover:text-blue-400 transition-colors">Video Call</a></li>
                            </ul>
                        </div>
                        <div>
                            <h3 className="font-bold text-white mb-6 tracking-wide text-sm uppercase">Company</h3>
                            <ul className="space-y-4 text-sm font-medium text-slate-400">
                                <li><a href="/" className="hover:text-blue-400 transition-colors">Home</a></li>
                                <li><a href="/page/about-us" className="hover:text-blue-400 transition-colors">About Us</a></li>
                                <li><a href="/page/contact-us" className="hover:text-blue-400 transition-colors">Contact Us</a></li>
                            </ul>
                        </div>
                        <div className="col-span-2 sm:col-span-1 mt-4 sm:mt-0">
                            <div className="p-5 bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10">
                                <h3 className="font-bold text-slate-200 mb-2 text-sm">Gestro for Education</h3>
                                <p className="text-xs text-slate-400 leading-relaxed">
                                    Empowering students and teachers with next-generation AI tools.
                                </p>
                            </div>
                        </div>
                    </div>

                </div>

                {/* Bottom Bar */}
                <div className="border-t border-white/10 mt-16 pt-8 flex flex-col md:flex-row justify-center items-center">
                    <p className="text-sm font-medium text-slate-500">
                        © {new Date().getFullYear()} Gestro. All rights reserved.
                    </p>
                </div>
            </div>
        </footer>
    );
};