
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.lovable.cargotracker',
  appName: 'FrigoTrack',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
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
        android: {
          fineLocation: ["foreground", "background"],
          coarseLocation: ["foreground", "background"]
        }
      }
    },
    BackgroundRunner: {
      label: 'com.lovable.cargotracker.background',
      src: 'runners/background.js',
      event: 'background-location-update',
      autoStart: true,
      autoStartBoot: true
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
