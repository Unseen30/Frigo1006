import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Configuración para módulos ES
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar variables de entorno
const envPath = resolve(__dirname, '../.env');
dotenv.config({ path: envPath });

// Configuración de Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Faltan las variables de entorno de Supabase.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTripsVisibility() {
  try {
    console.log('=== Verificando visibilidad de viajes ===\n');
    
    // 1. Obtener los últimos 10 viajes de la base de datos
    console.log('Obteniendo los últimos 10 viajes...');
    const { data: trips, error: tripsError } = await supabase
      .from('trips')
      .select(`
        *,
        driver:drivers!inner (
          id,
          name
        ),
        truck:trucks!inner (
          plate_number
        ),
        route_points(count)
      `)
      .order('start_time', { ascending: false })
      .limit(10);

    if (tripsError) {
      console.error('Error al obtener viajes:', tripsError);
      return;
    }

    if (!trips || trips.length === 0) {
      console.log('No se encontraron viajes en la base de datos.');
      return;
    }

    console.log(`\n=== Se encontraron ${trips.length} viajes ===\n`);

    // 2. Verificar cada viaje
    for (const [index, trip] of trips.entries()) {
      console.log(`\n--- Viaje #${index + 1} ---`);
      console.log(`ID: ${trip.id}`);
      console.log(`Origen: ${trip.origin} → Destino: ${trip.destination}`);
      console.log(`Estado: ${trip.status}`);
      console.log(`Fecha de inicio: ${trip.start_time}`);
      console.log(`Conductor: ${trip.driver?.name || 'No encontrado'}`);
      console.log(`Camión: ${trip.truck?.plate_number || 'No encontrado'}`);
      console.log(`Puntos de ruta: ${trip.route_points?.[0]?.count || 0}`);
      
      // Verificar si el viaje tiene todos los campos requeridos para mostrarse
      const issues: string[] = [];
      
      if (!trip.driver) {
        issues.push('❌ No tiene conductor asociado');
      }
      
      if (!trip.truck) {
        issues.push('❌ No tiene camión asociado');
      }
      
      if (trip.status !== 'completed' && trip.status !== 'active') {
        issues.push(`❌ Estado inválido: ${trip.status} (debe ser 'active' o 'completed')`);
      }
      
      if (!trip.start_time) {
        issues.push('❌ No tiene fecha de inicio');
      }
      
      if (trip.route_points?.[0]?.count === 0) {
        issues.push('⚠️ No tiene puntos de ruta registrados');
      }
      
      if (issues.length === 0) {
        console.log('✅ El viaje debería ser visible en la aplicación');
      } else {
        console.log('Problemas de visibilidad:');
        issues.forEach(issue => console.log(`  ${issue}`));
      }
      
      console.log('---\n');
    }
    
  } catch (error) {
    console.error('Error en checkTripsVisibility:', error);
  }
}

// Ejecutar la función principal
checkTripsVisibility();
