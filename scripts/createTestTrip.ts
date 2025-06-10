import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Configuración para módulos ES
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('Iniciando script createTestTrip.ts');
console.log('Directorio actual:', process.cwd());

// Cargar variables de entorno
const envPath = resolve(__dirname, '../.env');
console.log('Cargando variables de entorno desde:', envPath);
dotenv.config({ path: envPath });

// Configuración de Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

console.log('URL de Supabase:', supabaseUrl ? 'Configurada' : 'No configurada');
console.log('Clave de Supabase:', supabaseKey ? 'Configurada' : 'No configurada');

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Faltan las variables de entorno de Supabase.');
  console.log('Asegúrate de tener un archivo .env.local con:');
  console.log('VITE_SUPABASE_URL=tu_url_de_supabase');
  console.log('VITE_SUPABASE_ANON_KEY=tu_clave_anonima');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Crear un viaje de prueba
async function createTestTrip() {
  try {
    console.log('Creando viaje de prueba...');
    
    // Obtener el primer conductor disponible
    const { data: drivers, error: driverError } = await supabase
      .from('drivers')
      .select('id, name, email')
      .limit(1);

    if (driverError || !drivers || drivers.length === 0) {
      console.error('No se encontraron conductores en la base de datos');
      console.log('Por favor, crea al menos un conductor primero');
      return;
    }

    const driver = drivers[0];
    
    // Obtener el primer camión disponible
    const { data: trucks, error: truckError } = await supabase
      .from('trucks')
      .select('id, plate_number')
      .limit(1);

    if (truckError || !trucks || trucks.length === 0) {
      console.error('No se encontraron camiones en la base de datos');
      console.log('Por favor, crea al menos un camión primero');
      return;
    }

    const truck = trucks[0];
    
    // Ubicaciones para los viajes de prueba con coordenadas válidas para Uruguay
    // Formato: [longitud, latitud] como lo espera OpenRouteService
    const routes = [
      {
        origin: 'Montevideo, Terminal de Cargas',
        originCoords: [-56.1645, -34.9011], // [lng, lat]
        destination: 'Punta del Este, Terminal de Ómnibus',
        destCoords: [-54.9393, -34.9606],
        cargo: 'Electrodomésticos',
        weight: 15,
        distance: 130 // km
      },
      {
        origin: 'Colonia del Sacramento, Puerto',
        originCoords: [-57.8444, -34.4735],
        destination: 'Paysandú, Zona Franca',
        destCoords: [-58.0756, -32.3214],
        cargo: 'Maquinaria agrícola',
        weight: 30,
        distance: 320 // km
      },
      {
        origin: 'Salto, Terminal de Ómnibus',
        originCoords: [-57.9614, -31.3959],
        destination: 'Melo, Zona Franca',
        destCoords: [-54.1838, -32.3668],
        cargo: 'Productos electrónicos',
        weight: 20,
        distance: 380 // km
      },
      {
        origin: 'Rivera, Terminal de Ómnibus',
        originCoords: [-55.5508, -30.9022],
        destination: 'Rocha, Terminal de Ómnibus',
        destCoords: [-54.3333, -34.4833],
        cargo: 'Productos de limpieza',
        weight: 25,
        distance: 420 // km
      }
    ];

    // Crear varios viajes de prueba
    const createdTrips: any[] = [];
    
    for (const route of routes) {
      const startTime = new Date();
      const endTime = new Date();
      // Añadir un tiempo aleatorio en las últimas 2 semanas
      startTime.setDate(startTime.getDate() - Math.floor(Math.random() * 14));
      // El viaje dura entre 1 y 8 horas
      const durationHours = 1 + Math.floor(Math.random() * 7);
      endTime.setTime(startTime.getTime() + (durationHours * 60 * 60 * 1000));
      
      // Crear el objeto de datos del viaje
      const tripData = {
        driver_id: driver.id,
        truck_id: truck.id,
        origin: route.origin,
        destination: route.destination,
        cargo_description: route.cargo,
        cargo_weight: route.weight,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        status: 'completed',
        distance: route.distance
        // Nota: Las columnas origin_coords y destination_coords no existen en la base de datos
        // Se pueden agregar ejecutando el script SQL en la consola de Supabase:
        // ALTER TABLE public.trips
        // ADD COLUMN IF NOT EXISTS origin_coords geometry(Point, 4326),
        // ADD COLUMN IF NOT EXISTS destination_coords geometry(Point, 4326);
      };
      
      // Guardar las coordenadas para usarlas en la generación de rutas
      const tripWithCoords = {
        ...tripData,
        originCoords: route.originCoords,
        destCoords: route.destCoords
      };

      // Insertar el viaje en la base de datos
      const { data: trip, error: tripError } = await supabase
        .from('trips')
        .insert(tripData)
        .select()
        .single();
      
      if (tripError) {
        console.error('Error al crear el viaje:', tripError);
        continue;
      }
      
      // Agregar información adicional para generar la ruta
      createdTrips.push({
        ...trip,
        startCoords: route.originCoords,
        endCoords: route.destCoords
      });
      
      console.log(`✅ Viaje creado: ${route.origin} → ${route.destination} (ID: ${trip.id})`);
    }

    console.log('\n✅ Se crearon los siguientes viajes de prueba:');
    console.log('='.repeat(80));
    
    for (const trip of createdTrips) {
      console.log(`\nViaje: ${trip.origin} → ${trip.destination}`);
      console.log(`ID: ${trip.id}`);
      console.log(`Carga: ${trip.cargo_description} (${trip.cargo_weight} ton)`);
      console.log(`Distancia: ${trip.distance} km`);
      console.log(`Estado: ${trip.status}`);
      console.log(`\nPara generar la ruta realista, ejecuta:`);
      console.log(`npx tsx scripts/simulateRealisticRoute.ts ${trip.id}`);
      console.log('='.repeat(80));
    }
    
    return createdTrips.map(trip => trip.id);
  } catch (error) {
    console.error('❌ Error al crear el viaje de prueba:', error);
    throw error;
  }
}

// Ejecutar el script
createTestTrip()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
