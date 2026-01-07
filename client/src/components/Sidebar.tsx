import { BotIcon, EyeIcon, Loader2Icon, SendIcon, UserIcon } from "lucide-react";
import type { Message, Project, Version } from "../types";
import { Link } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import api from "../configs/axios";
import { toast } from "sonner";

interface SidebarProps {
    isMenuOpen: boolean;
    project: Project;
    setProject: (project: Project) => void;
    isGenerating: boolean;
    setIsGenerating: (IsGenerating: boolean) => void;
}

const Sidebar = ({ isMenuOpen, project, setProject, isGenerating, setIsGenerating }: SidebarProps) => {
    const messageRef = useRef<HTMLDivElement>(null);
    const [input, setInput] = useState('');

    const fetchProject = async () => {
        try {
            // ✅ FIXED: Removed '/user' to match your backend routes
            const { data } = await api.get(`/api/project/${project.id}`)
            setProject(data.project)
        } catch (error: any) {
             toast.error(error?.response?.data?.message || error.message);
            console.log(error);
        }
    }

    const handleRollback = async (versionId: string) => {
        try {
            const confirm = window.confirm('Are you sure you want to rollback to this version?')
            if(!confirm) return;
            setIsGenerating(true)
            
            // ✅ FIXED: Corrected URL and Logic
            await api.post(`/api/project/rollback/${project.id}/${versionId}`);
            
            // Fetch the updated project immediately after rollback
            const { data } = await api.get(`/api/project/${project.id}`);
            
            toast.success("Version rolled back successfully")
            setProject(data.project)
            setIsGenerating(false)

        } catch (error: any) {
            setIsGenerating(false)
            toast.error(error?.response?.data?.message || error.message);
            console.log(error);
        }
    };

    const handleRevisions = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!input.trim()) return;

        let interval: number | undefined;
        try {
            setIsGenerating(true);
            
            // Start polling for updates
            interval = window.setInterval(() => {
                fetchProject();
            }, 3000) // Reduced to 3s for faster updates

            // ✅ FIXED: Removed the space in '/ api' -> '/api'
            const { data } = await api.post(`/api/project/revision/${project.id}`, { message: input });
            
            toast.success(data.message);
            setInput('')
            
            // One final fetch to ensure we have the latest code
            await fetchProject();
            
        } catch (error: any) {
            toast.error(error?.response?.data?.message || error.message);
            console.log(error);
        } finally {
            if (interval) clearInterval(interval);
            setIsGenerating(false);
        }
    }

    useEffect(() => {
        if (messageRef.current) {
            messageRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [project?.conversation?.length || 0, isGenerating]);

    return (
        <div className={`h-full bg-gray-900 border-r border-gray-800 transition-all duration-300 flex-shrink-0 z-10
        ${isMenuOpen ? 'w-full absolute inset-0 sm:relative sm:w-80' : 'w-0 overflow-hidden sm:w-80'}`}>
            <div className='flex flex-col h-full w-80 max-sm:w-full'>
                {/* Messages container */}
                <div className='flex-1 overflow-y-auto no-scrollbar px-3 flex flex-col gap-4 py-4'>
                    {[...(project?.conversation || []), ...(project?.versions || [])]
                        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()).map((message, idx) => {
                            const isMessage = 'content' in message;

                            if (isMessage) {
                                const msg = message as Message;
                                const isUser = msg.role === 'user';
                                return (
                                    <div key={msg.id || idx} className={`flex items-start gap-3 ${isUser ? "justify-end" : 'justify-start'}`}>
                                        {!isUser && (
                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-600 to-indigo-700 flex items-center justify-center flex-shrink-0">
                                                <BotIcon className="size-5 text-white" />
                                            </div>
                                        )}
                                        <div className={`max-w-[80%] p-3 rounded-2xl shadow-sm text-sm leading-relaxed ${
                                            isUser ? "bg-indigo-600 text-white rounded-tr-none" : "bg-gray-800 text-gray-100 rounded-tl-none"
                                        }`}>
                                            {msg.content}
                                        </div>
                                        {isUser && (
                                            <div className='w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0'>
                                                <UserIcon className='size-5 text-gray-200' />
                                            </div>
                                        )}
                                    </div>
                                )
                            } else {
                                const ver = message as Version;
                                return (
                                    <div key={ver.id} className="w-full p-3 rounded-xl bg-gray-800 border border-gray-700 text-gray-100 flex flex-col gap-2">
                                        <div className="text-xs font-medium">
                                            Code updated <br />
                                            <span className="text-gray-500 text-[10px] font-normal">
                                                {new Date(ver.timestamp).toLocaleString()}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between gap-2 mt-1">
                                            {project.current_version_index === ver.id ? (
                                                <span className="px-2 py-1 rounded bg-gray-700 text-[10px]">Current version</span>
                                            ) : (
                                                <button onClick={() => handleRollback(ver.id)} className="px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[10px]">Roll back</button>
                                            )}
                                            <Link target='_blank' to={`/preview/${project.id}/${ver.id}`}>
                                                <EyeIcon className="size-7 p-1.5 bg-gray-700 hover:bg-gray-600 rounded" />
                                            </Link>
                                        </div>
                                    </div>
                                )
                            }
                        })}
                    
                    {isGenerating && (
                        <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center">
                                <BotIcon className="size-5 text-white" />
                            </div>
                            <div className="flex gap-1.5 h-8 items-center">
                                <span className="size-1.5 rounded-full animate-bounce bg-indigo-500" style={{ animationDelay: '0s' }} />
                                <span className="size-1.5 rounded-full animate-bounce bg-indigo-500" style={{ animationDelay: '0.2s' }} />
                                <span className="size-1.5 rounded-full animate-bounce bg-indigo-500" style={{ animationDelay: '0.4s' }} />
                            </div>
                        </div>
                    )}
                    <div ref={messageRef} />
                </div>

                {/* Input area */}
                {/* ✅ FIXED: Connected onSubmit to handleRevisions */}
                <form className='p-3 border-t border-gray-800' onSubmit={handleRevisions}>
                    <div className='flex items-center gap-2 bg-gray-800 p-2 rounded-xl ring-1 ring-gray-700 focus-within:ring-indigo-500 transition-all'>
                        <textarea 
                            onChange={(e) => setInput(e.target.value)} 
                            value={input}
                            rows={1} 
                            placeholder='Request changes...' 
                            className='flex-1 bg-transparent text-sm outline-none resize-none px-1'
                            disabled={isGenerating}
                            onKeyDown={(e) => {
                                if(e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleRevisions(e);
                                }
                            }}
                        />
                        <button disabled={isGenerating || !input.trim()}
                        type="submit" className="p-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg disabled:opacity-50">
                            {isGenerating 
                            ? <Loader2Icon className='size-4 animate-spin' />
                            : <SendIcon className="size-4" />}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

export default Sidebar;