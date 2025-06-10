
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { Driver } from "@/lib/types";

interface DriverFilterProps {
  drivers: Driver[];
  selectedDriver: string | undefined;
  truckFilter: string;
  onDriverSelect: (driverId: string) => void;
  onTruckFilterChange: (value: string) => void;
  onClearFilters: () => void;
}

export const DriverFilter = ({
  drivers,
  selectedDriver,
  truckFilter,
  onDriverSelect,
  onTruckFilterChange,
  onClearFilters,
}: DriverFilterProps) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Select
          value={selectedDriver}
          onValueChange={onDriverSelect}
        >
          <SelectTrigger className="w-[280px]">
            <SelectValue placeholder="Seleccionar conductor" />
          </SelectTrigger>
          <SelectContent>
            {drivers.map((driver) => (
              <SelectItem key={driver.id} value={driver.id}>
                {driver.name} - {driver.truck_id || 'Sin camión'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          type="text"
          placeholder="Filtrar por matrícula"
          value={truckFilter}
          onChange={(e) => onTruckFilterChange(e.target.value)}
          className="w-[200px]"
        />

        {(selectedDriver || truckFilter) && (
          <Button
            variant="ghost"
            onClick={onClearFilters}
            className="text-destructive"
          >
            Limpiar filtros
          </Button>
        )}
      </div>
    </div>
  );
};
