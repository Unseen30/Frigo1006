// Mock para la API de geolocalización
type Position = {
  coords: {
    latitude: number;
    longitude: number;
    altitude: number | null;
    accuracy: number;
    altitudeAccuracy: number | null;
    heading: number | null;
    speed: number | null;
  };
  timestamp: number;
};

type PositionError = {
  code: number;
  message: string;
  PERMISSION_DENIED: number;
  POSITION_UNAVAILABLE: number;
  TIMEOUT: number;
};

type PositionOptions = {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
};

type PositionCallback = (position: Position) => void;
type PositionErrorCallback = (error: PositionError) => void;

export class MockGeolocation {
  private watchIdCounter = 1;
  private watchCallbacks: Map<number, { success: PositionCallback; error?: PositionErrorCallback }> = new Map();
  public permissionState: PermissionState = 'prompt';
  private position: Position = {
    coords: {
      latitude: 40.7128, // NYC por defecto
      longitude: -74.0060,
      altitude: null,
      accuracy: 20,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
    },
    timestamp: Date.now(),
  };

  constructor() {
    // @ts-ignore
    this.clearWatch = this.clearWatch.bind(this);
    // @ts-ignore
    this.getCurrentPosition = this.getCurrentPosition.bind(this);
    // @ts-ignore
    this.watchPosition = this.watchPosition.bind(this);
  }

  async queryPermission(): Promise<PermissionStatus> {
    return {
      name: 'geolocation',
      state: this.permissionState,
      onchange: null,
      addEventListener: (type: string, listener: EventListener) => {
        // Implementación básica para el mock
        console.log(`Added ${type} listener`);
      },
      removeEventListener: (type: string, listener: EventListener) => {
        // Implementación básica para el mock
        console.log(`Removed ${type} listener`);
      },
      dispatchEvent: (event: Event) => true,
    } as PermissionStatus;
  }

  setPermission(granted: boolean) {
    this.permissionState = granted ? 'granted' : 'denied';
    console.log(`Permiso de ubicación establecido a: ${this.permissionState}`);
  }

  setPosition(lat: number, lng: number, accuracy = 20) {
    this.position = {
      coords: {
        ...this.position.coords,
        latitude: lat,
        longitude: lng,
        accuracy,
      },
      timestamp: Date.now(),
    };
    console.log(`Posición actualizada a: ${lat}, ${lng}`);
  }

  getCurrentPosition(
    success: PositionCallback,
    error?: PositionErrorCallback,
    options?: PositionOptions
  ) {
    console.log('getCurrentPosition llamado', { options });
    
    if (this.permissionState !== 'granted') {
      const err: PositionError = {
        code: 1,
        message: 'Permiso denegado',
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      };
      error?.(err);
      return;
    }

    // Simular un pequeño retardo
    setTimeout(() => {
      success(this.position);
    }, 100);
  }

  watchPosition(
    success: PositionCallback,
    error?: PositionErrorCallback,
    options?: PositionOptions
  ): number {
    const watchId = this.watchIdCounter++;
    console.log(`watchPosition iniciado con ID: ${watchId}`);
    
    this.watchCallbacks.set(watchId, { success, error });
    
    // Enviar posición inicial
    if (this.permissionState === 'granted') {
      setTimeout(() => success(this.position), 100);
    } else {
      const err: PositionError = {
        code: 1,
        message: 'Permiso denegado',
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      };
      error?.(err);
    }
    
    // Simular actualizaciones periódicas
    const intervalId = setInterval(() => {
      if (this.permissionState === 'granted') {
        // Mover ligeramente la posición para simular movimiento
        const newLat = this.position.coords.latitude + (Math.random() * 0.001 - 0.0005);
        const newLng = this.position.coords.longitude + (Math.random() * 0.001 - 0.0005);
        this.setPosition(newLat, newLng);
        
        const callbacks = this.watchCallbacks.get(watchId);
        if (callbacks) {
          callbacks.success(this.position);
        }
      }
    }, 5000);
    
    // Limpiar intervalo cuando se llame a clearWatch
    // @ts-ignore
    this.clearWatchIntervals = this.clearWatchIntervals || new Map();
    // @ts-ignore
    this.clearWatchIntervals.set(watchId, () => {
      clearInterval(intervalId);
      this.watchCallbacks.delete(watchId);
      console.log(`watchPosition detenido para ID: ${watchId}`);
    });
    
    return watchId;
  }

  clearWatch(watchId: number) {
    // @ts-ignore
    const clearIntervalFn = this.clearWatchIntervals?.get(watchId);
    if (clearIntervalFn) {
      clearIntervalFn();
      // @ts-ignore
      this.clearWatchIntervals.delete(watchId);
    }
  }
}

// Crear una instancia global para usar en las pruebas
export const mockGeolocation = new MockGeolocation();

// Configurar el mock en el objeto global
if (typeof window !== 'undefined' && (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development')) {
  // Solo aplicar el mock en entorno de pruebas
  
  // Primero, intentamos con Object.defineProperty
  try {
    Object.defineProperty(navigator, 'geolocation', {
      value: mockGeolocation,
      configurable: true,
      writable: true
    });
  } catch (error) {
    // Si falla, intentamos con la asignación directa
    console.warn('No se pudo definir la propiedad geolocation con defineProperty, intentando asignación directa');
    try {
      // @ts-ignore
      navigator.geolocation = mockGeolocation;
    } catch (e) {
      console.error('No se pudo asignar el mock de geolocation:', e);
    }
  }
  
  // Mock para la API de permisos
  if (!navigator.permissions) {
    try {
      Object.defineProperty(navigator, 'permissions', {
        value: {
          query: async (permissionDesc: { name: string }) => {
            return {
              name: permissionDesc.name,
              state: mockGeolocation.permissionState,
              onchange: null,
              addEventListener: (type: string, listener: EventListener) => {
                console.log(`Added ${type} listener for permission`);
              },
              removeEventListener: (type: string, listener: EventListener) => {
                console.log(`Removed ${type} listener for permission`);
              },
              dispatchEvent: (event: Event) => true
            };
          }
        },
        configurable: true,
      });
    } catch (error) {
      console.warn('No se pudo configurar el mock de permisos:', error);
    }
  }
}

export default mockGeolocation;
