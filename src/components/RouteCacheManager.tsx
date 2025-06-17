import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { syncCachedPoints } from '@/utils/backgroundLocation';
import { getRoutePoints, clearOldData } from '@/utils/routeCache';
import { toast } from 'sonner';

interface RouteCacheManagerProps {
  tripId: string;
  onSyncComplete?: (syncedCount: number) => void;
}

export const RouteCacheManager: React.FC<RouteCacheManagerProps> = ({ 
  tripId, 
  onSyncComplete 
}) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [cacheStats, setCacheStats] = useState({
    totalPoints: 0,
    cacheSize: '0 KB',
    lastSync: null as Date | null,
  });
  const [syncProgress, setSyncProgress] = useState(0);

  // Cargar estadísticas de la caché
  const loadCacheStats = async () => {
    try {
      const points = await getRoutePoints(tripId);
      // Calcular tamaño aproximado en KB
      const sizeInBytes = JSON.stringify(points).length;
      const sizeInKB = (sizeInBytes / 1024).toFixed(2);
      
      setCacheStats({
        totalPoints: points.length,
        cacheSize: `${sizeInKB} KB`,
        lastSync: points.length > 0 ? new Date(points[points.length - 1].timestamp) : null,
      });
    } catch (error) {
      console.error('Error al cargar estadísticas de caché:', error);
      toast.error('Error al cargar estadísticas de caché');
    }
  };

  // Sincronizar puntos en caché con el servidor
  const handleSync = async () => {
    setIsSyncing(true);
    setSyncProgress(0);
    
    try {
      setSyncProgress(30);
      const syncedCount = await syncCachedPoints(tripId);
      setSyncProgress(80);
      
      // Recargar estadísticas
      await loadCacheStats();
      setSyncProgress(100);
      
      if (syncedCount) {
        toast.success(`${syncedCount} puntos sincronizados correctamente`);
        onSyncComplete?.(syncedCount);
      } else {
        toast.info('No hay puntos nuevos para sincronizar');
      }
    } catch (error) {
      console.error('Error al sincronizar caché:', error);
      toast.error('Error al sincronizar con el servidor');
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncProgress(0), 1000);
    }
  };

  // Limpiar datos antiguos de la caché
  const handleCleanup = async () => {
    try {
      await clearOldData(7 * 24 * 60 * 60 * 1000); // 7 días
      await loadCacheStats();
      toast.success('Caché limpiada correctamente');
    } catch (error) {
      console.error('Error al limpiar caché:', error);
      toast.error('Error al limpiar la caché');
    }
  };

  // Cargar estadísticas al montar el componente
  useEffect(() => {
    loadCacheStats();
    
    // Sincronizar automáticamente cada 5 minutos
    const interval = setInterval(loadCacheStats, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [tripId]);

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-lg">Gestión de Caché de Ruta</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Puntos en caché:</span>
            <span className="font-medium">{cacheStats.totalPoints}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Tamaño de caché:</span>
            <span className="font-medium">{cacheStats.cacheSize}</span>
          </div>
          {cacheStats.lastSync && (
            <div className="flex justify-between text-sm">
              <span>Última sincronización:</span>
              <span className="font-medium">
                {new Date(cacheStats.lastSync).toLocaleTimeString()}
              </span>
            </div>
          )}
        </div>

        {syncProgress > 0 && syncProgress < 100 && (
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Sincronizando...</div>
            <Progress value={syncProgress} className="h-2" />
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <Button 
            onClick={handleSync} 
            disabled={isSyncing || cacheStats.totalPoints === 0}
            className="flex-1"
          >
            {isSyncing ? 'Sincronizando...' : 'Sincronizar Ahora'}
          </Button>
          
          <Button 
            variant="outline" 
            onClick={handleCleanup}
            className="flex-1"
            disabled={isSyncing}
          >
            Limpiar Caché
          </Button>
        </div>
        
        <p className="text-xs text-muted-foreground">
          Los puntos de ruta se sincronizan automáticamente cada 5 minutos cuando hay conexión.
        </p>
      </CardContent>
    </Card>
  );
};
