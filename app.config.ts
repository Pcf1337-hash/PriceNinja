import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'PriceNinja',
  slug: 'price-ninja',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'dark',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#0a0a1a',
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.priceninja.app',
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#080808',
    },
    package: 'com.priceninja.app',
    permissions: [
      'android.permission.CAMERA',
      'android.permission.INTERNET',
      'android.permission.WRITE_EXTERNAL_STORAGE',
    ],
  },
  plugins: [
    'expo-router',
    'expo-camera',
    'expo-image-picker',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#0a0a1a',
        image: './assets/splash.png',
        imageWidth: 200,
      },
    ],
    'expo-secure-store',
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    router: {
      origin: false,
    },
    eas: {
      projectId: 'price-ninja',
    },
  },
  scheme: 'priceninja',
});
