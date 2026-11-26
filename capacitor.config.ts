import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.omniconvert.app',
  appName: 'OmniConvert Pro',
  webDir: 'dist',
  server: {
    iosScheme: 'capacitor',
    androidScheme: 'https',
    cleartext: false,
  },
  ios: {
    contentInset: 'never',
    allowsLinkPreview: false,
    scrollEnabled: false,
    preferredContentMode: 'mobile',
  },
  plugins: {
    StatusBar: {
      overlaysWebView: true,
      style: 'DARK',
    },
  },
};

export default config;
