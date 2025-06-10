
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { AuthError } from "@supabase/supabase-js";

interface LoginFormProps {
  onForgotPassword: () => void;
  onRegister: () => void;
}

export const LoginForm = ({ onForgotPassword, onRegister }: LoginFormProps) => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const getErrorMessage = (error: AuthError) => {
    switch (true) {
      case error.message.includes("invalid_credentials"):
      case error.message.includes("Invalid login credentials"):
        return "Email o contraseña incorrectos";
      case error.message.includes("Email not confirmed"):
        return "Por favor verifica tu email antes de iniciar sesión";
      case error.message.includes("User not found"):
        return "No existe una cuenta con este email";
      case error.message.includes("too_many_requests"):
        return "Demasiados intentos. Espera un momento antes de volver a intentar";
      default:
        return "Error al iniciar sesión. Por favor intenta nuevamente.";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      console.log("Attempting login with email:", email);
      
      // 1. Intentar iniciar sesión
      const { data: { session }, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        console.error("SignIn error:", signInError);
        throw signInError;
      }

      if (!session) {
        throw new Error("No se pudo iniciar sesión. Por favor intenta nuevamente.");
      }

      console.log("Login successful, user:", session.user.email);

      // 2. Verificar si existe el conductor en la base de datos
      const { data: driverData, error: driverError } = await supabase
        .from('drivers')
        .select('*')
        .eq('email', session.user.email)
        .maybeSingle();

      if (driverError) {
        console.error("Error fetching driver data:", driverError);
        // No lanzar error aquí, el usuario puede continuar sin datos de conductor
      }

      // 3. Redirigir al usuario
      toast.success("¡Bienvenido de vuelta!");
      navigate("/home", { replace: true });
      
    } catch (error: any) {
      console.error("Auth error:", error);
      const errorMessage = error instanceof AuthError 
        ? getErrorMessage(error)
        : error.message || "Error al iniciar sesión";
      
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="conductor@ejemplo.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={isLoading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Contraseña</Label>
        <Input
          id="password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={isLoading}
        />
      </div>

      <Button
        type="submit"
        className="w-full"
        disabled={isLoading}
      >
        {isLoading ? "Iniciando sesión..." : "Iniciar Sesión"}
      </Button>

      <Button
        type="button"
        variant="ghost"
        className="w-full"
        onClick={onForgotPassword}
        disabled={isLoading}
      >
        ¿Olvidaste tu contraseña?
      </Button>

      <Button
        type="button"
        variant="ghost"
        className="w-full"
        onClick={onRegister}
        disabled={isLoading}
      >
        ¿No tienes una cuenta? Regístrate
      </Button>
    </form>
  );
};
