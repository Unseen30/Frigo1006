
# Permisos de Android Requeridos

Esta app requiere los siguientes permisos en Android:

## Permisos principales:
- **ACCESS_FINE_LOCATION**: Para rastreo GPS preciso
- **ACCESS_COARSE_LOCATION**: Para ubicación aproximada
- **INTERNET**: Para cargar mapas y sincronizar datos
- **ACCESS_NETWORK_STATE**: Para verificar conectividad

## Permisos opcionales:
- **CAMERA**: Para futuras funcionalidades de cámara
- **WRITE_EXTERNAL_STORAGE**: Para almacenar datos localmente

## Configuración automática:
Capacitor configurará automáticamente estos permisos en el AndroidManifest.xml cuando ejecutes `npx cap sync`.

## Instrucciones para compilar:

1. Exporta el proyecto a tu repositorio GitHub
2. Clona el proyecto localmente: `git clone [tu-repo-url]`
3. Instala dependencias: `npm install`
4. Agrega la plataforma Android: `npx cap add android`
5. Construye el proyecto: `npm run build`
6. Sincroniza con Capacitor: `npx cap sync android`
7. Abre en Android Studio: `npx cap open android`

## Requisitos del sistema:
- Android Studio instalado
- Java 17 configurado
- Android SDK API 33 o superior
- Gradle actualizado

## Notas importantes:
- La app está optimizada para funcionar offline
- Los mapas requieren conexión a internet
- El rastreo GPS funciona en segundo plano
