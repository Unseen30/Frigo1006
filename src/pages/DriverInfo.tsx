
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { CustomAuth } from "@/components/auth/CustomAuth";

const DriverInfo = () => {
  const navigate = useNavigate();

  // Check if user is already authenticated
  const { data: currentUser } = useQuery({
    queryKey: ["currentUser"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // Check if driver exists in database
        const { data: driver, error } = await supabase
          .from("drivers")
          .select("*")
          .eq("email", user.email)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          throw error;
        }

        if (driver) {
          navigate("/home");
          return driver;
        }
      }
      return null;
    },
  });

  if (currentUser) {
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-md mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-gray-900">
            FrigoTrack
          </h1>
          <p className="text-gray-600">
            Inicia sesión o regístrate para continuar
          </p>
        </div>

        <Card className="p-8">
          <CustomAuth />
        </Card>
      </div>
    </div>
  );
};

export default DriverInfo;
