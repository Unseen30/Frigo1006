import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Mapbox from '@react-native-mapbox-gl/maps';
import { MAPBOX_ACCESS_TOKEN, mapboxConfig } from '../../utils/mapbox';

// Configurar el token de acceso
Mapbox.setAccessToken(MAPBOX_ACCESS_TOKEN);

interface MapViewProps {
  coordinates?: Array<[number, number]>;
  onUserLocationUpdate?: (location: any) => void;
  showUserLocation?: boolean;
  style?: any;
}

const MapView: React.FC<MapViewProps> = ({
  coordinates = [],
  onUserLocationUpdate,
  showUserLocation = true,
  style,
}) => {
  const [hasLocationPermission, setHasLocationPermission] = useState(false);
  const camera = useRef<Mapbox.Camera>(null);
  const mapRef = useRef<Mapbox.MapView>(null);

  useEffect(() => {
    // Verificar permisos de ubicación
    (async () => {
      const { status } = await Mapbox.requestAndroidLocationPermissions();
      setHasLocationPermission(status === 'granted');
    })();
  }, []);

  const handleUserLocationUpdate = (location: any) => {
    if (onUserLocationUpdate) {
      onUserLocationUpdate(location);
    }
    
    // Centrar el mapa en la ubicación del usuario
    if (camera.current && location.coords) {
      camera.current.setCamera({
        centerCoordinate: [
          location.coords.longitude,
          location.coords.latitude,
        ],
        animationDuration: 1000,
      });
    }
  };

  // Si no hay coordenadas, muestra un mapa vacío
  if (!coordinates.length) {
    return (
      <View style={[styles.container, style]}>
        <Mapbox.MapView
          ref={mapRef}
          style={styles.map}
          styleURL={mapboxConfig.styleURL}
          logoEnabled={false}
          compassEnabled={true}
          scaleBarEnabled={false}
        >
          <Mapbox.Camera
            ref={camera}
            zoomLevel={mapboxConfig.defaultZoom}
            minZoomLevel={mapboxConfig.minZoom}
            maxZoomLevel={mapboxConfig.maxZoom}
            pitch={mapboxConfig.pitch}
            heading={mapboxConfig.bearing}
          />
          {showUserLocation && hasLocationPermission && (
            <Mapbox.UserLocation
              visible={true}
              onUpdate={handleUserLocationUpdate}
              showsUserHeadingIndicator={true}
            />
          )}
        </Mapbox.MapView>
      </View>
    );
  }

  // Si hay coordenadas, muestra la ruta
  return (
    <View style={[styles.container, style]}>
      <Mapbox.MapView
        ref={mapRef}
        style={styles.map}
        styleURL={mapboxConfig.styleURL}
        logoEnabled={false}
        compassEnabled={true}
        scaleBarEnabled={false}
      >
        <Mapbox.Camera
          ref={camera}
          zoomLevel={mapboxConfig.defaultZoom}
          minZoomLevel={mapboxConfig.minZoom}
          maxZoomLevel={mapboxConfig.maxZoom}
          pitch={mapboxConfig.pitch}
          heading={mapboxConfig.bearing}
          centerCoordinate={coordinates[0]}
          animationMode={'flyTo'}
          animationDuration={2000}
        />
        
        {showUserLocation && hasLocationPermission && (
          <Mapbox.UserLocation
            visible={true}
            onUpdate={handleUserLocationUpdate}
            showsUserHeadingIndicator={true}
          />
        )}

        <Mapbox.ShapeSource
          id="route"
          shape={{
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: coordinates,
            },
          }}
        >
          <Mapbox.LineLayer
            id="route"
            style={{
              lineColor: '#3b82f6',
              lineWidth: 4,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
        </Mapbox.ShapeSource>

        <Mapbox.PointAnnotation
          id="start"
          coordinate={coordinates[0]}
          title="Inicio"
        >
          <View style={styles.marker}>
            <View style={styles.markerStart} />
          </View>
        </Mapbox.PointAnnotation>

        <Mapbox.PointAnnotation
          id="end"
          coordinate={coordinates[coordinates.length - 1]}
          title="Destino"
        >
          <View style={styles.marker}>
            <View style={styles.markerEnd} />
          </View>
        </Mapbox.PointAnnotation>
      </Mapbox.MapView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    height: 300,
    borderRadius: 12,
    overflow: 'hidden',
  },
  map: {
    flex: 1,
  },
  marker: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerStart: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: 'white',
  },
  markerEnd: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#EF4444',
    borderWidth: 2,
    borderColor: 'white',
  },
});

export default MapView;
