import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import axios from 'axios';

// Configuración para módulos ES
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar variables de entorno
const envPath = resolve(__dirname, '../.env');
dotenv.config({ path: envPath });

// Configuración de Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const openRouteApiKey = process.env.OPENROUTE_API_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Faltan las variables de entorno de Supabase.');
  process.exit(1);
}

if (!openRouteApiKey) {
  console.error('Error: Falta la clave de API de OpenRouteService.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Función para generar una ruta simulada localmente
function generateSimulatedRoute(originCoords: [number, number], destCoords: [number, number]) {
  console.log('Generando ruta simulada localmente...');
  
  // Número de puntos a generar (entre 50 y 200)
  const numPoints = Math.floor(Math.random() * 150) + 50;
  const coordinates: [number, number][] = [];
  
  // Generar puntos intermedios
  for (let i = 0; i <= numPoints; i++) {
    const ratio = i / numPoints;
    // Interpolar linealmente entre origen y destino
    const lat = originCoords[1] + (destCoords[1] - originCoords[1]) * ratio;
    const lng = originCoords[0] + (destCoords[0] - originCoords[0]) * ratio;
    
    // Agregar algo de variación aleatoria para simular una ruta real
    const variation = 0.01 * Math.sin(ratio * Math.PI * 4);
    coordinates.push([lng + variation, lat + variation]);
  }
  
  // Calcular distancia aproximada usando la fórmula de Haversine
  const R = 6371; // Radio de la Tierra en km
  const dLat = (destCoords[1] - originCoords[1]) * Math.PI / 180;
  const dLon = (destCoords[0] - originCoords[0]) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(originCoords[1] * Math.PI/180) * Math.cos(destCoords[1] * Math.PI/180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;
  
  console.log(`Ruta simulada generada: ${distance.toFixed(1)} km (${numPoints} puntos)`);
  
  return {
    coordinates,
    distance
  };
}

// Función para obtener una ruta de OpenRouteService o generar una simulada si falla
async function getRoute(originCoords: [number, number], destCoords: [number, number]) {
  // Si no hay API key, generar ruta simulada directamente
  if (!openRouteApiKey) {
    console.log('No se encontró API key de OpenRouteService. Generando ruta simulada...');
    return generateSimulatedRoute(originCoords, destCoords);
  }

  try {
    console.log(`Solicitando ruta de [${originCoords[1].toFixed(4)}, ${originCoords[0].toFixed(4)}] a [${destCoords[1].toFixed(4)}, ${destCoords[0].toFixed(4)}]...`);
    
    const response = await axios.get(
      `https://api.openrouteservice.org/v2/directions/driving-car`,
      {
        params: {
          api_key: openRouteApiKey,
          start: `${originCoords[0]},${originCoords[1]}`,
          end: `${destCoords[0]},${destCoords[1]}`
        },
        timeout: 10000 // 10 segundos de timeout
      }
    );
    
    if (!response.data?.features?.[0]?.geometry?.coordinates) {
      console.warn('La respuesta de la API no contiene coordenadas de ruta. Generando ruta simulada...');
      return generateSimulatedRoute(originCoords, destCoords);
    }
    
    const distance = response.data.features[0].properties.segments[0].distance / 1000; // km
    console.log(`✅ Ruta obtenida: ${distance.toFixed(1)} km`);
    
    return {
      coordinates: response.data.features[0].geometry.coordinates,
      distance
    };
    
  } catch (error: any) {
    console.warn('No se pudo obtener la ruta de la API. Generando ruta simulada...', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      message: error.message
    });
    
    // Generar ruta simulada como respaldo
    return generateSimulatedRoute(originCoords, destCoords);
  }
}

// Función para generar puntos de ruta
function generateRoutePoints(coordinates: number[][], durationHours: number) {
  const now = new Date();
  const startTime = new Date(now.getTime() - durationHours * 60 * 60 * 1000);
  const endTime = now;
  
  return coordinates.map((point, index, array) => {
    const ratio = array.length > 1 ? index / (array.length - 1) : 0;
    const timestamp = new Date(startTime.getTime() + (endTime.getTime() - startTime.getTime()) * ratio).toISOString();
    
    return {
      latitude: point[1], // latitud
      longitude: point[0], // longitud
      timestamp
    };
  });
}

// Función para insertar puntos de ruta
async function insertRoutePoints(tripId: string, points: any[]) {
  try {
    console.log(`Insertando ${points.length} puntos de ruta para el viaje ${tripId}...`);
    
    // Primero, eliminar puntos existentes para evitar duplicados
    const { error: deleteError } = await supabase
      .from('route_points')
      .delete()
      .eq('trip_id', tripId);
    
    if (deleteError) {
      console.error('Error al eliminar puntos existentes:', deleteError);
      return false;
    }
    
    // Insertar en lotes de 100
    const batchSize = 100;
    let insertedCount = 0;
    
    for (let i = 0; i < points.length; i += batchSize) {
      const batch = points.slice(i, i + batchSize).map(point => ({
        trip_id: tripId,
        latitude: point.latitude,
        longitude: point.longitude,
        timestamp: point.timestamp
      }));
      
      const { error } = await supabase
        .from('route_points')
        .insert(batch);
      
      if (error) {
        console.error(`Error al insertar lote ${i / batchSize + 1}:`, error);
        return false;
      }
      
      insertedCount += batch.length;
      console.log(`  Insertados ${insertedCount}/${points.length} puntos...`);
    }
    
    console.log(`✅ Se insertaron ${insertedCount} puntos de ruta para el viaje ${tripId}`);
    return true;
    
  } catch (error) {
    console.error('Error al insertar puntos de ruta:', error);
    return false;
  }
}

// Función principal
async function fixMissingRoutePoints() {
  try {
    console.log('=== Verificando viajes sin puntos de ruta ===');
    
    // Obtener los últimos 10 viajes
    const { data: trips, error } = await supabase
      .from('trips')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (error) throw error;
    
    console.log(`Se encontraron ${trips.length} viajes`);
    
    // Definir coordenadas para las rutas conocidas
    const routeCoordinates: Record<string, { origin: [number, number], destination: [number, number] }> = {
      'Montevideo': { origin: [-56.1645, -34.9011], destination: [-54.9393, -34.9606] },
      'Colonia': { origin: [-57.8444, -34.4735], destination: [-58.0756, -32.3214] },
      'Salto': { origin: [-57.9614, -31.3959], destination: [-54.1838, -32.3668] },
      'Rivera': { origin: [-55.5508, -30.9022], destination: [-54.3333, -34.4833] },
      'Parish': { origin: [-57.0, -34.8], destination: [-56.5, -34.5] }, // Coordenadas aproximadas
      'Parish2': { origin: [-57.0, -34.8], destination: [-56.5, -34.5] }, // Mismo que Parish
      'Frigoyi': { origin: [-56.5, -34.5], destination: [-57.0, -34.8] }  // Inverso de Parish
    };
    
    for (const trip of trips) {
      try {
        console.log(`\n--- Procesando viaje: ${trip.origin} → ${trip.destination} (${trip.id}) ---`);
        
        // Verificar si ya tiene puntos de ruta
        const { count, error: countError } = await supabase
          .from('route_points')
          .select('*', { count: 'exact', head: true })
          .eq('trip_id', trip.id);
        
        if (countError) throw countError;
        
        if (count && count > 0) {
          console.log(`El viaje ya tiene ${count} puntos de ruta. Omitiendo...`);
          continue;
        }
        
        // Encontrar las coordenadas para esta ruta
        let originCoords: [number, number] | null = null;
        let destCoords: [number, number] | null = null;
        
        // Buscar por origen
        for (const [key, coords] of Object.entries(routeCoordinates)) {
          if (trip.origin.includes(key)) {
            originCoords = coords.origin;
            destCoords = coords.destination;
            break;
          }
        }
        
        if (!originCoords || !destCoords) {
          console.log(`No se encontraron coordenadas predefinidas para la ruta: ${trip.origin} → ${trip.destination}`);
          continue;
        }
        
        console.log(`Generando ruta con coordenadas: ${originCoords} → ${destCoords}`);
        
        // Obtener la ruta de OpenRouteService
        const route = await getRoute(originCoords, destCoords);
        
        // Calcular duración del viaje en horas
        const startTime = new Date(trip.start_time || new Date());
        const endTime = new Date(trip.end_time || new Date(startTime.getTime() + 3600000));
        const durationHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
        
        // Generar puntos de ruta
        const routePoints = generateRoutePoints(route.coordinates, Math.max(1, Math.min(24, durationHours)));
        
        // Insertar puntos de ruta
        const success = await insertRoutePoints(trip.id, routePoints);
        
        if (success) {
          // Actualizar la distancia del viaje
          const { error: updateError } = await supabase
            .from('trips')
            .update({ distance: Math.round(route.distance) })
            .eq('id', trip.id);
          
          if (updateError) {
            console.error('Error al actualizar la distancia del viaje:', updateError);
          } else {
            console.log(`✅ Distancia del viaje actualizada a ${route.distance.toFixed(1)} km`);
          }
        }
        
        // Esperar 1 segundo entre solicitudes para no sobrecargar la API
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`Error procesando viaje ${trip.id}:`, error);
      }
    }
    
    console.log('\n=== Proceso completado ===');
    
  } catch (error) {
    console.error('Error en fixMissingRoutePoints:', error);
  }
}

// Ejecutar la función principal
fixMissingRoutePoints();
