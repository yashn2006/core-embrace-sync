import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.coreegin.salesos',
  appName: 'CoreEgin Sales OS',
  webDir: 'dist',
  server: {
    // Point at the deployed web app so the native shell always serves the latest build.
    // Swap to the custom domain once coreegin.com is live.
    url: 'https://core-embrace-sync.lovable.app',
    cleartext: false,
  },
  ios: {
    contentInset: 'always',
    backgroundColor: '#ffffff',
  },
  android: {
    backgroundColor: '#ffffff',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#ffffff',
      showSpinner: false,
      androidSplashResourceName: 'splash',
      splashFullScreen: true,
      splashImmersive: true,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;