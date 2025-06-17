import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import fetch from 'node-fetch';

// Configuración para módulos ES
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar variables de entorno
dotenv.config({ path: resolve(__dirname, '../.env') });

// Configuración de OpenRouteService
const ORS_API_KEY = process.env.VITE_ORS_API_KEY;
const ORS_API_URL = 'https://api.openrouteservice.org/v2';

if (!ORS_API_KEY) {
  console.error('Error: Falta la variable de entorno VITE_ORS_API_KEY');
  process.exit(1);
}

// Coordenadas de ejemplo en Uruguay (Montevideo a Punta del Este)
const startPoint = [-56.1645, -34.9011]; // [longitud, latitud]
const endPoint = [-54.95, -34.9667];     // [longitud, latitud]

async function testORSConnection() {
  try {
    console.log('=== Probando conexión a OpenRouteService ===');
    console.log('URL de la API:', ORS_API_URL);
    
    // Construir la URL para la solicitud de direcciones
    const url = `${ORS_API_URL}/directions/driving-car?api_key=${ORS_API_KEY}&start=${startPoint[0]},${startPoint[1]}&end=${endPoint[0]},${endPoint[1]}`;
    
    console.log('\nRealizando solicitud a:', url);
    
    // Realizar la solicitud
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json, application/geo+json',
      },
    });
    
    console.log('\n=== Respuesta HTTP ===');
    console.log('Estado:', response.status, response.statusText);
    
    // Verificar si la respuesta fue exitosa
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error en la respuesta de OpenRouteService:');
      console.error('Código de estado:', response.status);
      console.error('Mensaje:', response.statusText);
      console.error('Detalles:', errorText);
      return;
    }
    
    // Procesar la respuesta exitosa
    const data = await response.json();
    
    console.log('\n=== Datos de la ruta ===');
    console.log('Distancia:', (data.features[0].properties.summary.distance / 1000).toFixed(2), 'km');
    console.log('Duración:', (data.features[0].properties.summary.duration / 60).toFixed(2), 'minutos');
    console.log('Número de puntos de la ruta:', data.features[0].geometry.coordinates.length);
    
    // Mostrar las primeras coordenadas
    if (data.features[0].geometry.coordinates.length > 0) {
      console.log('\nPrimer punto de la ruta:', data.features[0].geometry.coordinates[0]);
      console.log('Último punto de la ruta:', data.features[0].geometry.coordinates[data.features[0].geometry.coordinates.length - 1]);
    }
    
  } catch (error) {
    console.error('Error al conectar con OpenRouteService:', error);
  }
}

// Ejecutar la prueba
testORSConnection().then(() => {
  console.log('\n=== Prueba completada ===');
  process.exit(0);
});
