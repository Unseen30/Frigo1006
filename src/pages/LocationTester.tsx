import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { mockGeolocation } from '@/__mocks__/geolocation.mock';

const LocationTester = () => {
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const [position, setPosition] = useState({ lat: 0, lng: 0, accuracy: 0 });
  const [watchId, setWatchId] = useState<number | null>(null);
  const [customLat, setCustomLat] = useState('40.7128');
  const [customLng, setCustomLng] = useState('-74.0060');
  const [log, setLog] = useState<string[]>([]);

  // Actualizar el estado del permiso cuando cambie
  useEffect(() => {
    const checkPermission = async () => {
      try {
        const status = await mockGeolocation.queryPermission();
        setPermissionGranted(status.state === 'granted');
      } catch (error) {
        console.error('Error checking permission:', error);
      }
    };

    checkPermission();
  }, []);

  // Limpiar el watch al desmontar
  useEffect(() => {
    return () => {
      if (watchId !== null) {
        mockGeolocation.clearWatch(watchId);
      }
    };
  }, [watchId]);

  const togglePermission = (granted: boolean) => {
    mockGeolocation.setPermission(granted);
    setPermissionGranted(granted);
    addLog(`Permiso de ubicación ${granted ? 'concedido' : 'denegado'}`);
  };

  const updatePosition = () => {
    const lat = parseFloat(customLat);
    const lng = parseFloat(customLng);
    
    if (!isNaN(lat) && !isNaN(lng)) {
      mockGeolocation.setPosition(lat, lng);
      setPosition({ lat, lng, accuracy: 20 });
      addLog(`Posición actualizada a: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
    } else {
      addLog('Coordenadas inválidas');
    }
  };

  const startTracking = () => {
    if (watchId !== null) {
      mockGeolocation.clearWatch(watchId);
    }

    const id = mockGeolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setPosition({ lat: latitude, lng: longitude, accuracy });
        addLog(`Nueva posición: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
      },
      (error) => {
        addLog(`Error: ${error.message}`);
        setIsTracking(false);
      },
      { enableHighAccuracy: true }
    );

    setWatchId(id);
    setIsTracking(true);
    addLog('Iniciando seguimiento de ubicación...');
  };

  const stopTracking = () => {
    if (watchId !== null) {
      mockGeolocation.clearWatch(watchId);
      setWatchId(null);
      setIsTracking(false);
      addLog('Seguimiento detenido');
    }
  };

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLog(prev => [`[${timestamp}] ${message}`, ...prev].slice(0, 20));
  };

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold mb-4">Simulador de Ubicación</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Panel de control */}
        <Card>
          <CardHeader>
            <CardTitle>Controles de Simulación</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="permission-toggle">Permiso de Ubicación</Label>
              <Switch
                id="permission-toggle"
                checked={permissionGranted}
                onCheckedChange={togglePermission}
              />
            </div>

            <div className="space-y-2">
              <Label>Posición Personalizada</Label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Input
                    placeholder="Latitud"
                    value={customLat}
                    onChange={(e) => setCustomLat(e.target.value)}
                  />
                </div>
                <div>
                  <Input
                    placeholder="Longitud"
                    value={customLng}
                    onChange={(e) => setCustomLng(e.target.value)}
                  />
                </div>
              </div>
              <Button onClick={updatePosition} className="w-full">
                Establecer Posición
              </Button>
            </div>

            <div className="pt-2">
              {!isTracking ? (
                <Button 
                  onClick={startTracking} 
                  className="w-full"
                  disabled={!permissionGranted}
                >
                  Iniciar Seguimiento
                </Button>
              ) : (
                <Button 
                  onClick={stopTracking} 
                  variant="destructive" 
                  className="w-full"
                >
                  Detener Seguimiento
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Estado actual */}
        <Card>
          <CardHeader>
            <CardTitle>Estado Actual</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="space-y-1">
              <Label>Permiso de Ubicación:</Label>
              <div className={`font-mono px-2 py-1 rounded ${
                permissionGranted ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {permissionGranted ? 'Concedido' : 'Denegado'}
              </div>
            </div>
            
            <div className="space-y-1">
              <Label>Estado de Seguimiento:</Label>
              <div className="font-mono px-2 py-1 rounded bg-gray-100">
                {isTracking ? 'Activo' : 'Inactivo'}
              </div>
            </div>

            <div className="space-y-1">
              <Label>Última Posición:</Label>
              <div className="font-mono text-sm p-2 rounded bg-gray-50 border">
                <div>Lat: {position.lat.toFixed(6)}</div>
                <div>Lng: {position.lng.toFixed(6)}</div>
                <div>Precisión: {position.accuracy.toFixed(1)} metros</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Registro de eventos */}
      <Card>
        <CardHeader>
          <CardTitle>Registro de Eventos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48 overflow-y-auto bg-black text-green-400 p-3 rounded font-mono text-sm">
            {log.length > 0 ? (
              log.map((entry, index) => (
                <div key={index} className="mb-1 border-b border-gray-800 pb-1">
                  {entry}
                </div>
              ))
            ) : (
              <div className="text-gray-500">No hay eventos registrados</div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Instrucciones */}
      <Card className="bg-blue-50">
        <CardHeader>
          <CardTitle className="text-lg">Instrucciones</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <p>1. Activa/desactiva el permiso de ubicación con el interruptor</p>
          <p>2. Establece una posición personalizada (opcional)</p>
          <p>3. Inicia el seguimiento para simular actualizaciones de ubicación</p>
          <p>4. Observa los eventos en el registro</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default LocationTester;
