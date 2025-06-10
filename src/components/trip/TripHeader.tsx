
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface TripHeaderProps {
  title: string;
  subtitle: string;
}

export const TripHeader = ({ title, subtitle }: TripHeaderProps) => {
  const navigate = useNavigate();

  return (
    <div className="flex justify-between items-center">
      <div>
        <h1 className="text-2xl font-bold text-secondary mb-2">{title}</h1>
        <p className="text-gray-600">{subtitle}</p>
      </div>
      <Button variant="ghost" onClick={() => navigate("/home")}>
        Volver
      </Button>
    </div>
  );
};
