import { useEffect, useState } from "react";
import type { Project } from "../types";
import { Loader2Icon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Footer from "../components/Footer";
import api from "../configs/axios";
import { toast } from "sonner";

const Community = () => {
  const [loading, setLoading] = useState(true);
  // Initialize as empty array
  const [projects, setProjects] = useState<Project[]>([]);
  const navigate = useNavigate();

  const fetchProjects = async () => {
    try {
      const { data } = await api.get('/api/project/published');
      
      // ✅ SAFETY FIX 1: Use '|| []' to prevent undefined error
      setProjects(data.projects || []);
      
      setLoading(false);
    } catch (error: any) {
      // Don't show toast for 404 (just means no projects found yet)
      console.log(error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  return (
    <>
      <div className='px-4 md:px-16 lg:px-24 xl:px-32'>
        {loading ? (
          <div className='flex items-center justify-center h-[80vh]'>
            <Loader2Icon className='size-7 animate-spin text-indigo-200' />
          </div>
        ) : (projects?.length || 0) > 0 ? (  // ✅ SAFETY FIX 2: Check with '?.'
          <div className='py-10 min-h-[80vh]'>
            <div className='flex items-center justify-between mb-12'>
              <h1 className='text-2xl font-medium text-white'>Published Projects</h1>
            </div>

            <div className="flex flex-wrap gap-3.5">
              {projects.map((project) => (
                <div onClick={() => navigate(`/view/${project.id}`)} key={project.id}
                  className='relative group w-72 max-sm:mx-auto cursor-pointer bg-gray-900/60 border border-gray-700 rounded-lg overflow-hidden shadow-md hover:shadow-indigo-700/30 hover:border-indigo-800/80 transition-all duration-300'>
                  
                  <div className="relative w-full h-40 bg-gray-900 overflow-hidden border-b border-gray-800">
                    {project.current_code ? (
                      <iframe
                        srcDoc={project.current_code}
                        className="absolute top-0 left-0 w-[1200px] h-[800px] origin-top-left pointer-events-none"
                        sandbox='allow-scripts allow-same-origin'
                        style={{ transform: 'scale(0.24)' }}
                        title={project.name} // Added title for accessibility
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-500"><p>No Preview</p></div>
                    )}
                  </div>

                  <div className="p-4 text-white bg-gradient-to-b from-transparent group-hover:from-indigo-950/20 transition-colors">
                    <div className='flex items-start justify-between'>
                      <h2 className="text-lg font-medium line-clamp-1">{project.name}</h2>
                      <span className="px-2 py-0.5 text-[10px] bg-gray-800 border border-gray-700 rounded-full">Website</span>
                    </div>
                    <p className="text-gray-400 mt-1 text-sm line-clamp-2">{project.initial_prompt}</p>

                    <div onClick={(e) => e.stopPropagation()} className="flex justify-between items-center mt-6">
                      <span className="text-xs text-gray-500">{new Date(project.createdAt).toLocaleDateString()}</span>
                      <div className="flex gap-2">
                        <button onClick={() => navigate(`/view/${project.id}`)} className="px-3 py-1.5 bg-white/10 hover:bg-white/15 rounded-md text-xs transition-colors">
                            View
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className='flex flex-col items-center justify-center h-[80vh]'>
            <h1 className='text-xl font-semibold text-gray-300'>No projects have been published yet.</h1>
            <p className="text-gray-500 mt-2">Create a project and publish it to see it here!</p>
            <button onClick={() => navigate('/')} className="mt-5 px-5 py-2 bg-indigo-500 text-white rounded-md">
              Create New
            </button>
          </div>
        )}
      </div>
      <Footer />
    </>
  );
};

export default Community;