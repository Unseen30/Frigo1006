import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface DateRangeFilterProps {
  dateRange: {
    from: Date | undefined;
    to: Date | undefined;
  };
  onDateSelect: (date: Date | undefined) => void;
  onClearFilter: () => void;
}

export const DateRangeFilter = ({ dateRange, onDateSelect, onClearFilter }: DateRangeFilterProps) => {
  return (
    <div className="flex gap-4 items-center">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="flex items-center gap-2"
          >
            <CalendarIcon className="h-4 w-4" />
            {dateRange.from ? (
              dateRange.to ? (
                <>
                  {format(dateRange.from, "dd/MM/yyyy")} -{" "}
                  {format(dateRange.to, "dd/MM/yyyy")}
                </>
              ) : (
                format(dateRange.from, "dd/MM/yyyy")
              )
            ) : (
              "Seleccionar fechas"
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="single"
            selected={dateRange.from}
            onSelect={onDateSelect}
            locale={es}
          />
        </PopoverContent>
      </Popover>

      {(dateRange.from || dateRange.to) && (
        <Button
          variant="ghost"
          onClick={onClearFilter}
          className="text-destructive"
        >
          Limpiar filtro
        </Button>
      )}
    </div>
  );
};