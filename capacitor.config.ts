
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.lovable.cargotracker',
  appName: 'FrigoTrack',
  webDir: 'dist',
  server: {
    url: 'http://10.0.2.2:8080', // Use local server for development
    cleartext: true
  },
  android: {
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined,
      keystorePassword: undefined,
      keystoreAliasPassword: undefined
    },
    webContentsDebuggingEnabled: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#ffffff",
      showSpinner: false
    },
    StatusBar: {
      style: "DEFAULT"
    },
    Geolocation: {
      permissions: {
        location: "always"
      }
    },
    Camera: {
      permissions: {
        camera: "camera",
        photos: "photos"
      }
    }
  }
};

export default config;
