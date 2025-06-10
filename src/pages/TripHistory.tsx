
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Trip, Driver } from "@/lib/types";
import { useState } from "react";
import { toast } from "sonner";
import { DateRangeFilter } from "@/components/trip-history/DateRangeFilter";
import { TripList } from "@/components/trip-history/TripList";
import { TripHistoryHeader } from "@/components/trip-history/TripHistoryHeader";

// Interfaz para los datos del conductor desde la base de datos
interface DriverDB {
  id: string;
  name: string;
  license_number: string;
  email?: string;
  phone?: string;
  is_admin?: boolean;
  created_at: string;
}

const TripHistory = () => {
  const [dateRange, setDateRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({
    from: undefined,
    to: undefined,
  });

  // Consulta para obtener el usuario actual
  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No se encontró usuario');
      
      const { data: driver, error } = await supabase
        .from('drivers')
        .select('*')
        .eq('email', user.email)
        .maybeSingle();
      
      if (error) {
        console.error('Error al obtener el usuario:', error);
        throw error;
      }
      return driver;
    }
  });

  // Consulta para verificar si el usuario es administrador
  const { data: isAdmin = false } = useQuery({
    queryKey: ['user-role', currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id) return false;
      
      try {
        const { data, error } = await supabase
          .from('drivers')
          .select('*')
          .eq('id', currentUser.id)
          .single<DriverDB>();
        
        if (error) {
          console.error('Error al obtener datos del conductor:', error);
          return false;
        }
        
        // Verificar si el campo is_admin existe, si no, asumir false
        return data?.is_admin || false;
      } catch (error) {
        console.error('Error inesperado al verificar rol de administrador:', error);
        return false;
      }
    },
    enabled: !!currentUser?.id,
    initialData: false
  });

  // Consulta para obtener los viajes
  const { data: trips = [], isLoading } = useQuery<Trip[]>({
    queryKey: ['trips', isAdmin, currentUser?.id, dateRange.from, dateRange.to],
    queryFn: async () => {
      console.log(`Obteniendo viajes para ${isAdmin ? 'administrador' : 'usuario'}...`);
      
      // Primero obtenemos los viajes con los IDs de las relaciones
      const { data: tripsData, error: tripsError } = await supabase
        .from('trips')
        .select('*')
        .order('start_time', { ascending: false });

      if (tripsError) {
        console.error('Error al obtener viajes:', tripsError);
        toast.error("Error al cargar los viajes");
        throw tripsError;
      }

      if (!tripsData?.length) {
        console.log('No se encontraron viajes');
        return [];
      }

      // Filtramos por conductor si no es administrador
      const filteredTrips = isAdmin 
        ? tripsData 
        : tripsData.filter(trip => trip.driver_id === currentUser?.id);

      // Obtenemos los IDs únicos de conductores y camiones
      const driverIds = [...new Set(filteredTrips.map(trip => trip.driver_id))];
      const truckIds = [...new Set(filteredTrips.map(trip => trip.truck_id))];

      // Obtenemos los datos de los conductores con el tipo correcto
      const { data: driversData, error: driversError } = await supabase
        .from('drivers')
        .select('*')
        .in('id', driverIds) as { data: DriverDB[] | null, error: any };

      if (driversError) {
        console.error('Error al obtener conductores:', driversError);
        // Continuamos sin los datos de los conductores
      }

      // Aseguramos que los conductores tengan el formato correcto
      const safeDriversData: DriverDB[] = (driversData || []).map(driver => ({
        id: driver.id,
        name: driver.name || 'Conductor desconocido',
        license_number: driver.license_number || '',
        email: driver.email,
        phone: driver.phone,
        is_admin: 'is_admin' in driver ? Boolean(driver.is_admin) : false,
        created_at: driver.created_at || new Date().toISOString()
      }));

      // Obtenemos los datos de los camiones
      const { data: trucksData, error: trucksError } = await supabase
        .from('trucks')
        .select('*')
        .in('id', truckIds);

      if (trucksError) {
        console.error('Error al obtener camiones:', trucksError);
        // Continuamos sin los datos de los camiones
      }

      // Mapeamos los viajes con sus relaciones
      const tripsWithRelations = filteredTrips.map(trip => {
        const driver = safeDriversData?.find((d: any) => d.id === trip.driver_id);
        const truck = trucksData?.find((t: any) => t.id === trip.truck_id);
        
        // Crear objeto conductor con valores por defecto si es necesario
        const driverObj = driver ? {
          id: driver.id || '',
          name: driver.name || 'Conductor desconocido',
          license_number: driver.license_number || '',
          email: driver.email || '',
          phone: driver.phone || '',
          is_admin: Boolean(driver.is_admin),
          created_at: driver.created_at || new Date().toISOString()
        } : undefined;
        
        // Crear objeto camión con valores por defecto si es necesario
        const truckObj = truck ? {
          id: truck.id || '',
          plate_number: truck.plate_number || 'Sin matrícula',
          model: truck.model || 'Modelo no especificado',
          year: truck.year || new Date().getFullYear(),
          capacity: truck.capacity || 0,
          created_at: truck.created_at || new Date().toISOString()
        } : undefined;
        
        return {
          ...trip,
          driver: driverObj,
          truck: truckObj
        } as Trip;
      });

      console.log('Viajes encontrados:', tripsWithRelations.length);
      return tripsWithRelations;
    },
    enabled: !!currentUser // Solo habilitar si hay un usuario autenticado
  });

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      const range = dateRange;
      if (!range.from) {
        range.from = date;
      } else if (!range.to && date > range.from) {
        range.to = date;
      } else {
        range.from = date;
        range.to = undefined;
      }
      setDateRange({ ...range });

      if (range.from && range.to) {
        toast.success(
          `Mostrando viajes desde ${range.from.toLocaleDateString()} hasta ${range.to.toLocaleDateString()}`
        );
      }
    }
  };

  const clearDateFilter = () => {
    setDateRange({ from: undefined, to: undefined });
    toast.success("Mostrando todos los viajes");
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-2xl mx-auto space-y-8 animate-fade-in">
        <TripHistoryHeader isAdmin={false} />

        <div className="flex flex-col gap-4">
          <DateRangeFilter 
            dateRange={dateRange}
            onDateSelect={handleDateSelect}
            onClearFilter={clearDateFilter}
          />
        </div>

        <TripList trips={trips} isLoading={isLoading} />
      </div>
    </div>
  );
};

export default TripHistory;
