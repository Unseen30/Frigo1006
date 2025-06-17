import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface RouteCacheDB extends DBSchema {
  routes: {
    key: string; // tripId
    value: {
      tripId: string;
      points: Array<{
        latitude: number;
        longitude: number;
        timestamp: string;
        accuracy?: number;
      }>;
      lastUpdated: number;
    };
    indexes: { 'by-tripId': string };
  };
  streets: {
    key: string; // streetId o dirección
    value: {
      streetId: string;
      name: string;
      coordinates: Array<{latitude: number; longitude: number}>;
      lastVisited: number;
    };
    indexes: { 'by-streetId': string };
  };
}

const DB_NAME = 'route-cache';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<RouteCacheDB>>;

export const initDB = async () => {
  if (!dbPromise) {
    dbPromise = openDB<RouteCacheDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Crear almacén para puntos de ruta
        const routeStore = db.createObjectStore('routes', {
          keyPath: 'tripId'
        });
        routeStore.createIndex('by-tripId', 'tripId', { unique: true });

        // Crear almacén para calles frecuentes
        const streetStore = db.createObjectStore('streets', {
          keyPath: 'streetId'
        });
        streetStore.createIndex('by-streetId', 'streetId', { unique: true });
      },
    });
  }
  return dbPromise;
};

export const saveRoutePoints = async (tripId: string, points: Array<{latitude: number; longitude: number; timestamp: string; accuracy?: number}>) => {
  const db = await initDB();
  const tx = db.transaction('routes', 'readwrite');
  const store = tx.objectStore('routes');
  
  // Obtener los puntos existentes si los hay
  const existing = await store.get(tripId);
  const existingPoints = existing?.points || [];
  
  // Filtrar puntos duplicados basados en timestamp
  const newPoints = points.filter(newPoint => 
    !existingPoints.some(p => p.timestamp === newPoint.timestamp)
  );

  if (newPoints.length > 0) {
    await store.put({
      tripId,
      points: [...existingPoints, ...newPoints],
      lastUpdated: Date.now(),
    });
    await tx.done;
    return newPoints.length;
  }
  
  return 0;
};

export const getRoutePoints = async (tripId: string) => {
  const db = await initDB();
  const route = await db.get('routes', tripId);
  return route?.points || [];
};

export const saveStreet = async (streetId: string, name: string, coordinates: Array<{latitude: number; longitude: number}>) => {
  const db = await initDB();
  await db.put('streets', {
    streetId,
    name,
    coordinates,
    lastVisited: Date.now(),
  });
};

export const getFrequentStreets = async (limit = 10) => {
  const db = await initDB();
  const tx = db.transaction('streets');
  const store = tx.store;
  
  let cursor = await store.openCursor();
  const streets = [];
  
  while (cursor && streets.length < limit) {
    streets.push(cursor.value);
    cursor = await cursor.continue();
  }
  
  // Ordenar por última visita (más reciente primero)
  return streets.sort((a, b) => b.lastVisited - a.lastVisited);
};

export const clearOldData = async (maxAge = 30 * 24 * 60 * 60 * 1000) => {
  // Por defecto, eliminar datos de más de 30 días
  const db = await initDB();
  const cutoff = Date.now() - maxAge;
  
  // Limpiar rutas antiguas
  const routesTx = db.transaction('routes', 'readwrite');
  const routes = await routesTx.store.getAll();
  await Promise.all(
    routes
      .filter(route => route.lastUpdated < cutoff)
      .map(route => routesTx.store.delete(route.tripId))
  );
  await routesTx.done;
  
  // Limpiar calles no visitadas recientemente
  const streetsTx = db.transaction('streets', 'readwrite');
  const streets = await streetsTx.store.getAll();
  await Promise.all(
    streets
      .filter(street => street.lastVisited < cutoff)
      .map(street => streetsTx.store.delete(street.streetId))
  );
  await streetsTx.done;
};
