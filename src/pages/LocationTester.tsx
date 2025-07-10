import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { MapPin, Map, Satellite, Activity } from 'lucide-react';
import Seguimiento from '@/components/Seguimiento';

const LocationTester = () => {
  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <MapPin className="w-8 h-8 text-primary" />
          Seguimiento de Ubicación en Tiem Real
        </h1>
        <p className="text-muted-foreground mt-2">
          Monitorea y registra la ubicación en tiempo real con seguimiento GPS
        </p>
      </div>

      <Tabs defaultValue="seguimiento" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md mb-6">
          <TabsTrigger value="seguimiento" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Seguimiento
          </TabsTrigger>
          <TabsTrigger value="mapa" className="flex items-center gap-2">
            <Map className="h-4 w-4" />
            Mapa
          </TabsTrigger>
        </TabsList>

        <TabsContent value="seguimiento" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Satellite className="h-5 w-5 text-primary" />
                Panel de Control de Seguimiento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Seguimiento />
                <Separator className="my-4" />
                <div className="bg-muted/50 p-4 rounded-lg">
                  <h3 className="font-medium mb-2">Información de la Aplicación</h3>
                  <p className="text-sm text-muted-foreground">
                    Esta función permite el seguimiento en tiempo real de la ubicación del dispositivo.
                    Los datos se guardan de forma segura en la base de datos.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mapa">
          <Card>
            <CardHeader>
              <CardTitle>Vista del Mapa</CardTitle>
            </CardHeader>
            <CardContent className="h-[500px] flex items-center justify-center bg-muted/50 rounded-lg">
              <div className="text-center space-y-4">
                <Map className="h-12 w-12 mx-auto text-muted-foreground" />
                <p className="text-muted-foreground">
                  Vista del mapa en desarrollo
                </p>
                <Button variant="outline" disabled>
                  Próximamente
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default LocationTester;
