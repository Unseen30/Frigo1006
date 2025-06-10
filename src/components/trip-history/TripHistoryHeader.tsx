
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface TripHistoryHeaderProps {
  isAdmin: boolean;
}

export const TripHistoryHeader = ({ isAdmin }: TripHistoryHeaderProps) => {
  const navigate = useNavigate();

  return (
    <>
      <Button
        variant="ghost"
        className="flex items-center gap-2"
        onClick={() => navigate("/home")}
      >
        <ArrowLeft className="w-4 h-4" /> Volver
      </Button>

      <div>
        <h1 className="text-2xl font-bold text-secondary mb-2">
          {isAdmin ? 'Historial de Todos los Viajes' : 'Historial de Viajes'}
        </h1>
        <p className="text-gray-600">
          {isAdmin 
            ? 'Ver todos los viajes activos y completados'
            : 'Ver sus registros de transporte anteriores'}
        </p>
      </div>
    </>
  );
};
