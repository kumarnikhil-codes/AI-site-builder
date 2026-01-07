import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2Icon } from "lucide-react";
import api from "../configs/axios";
import { toast } from "sonner";

const Loading = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const sessionId = searchParams.get('session_id');

    useEffect(() => {
        const verifyPayment = async () => {
            if (!sessionId) {
                navigate('/');
                return;
            }

            try {
                const { data } = await api.post('/api/user/verify-payment', { sessionId });
                
                if(data.message === 'Credits already added') {
                    toast.info("Credits already added.");
                } else {
                    toast.success("Purchase successful! Credits added.");
                }
                
                navigate('/'); 
                
            } catch (error: any) {
                console.log(error);
                toast.error("Payment verification failed");
                navigate('/pricing');
            }
        };

        verifyPayment();
    }, [sessionId, navigate]);

    return (
        <div className="flex flex-col items-center justify-center h-screen bg-gray-950 text-white gap-4">
            <Loader2Icon className="size-10 animate-spin text-indigo-500" />
            <h2 className="text-xl font-medium">Verifying Payment...</h2>
            <p className="text-gray-400">Please do not close this window.</p>
        </div>
    );
};

export default Loading;