import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2Icon } from "lucide-react";
import ProjectPreview from "../components/ProjectPreview";
import type { Project, Version } from "../types";
import api from "../configs/axios";
import { toast } from "sonner";
// import { useAuth } from "../hooks/useAuth"; // Un-comment this if you have an auth hook

const Preview = () => {
  const { projectId, versionId } = useParams();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(true);

  // ⚠️ You missed pasting this line, so I added placeholders.
  // REPLACE the line below with your actual hook: const { session, isPending } = useAuth();
  const session = { user: true }; // Placeholder: remove this line when you add your hook
  const isPending = false;        // Placeholder: remove this line when you add your hook

  useEffect(() => {
    const fetchCode = async () => {
      try {
        const { data } = await api.get(`/api/project/preview/${projectId}`);
        let activeCode = data.project.current_code;

        // If a specific version is requested, find it
        if (versionId) {
          const version = data.project.versions.find((v: Version) => v.id === versionId);
          if (version) {
            activeCode = version.code;
          }
        }
        
        setCode(activeCode);
      } catch (error: any) {
        toast.error(error?.response?.data?.message || error.message);
        console.log(error);
      } finally {
        setLoading(false);
      }
    };

    // Ensure we only fetch when not pending and user is logged in
    if (!isPending && session?.user) {
      fetchCode();
    }
  }, [projectId, versionId, session?.user, isPending]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2Icon className="size-7 animate-spin text-indigo-200" />
      </div>
    );
  }

  return (
    <div className="h-screen">
      {code && (
        <ProjectPreview
          project={{ current_code: code } as Project}
          isGenerating={false}
          showEditorPanel={false}
        />
      )}
    </div>
  );
};

export default Preview;