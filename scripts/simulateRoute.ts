import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

interface Point {
  lat: number;
  lng: number;
}

interface RoutePoint extends Point {
  timestamp: string;
}

// Configuración para módulos ES
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar variables de entorno
const envPath = resolve(__dirname, '../.env');
console.log('Cargando variables de entorno desde:', envPath);
dotenv.config({ path: envPath });

// Configuración de Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Faltan las variables de entorno de Supabase.');
  console.log('Asegúrate de tener un archivo .env.local con:');
  console.log('VITE_SUPABASE_URL=tu_url_de_supabase');
  console.log('VITE_SUPABASE_ANON_KEY=tu_clave_anonima');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Coordenadas de ejemplo (Montevideo, Uruguay)
const START_POINT = {
  lat: -34.9011,
  lng: -56.1645
};

const END_POINT: Point = {
  lat: -34.8941,
  lng: -56.0675
};

// Función para generar puntos intermedios
function generatePoints(start: Point, end: Point, count: number): Array<{ latitude: number; longitude: number; timestamp: string }> {
  const points: Array<{ latitude: number; longitude: number; timestamp: string }> = [];
  const now = new Date();
  const startTime = now.getTime();
  const endTime = startTime + (60 * 60 * 1000); // 1 hora de duración
  
  for (let i = 0; i <= count; i++) {
    const ratio = i / count;
    // Añadir un poco de variación aleatoria para hacer la ruta más realista
    const lat = start.lat + (end.lat - start.lat) * ratio + (Math.random() * 0.005 - 0.0025);
    const lng = start.lng + (end.lng - start.lng) * ratio + (Math.random() * 0.005 - 0.0025);
    
    // Crear timestamps que se extiendan a lo largo de una hora
    const timestamp = new Date(startTime + (endTime - startTime) * (i / count)).toISOString();
    
    points.push({
      latitude: lat,
      longitude: lng,
      timestamp: timestamp
    });
  }
  
  return points;
}

// Función principal
async function simulateRoute(tripId: string, numPoints: number = 20) {
  try {
    console.log(`Generando ${numPoints} puntos de ruta para el viaje ${tripId}...`);
    
    // Primero, verificar si el viaje existe
    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select('id')
      .eq('id', tripId)
      .single();

    if (tripError || !trip) {
      console.error(`❌ No se encontró el viaje con ID: ${tripId}`);
      console.log('Por favor, asegúrate de que el ID del viaje sea correcto.');
      return;
    }
    
    // Generar puntos de ruta
    const routePoints = generatePoints(START_POINT, END_POINT, numPoints);
    
    // Preparar datos para insertar (solo las columnas necesarias)
    const pointsToInsert = routePoints.map(point => ({
      trip_id: tripId,
      latitude: point.latitude,
      longitude: point.longitude,
      timestamp: point.timestamp
    }));
    
    console.log('Insertando puntos en la base de datos...');
    
    // Insertar puntos en lotes para evitar sobrecargar la base de datos
    const batchSize = 10;
    let insertedCount = 0;
    
    for (let i = 0; i < pointsToInsert.length; i += batchSize) {
      const batch = pointsToInsert.slice(i, i + batchSize);
      const { data, error } = await supabase
        .from('route_points')
        .insert(batch as any[]);
      
      if (error) {
        console.error('Error al insertar lote de puntos:', error);
        continue;
      }
      
      insertedCount += batch.length;
      console.log(`Insertados ${insertedCount}/${pointsToInsert.length} puntos...`);
    }
    
    // Actualizar el estado del viaje a "completed" si no lo está
    await supabase
      .from('trips')
      .update({ status: 'completed' })
      .eq('id', tripId);
    
    console.log(`✅ Se insertaron ${insertedCount} puntos de ruta para el viaje ${tripId}`);
    console.log('✅ Estado del viaje actualizado a "completed"');
    return insertedCount;
  } catch (error) {
    console.error('❌ Error al simular la ruta:', error);
    throw error;
  }
}

// Ejecutar el script
const tripId = process.argv[2];
const numPoints = parseInt(process.argv[3]) || 20;

if (!tripId) {
  console.error('Por favor, proporciona un ID de viaje como argumento');
  console.log('Uso: npx ts-node scripts/simulateRoute.ts <trip_id> [num_points]');
  process.exit(1);
}

simulateRoute(tripId, numPoints)
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
