import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.medtechlab.maipal',
  appName: 'MaiPal 脉伴',
  webDir: 'dist/client',
  bundledWebRuntime: false,
  ios: {
    contentInset: 'always',
    backgroundColor: '#FAF5F0',
  },
  android: {
    backgroundColor: '#FAF5F0',
    allowMixedContent: false,
    // 'https' makes the WebView serve from https://localhost so cookies and
    // service workers behave the same as iOS, and the same CORS allowlist works.
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: '#7B8C76',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
      splashImmersive: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#FAF5F0',
      overlaysWebView: false,
    },
    Keyboard: {
      resize: 'native',
      resizeOnFullScreen: true,
    },
    // Social login provider IDs are baked into the native bundle at build time.
    // Set these env vars before `npm run build` / `cap sync`. See README.
    SocialLogin: {
      providers: {
        google: true,
        apple: true,
        oauth2: true,
      },
    },
  },
};

export default config;
