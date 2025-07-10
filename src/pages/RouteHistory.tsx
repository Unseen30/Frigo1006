import React from 'react';
import { MapaTrayecto } from '@/components/MapaTrayecto';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const RouteHistory = () => {
  const navigate = useNavigate();

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <div className="mb-6">
        <Button 
          variant="ghost" 
          className="mb-4"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver
        </Button>
        
        <h1 className="text-3xl font-bold mb-2">Historial de Recorridos</h1>
        <p className="text-muted-foreground">
          Visualiza el mapa con el historial de tus viajes guardados
        </p>
      </div>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="text-2xl">🗺️</span>
            <span>Recorrido Guardado</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <MapaTrayecto />
        </CardContent>
      </Card>
    </div>
  );
};

export default RouteHistory;
