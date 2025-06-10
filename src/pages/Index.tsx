import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const { data: activeTrips, isLoading, error } = useQuery({
    queryKey: ["activeTrips"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("trips")
          .select(`
            *,
            driver:drivers(*),
            route_points(latitude, longitude)
          `)
          .eq("status", "active")
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Error fetching active trips:", error);
          toast.error("No se pudieron cargar los viajes activos");
          return [];
        }
        
        return data || [];
      } catch (err) {
        console.error("Unexpected error:", err);
        toast.error("Error inesperado al cargar los viajes");
        return [];
      }
    },
    retry: 1,
    staleTime: 1000 * 60, // 1 minute
    gcTime: 1000 * 60 * 5, // 5 minutes
  });

  useEffect(() => {
    if (activeTrips && activeTrips.length > 0) {
      navigate("/active-trip", { replace: true });
    }
  }, [activeTrips, navigate]);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    
    setIsLoggingOut(true);
    try {
      // Clear local storage first
      localStorage.removeItem('frigotrack-auth-token');
      localStorage.removeItem('supabase.auth.token');
      
      // Then attempt Supabase signOut
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error("Error in signOut:", error);
        toast.error("Error al cerrar sesión");
      }

      // Navigate regardless of error to ensure user can always log out
      navigate("/auth", { replace: true });
    } catch (error) {
      console.error("Unexpected error in logout:", error);
      toast.error("Error inesperado al cerrar sesión");
      navigate("/auth", { replace: true });
    } finally {
      setIsLoggingOut(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-md mx-auto space-y-8">
          <h1 className="text-2xl font-bold text-center text-destructive">Error</h1>
          <p className="text-center">Hubo un error al cargar la información</p>
          <Button 
            className="w-full" 
            variant="outline"
            onClick={() => window.location.reload()}
          >
            Reintentar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-md mx-auto space-y-8">
        <h1 className="text-2xl font-bold text-center">FrigoTrack</h1>
        
        <div className="space-y-4">
          <Button 
            className="w-full" 
            onClick={() => navigate("/cargo")}
          >
            Nuevo Viaje
          </Button>
          
          <Button 
            className="w-full" 
            variant="outline"
            onClick={() => navigate("/history")}
          >
            Historial de Viajes
          </Button>
          
          <Button 
            className="w-full" 
            variant="destructive"
            onClick={handleLogout}
            disabled={isLoggingOut}
          >
            {isLoggingOut ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : null}
            Cerrar Sesión
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Index;