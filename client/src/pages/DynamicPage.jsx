import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import { useUser, useAuth } from '@clerk/clerk-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Loader2, Pencil, Save, X } from 'lucide-react';
import toast from 'react-hot-toast';

const DynamicPage = () => {
    const { slug } = useParams();
    const { user } = useUser();
    const { getToken } = useAuth();
    
    const [content, setContent] = useState('');
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState('');
    const [saving, setSaving] = useState(false);

    const isAdmin = user?.primaryEmailAddress?.emailAddress === import.meta.env.VITE_ADMIN_EMAIL;
    const title = slug.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

    useEffect(() => {
        const fetchPage = async () => {
            setLoading(true);
            try {
                const { data } = await axios.get(`${import.meta.env.VITE_BASE_URL}/api/pages/${slug}`);
                if (data.success) {
                    setContent(data.data.content);
                }
            } catch (error) {
                console.error("Failed to fetch page", error);
                setContent("# Page Not Found\nThe content for this page could not be loaded.");
            } finally {
                setLoading(false);
            }
        };
        fetchPage();
    }, [slug]);

    const handleEditStart = () => {
        setEditContent(content);
        setIsEditing(true);
    };

    const handleSave = async () => {
        if (!editContent.trim()) {
            toast.error("Content cannot be empty");
            return;
        }

        setSaving(true);
        try {
            const token = await getToken();
            const { data } = await axios.put(
                `${import.meta.env.VITE_BASE_URL}/api/pages/${slug}`,
                { content: editContent },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (data.success) {
                toast.success("Page updated successfully");
                setContent(editContent);
                setIsEditing(false);
            } else {
                toast.error(data.message || "Failed to update page");
            }
        } catch (error) {
            console.error("Failed to save page", error);
            toast.error("Failed to save page");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col bg-slate-50">
            <Navbar />
            
            <main className="flex-1 w-full max-w-4xl mx-auto px-6 py-24">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 pb-4 border-b border-slate-200">
                    <h1 className="text-3xl font-bold text-slate-800">{title}</h1>
                    
                    {isAdmin && !isEditing && (
                        <button 
                            onClick={handleEditStart}
                            className="flex items-center gap-2 bg-blue-100 text-blue-700 px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-200 transition-colors cursor-pointer"
                        >
                            <Pencil className="w-4 h-4" /> Edit Page
                        </button>
                    )}
                    
                    {isAdmin && isEditing && (
                        <div className="flex gap-2">
                            <button 
                                onClick={() => setIsEditing(false)}
                                className="flex items-center gap-2 bg-slate-200 text-slate-700 px-4 py-2 rounded-xl text-sm font-medium hover:bg-slate-300 transition-colors cursor-pointer"
                            >
                                <X className="w-4 h-4" /> Cancel
                            </button>
                            <button 
                                onClick={handleSave}
                                disabled={saving}
                                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors cursor-pointer disabled:opacity-50"
                            >
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
                            </button>
                        </div>
                    )}
                </div>

                <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8 min-h-[500px]">
                    {loading ? (
                        <div className="flex justify-center items-center h-64">
                            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                        </div>
                    ) : isEditing ? (
                        <textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="w-full h-[500px] p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm resize-y"
                            placeholder="Write your markdown content here..."
                        />
                    ) : (
                        <article className="prose prose-slate max-w-none prose-headings:text-slate-800 prose-a:text-blue-600 hover:prose-a:text-blue-500">
                            <ReactMarkdown>{content}</ReactMarkdown>
                        </article>
                    )}
                </div>
            </main>

            <Footer />
        </div>
    );
};

export default DynamicPage;
