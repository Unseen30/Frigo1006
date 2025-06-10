
import { useEffect } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const navigate = useNavigate();

  const { data: session, isLoading: isSessionLoading, error } = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("Error verifying session:", error);
          throw error;
        }

        return session;
      } catch (err) {
        console.error("Session verification failed:", err);
        return null;
      }
    },
    retry: 1,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false,
    gcTime: 1000 * 60 * 10, // 10 minutes
  });

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, currentSession) => {
      console.log("Auth state change:", event, currentSession?.user?.email);
      
      if (event === 'SIGNED_OUT' || !currentSession) {
        navigate("/auth", { replace: true });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate]);

  if (isSessionLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    console.error("Session error:", error);
    return <Navigate to="/auth" replace />;
  }

  if (!session) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
};
