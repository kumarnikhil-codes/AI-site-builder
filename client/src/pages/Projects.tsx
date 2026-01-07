import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import type { Project } from "../types";
// ✅ ADDED 'Globe' to the imports
import { ArrowBigDownDashIcon, FullscreenIcon, LaptopIcon, Loader2Icon, MessageSquareIcon, SaveIcon, SmartphoneIcon, TabletIcon, XIcon, Globe } from "lucide-react";

import Sidebar from "../components/Sidebar";
import ProjectPreview, { type ProjectPreviewRef } from "../components/ProjectPreview";
import api from "../configs/axios";
import { toast } from "sonner";
import { authClient } from "../lib/auth-client";

const Projects = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const {data: session, isPending} = authClient.useSession();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [device, setDevice] = useState<'phone' | 'tablet' | 'desktop'>("desktop");

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const previewRef = useRef<ProjectPreviewRef>(null);

  const fetchProject = async () => {
    try {
      const { data } = await api.get(`/api/project/${projectId}`);
      setProject(data.project)
      setIsGenerating(data.project.current_code ? false : true)
      setLoading(false)
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error.message);
    }
  }

  const saveProject = async () => {
    if(!previewRef.current) return;
    const code = previewRef.current.getCode();
    if(!code) return;
    setIsSaving(true);
    try {
      const { data } = await api.put(`/api/project/save/${projectId}`, {code});
      toast.success(data.message)  
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error.message);
      console.log(error);
    }finally{
      setIsSaving(false);
    }
  };

   // download code (index.html)
   const downloadCode = ()=>{
    const code = previewRef.current?.getCode() || project?.current_code;
    if(!code){
      if(isGenerating){
        return
      }
      return
    }
    const element = document.createElement('a');
    const file = new Blob([code], {type:"text/html"});
    element.href = URL.createObjectURL(file)
    element.download = "index.html"
    document.body.appendChild(element)
    element.click();
   }

   const togglePublish = async () => {
     try {
      const { data } = await api.put(`/api/project/publish/${projectId}`);
      toast.success(data.message)
      setProject((prev)=> prev ? ({...prev, isPublished: !prev.isPublished}) : null)  
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error.message);
      console.log(error);
    }
   }

   useEffect(()=>{
    if(session?.user){
      fetchProject();
    }else if(!isPending && !session?.user){
      navigate("/")
      toast("Please login to view your projects")
    }
   },[session?.user, isPending])

  useEffect(() => {
    if(project && !project.current_code){
      const intervalId = setInterval(fetchProject, 1000);
      return ()=> clearInterval(intervalId)
    }
  }, [project]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <Loader2Icon className="size-7 animate-spin text-violet-400" />
      </div>
    )
  }

  return project ? (
    <div className="flex flex-col h-screen w-full bg-gray-950 text-white overflow-hidden">
      {/* 1. BUILDER NAVBAR */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800 bg-gray-900 z-20 h-14">
        <div className="flex items-center gap-3">
          <img src="/favicon.svg" alt="logo" className="h-6 cursor-pointer" onClick={() => navigate('/')} />
          <div className="hidden md:block">
            <p className="text-sm font-medium capitalize truncate max-w-[200px]">{project.name}</p>
            <p className="text-[10px] text-gray-500">Previewing last saved version</p>
          </div>
        </div>

        {/* Device Switcher */}
        <div className="hidden sm:flex gap-1 bg-black/40 p-1 rounded-lg border border-gray-800">
          <SmartphoneIcon onClick={() => setDevice('phone')}
            className={`size-8 p-1.5 rounded-md cursor-pointer transition-colors ${device === 'phone' ? "bg-gray-700 text-white" : "text-gray-500"}`} />
          <TabletIcon onClick={() => setDevice('tablet')}
            className={`size-8 p-1.5 rounded-md cursor-pointer transition-colors ${device === 'tablet' ? "bg-gray-700 text-white" : "text-gray-500"}`} />
          <LaptopIcon onClick={() => setDevice('desktop')}
            className={`size-8 p-1.5 rounded-md cursor-pointer transition-colors ${device === 'desktop' ? "bg-gray-700 text-white" : "text-gray-500"}`} />
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          
          {/* ✅ ADDED: Publish Button */}
          <button onClick={togglePublish} 
            className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded text-xs transition-all border border-transparent ${
              project.isPublished 
              ? "bg-emerald-600/20 text-emerald-400 border-emerald-600/50 hover:bg-emerald-600/30" 
              : "bg-blue-800 text-white-400 border-gray-700 hover:bg-gray-700 hover:text-white"
            }`}>
            <Globe size={14} /> 
            {project.isPublished ? "Published" : "Publish"}
          </button>

          <button onClick={saveProject} disabled={isSaving} className="hidden lg:flex items-center gap-2 bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded text-xs border border-gray-700">
            {isSaving ? <Loader2Icon className="size-4 animate-spin" /> : <SaveIcon size={16} />} Save
          </button>

          <Link target="_blank" to={`/preview/${project.id}`} className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded text-xs border border-gray-700">
            <FullscreenIcon size={14} /> Preview
          </Link>

          <button onClick={downloadCode}
          className="hidden sm:flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 rounded text-xs transition-all">
            <ArrowBigDownDashIcon size={14} /> Download
          </button>
          
          <button className="sm:hidden text-gray-400" onClick={() => setIsMenuOpen(!isMenuOpen)}>
            {isMenuOpen ? <XIcon size={24} /> : <MessageSquareIcon size={24} />}
          </button>
        </div>
      </div>

      {/* 2. MAIN BODY (SIDEBAR + PREVIEW) */}
      <div className="flex flex-1 overflow-hidden relative">
        <Sidebar 
          isMenuOpen={isMenuOpen} 
          project={project} 
          setProject={setProject}
          isGenerating={isGenerating} 
          setIsGenerating={setIsGenerating}
        />

        {/* 3. PREVIEW CONTAINER */}
        <div className="flex-1 bg-gray-800 flex items-center justify-center p-4 overflow-hidden">
          <div className={`h-full bg-white rounded-t-xl shadow-2xl transition-all duration-300 overflow-hidden ${
            device === 'phone' ? 'w-[375px]' : device === 'tablet' ? 'w-[768px]' : 'w-full'
          }`}>
            
            <div className="w-full h-full">
              <ProjectPreview 
                ref={previewRef} 
                project={project} 
                isGenerating={isGenerating} 
                device={device}
              />
            </div>

          </div>
        </div>
      </div>
    </div>
  ) : (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-900 gap-4">
      <p className="text-2xl font-medium text-gray-300">Unable to load project!</p>
      <button onClick={() => navigate('/')} className="text-indigo-400 hover:underline">Return to Dashboard</button>
    </div>
  )
}

export default Projects;