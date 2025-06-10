
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

const CargoRegistration = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    origin: "",
    destination: "",
    cargoDescription: "",
    cattleType: "",
    cargoWeight: "",
    truckPlate: "",
  });

  const { data: currentDriver } = useQuery({
    queryKey: ["currentDriver"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      const { data, error } = await supabase
        .from("drivers")
        .select("*")
        .eq("email", user.email)
        .single();

      if (error) throw error;
      return data;
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentDriver) {
      toast.error("No se pudo encontrar el conductor");
      return;
    }

    if (!formData.truckPlate.trim()) {
      toast.error("Por favor ingrese la matrícula del camión");
      return;
    }

    try {
      let truck;
      
      // Try to find existing truck by plate number
      const { data: existingTruck, error: truckError } = await supabase
        .from("trucks")
        .select("*")
        .eq("plate_number", formData.truckPlate.trim().toUpperCase())
        .maybeSingle();

      if (truckError) {
        console.error("Error searching for truck:", truckError);
        toast.error("Error al buscar el camión");
        return;
      }

      if (existingTruck) {
        // Truck exists, check if it's available
        if (existingTruck.driver_id && existingTruck.driver_id !== currentDriver.id) {
          toast.error("Este camión ya está asignado a otro conductor");
          return;
        }
        truck = existingTruck;
      } else {
        // Truck doesn't exist, create it
        const { data: newTruck, error: createError } = await supabase
          .from("trucks")
          .insert({
            plate_number: formData.truckPlate.trim().toUpperCase(),
            driver_id: currentDriver.id
          })
          .select()
          .single();

        if (createError) {
          console.error("Error creating truck:", createError);
          toast.error("Error al registrar el camión");
          return;
        }
        truck = newTruck;
      }

      // Assign truck to driver if not already assigned
      if (!truck.driver_id) {
        await supabase
          .from("trucks")
          .update({ driver_id: currentDriver.id })
          .eq("id", truck.id);
      }

      // Combine cattle type and description for cargo_description
      const finalCargoDescription = formData.cattleType + (formData.cargoDescription ? ` - ${formData.cargoDescription}` : '');

      const { data, error } = await supabase
        .from("trips")
        .insert({
          driver_id: currentDriver.id,
          truck_id: truck.id,
          origin: formData.origin,
          destination: formData.destination,
          cargo_description: finalCargoDescription,
          cargo_weight: parseFloat(formData.cargoWeight) || 0,
          status: "active",
          start_time: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("Viaje iniciado exitosamente");
      navigate("/active-trip");
    } catch (error: any) {
      console.error("Error starting trip:", error);
      toast.error("Error al iniciar el viaje");
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (!currentDriver) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-2xl font-bold mb-4">Cargando...</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-gray-900">
            Registro de Carga
          </h1>
          <p className="text-gray-600">
            Complete los detalles del viaje
          </p>
        </div>

        <Card className="p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="origin">Origen (Paraje de carga)</Label>
                <Input
                  id="origin"
                  value={formData.origin}
                  onChange={(e) => handleInputChange("origin", e.target.value)}
                  placeholder="Paraje de carga"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="destination">Destino</Label>
                <Input
                  id="destination"
                  value={formData.destination}
                  onChange={(e) => handleInputChange("destination", e.target.value)}
                  placeholder="Ciudad de destino"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="truckPlate">Matrícula del Camión</Label>
              <Input
                id="truckPlate"
                value={formData.truckPlate}
                onChange={(e) => handleInputChange("truckPlate", e.target.value.toUpperCase())}
                placeholder="Ejemplo: KTP 6365"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cattleType">Tipo de Vacunos</Label>
              <Select value={formData.cattleType} onValueChange={(value) => handleInputChange("cattleType", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione el tipo de vacunos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Vaquillonas">Vaquillonas</SelectItem>
                  <SelectItem value="Novillos">Novillos</SelectItem>
                  <SelectItem value="Vacas">Vacas</SelectItem>
                  <SelectItem value="Terneros">Terneros</SelectItem>
                  <SelectItem value="Toros">Toros</SelectItem>
                  <SelectItem value="Mixto">Mixto</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cargoDescription">Descripción de la Carga (Opcional)</Label>
              <Textarea
                id="cargoDescription"
                value={formData.cargoDescription}
                onChange={(e) => handleInputChange("cargoDescription", e.target.value)}
                placeholder="Información adicional sobre la carga"
                className="min-h-[80px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cargoWeight">Cantidad de vacunos</Label>
              <Input
                id="cargoWeight"
                type="number"
                min="1"
                value={formData.cargoWeight}
                onChange={(e) => handleInputChange("cargoWeight", e.target.value)}
                placeholder="Número de cabezas de ganado"
                required
              />
            </div>

            <div className="flex gap-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => navigate("/home")}
              >
                Cancelar
              </Button>
              <Button type="submit" className="flex-1">
                Iniciar Viaje
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default CargoRegistration;
