import type { ExpoConfig } from 'expo/config';

/**
 * Build variants. Each installs side by side with its own identifier and its own Firebase
 * project (configured through EXPO_PUBLIC_FIREBASE_* in the matching EAS environment).
 *   development — dev client against the dev Firebase project or the local emulators
 *   staging     — internal testing builds (EAS "preview" profile)
 *   production  — store builds
 */
type Variant = 'development' | 'staging' | 'production';
const variant: Variant = (['development', 'staging', 'production'] as const).includes(
  process.env.APP_VARIANT as Variant,
)
  ? (process.env.APP_VARIANT as Variant)
  : 'development';

// Replace with your organisation's reverse-DNS identifier before the first store submission.
const baseIdentifier = process.env.APP_BUNDLE_ID ?? 'com.meditrack.app';
const identifier =
  variant === 'production'
    ? baseIdentifier
    : `${baseIdentifier}.${variant === 'staging' ? 'staging' : 'dev'}`;
const name =
  variant === 'production' ? 'MediTrack' : `MediTrack ${variant === 'staging' ? 'Staging' : 'Dev'}`;

const config: ExpoConfig = {
  name,
  slug: 'meditrack',
  scheme: variant === 'production' ? 'meditrack' : `meditrack-${variant}`,
  version: '1.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  icon: './assets/images/icon.png',
  ios: {
    bundleIdentifier: identifier,
    buildNumber: '1',
    supportsTablet: false,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
    privacyManifests: {
      NSPrivacyAccessedAPITypes: [
        {
          // AsyncStorage and SecureStore use UserDefaults for app-private preferences.
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults',
          NSPrivacyAccessedAPITypeReasons: ['CA92.1'],
        },
      ],
    },
  },
  android: {
    package: identifier,
    versionCode: 1,
    adaptiveIcon: {
      foregroundImage: './assets/images/adaptive-icon.png',
      backgroundColor: '#1769AA',
    },
    // Auth tokens and the notification queue live in app storage; keep them out of cloud backups.
    allowBackup: false,
    permissions: ['POST_NOTIFICATIONS', 'RECEIVE_BOOT_COMPLETED', 'VIBRATE'],
    blockedPermissions: [
      'android.permission.RECORD_AUDIO',
      'android.permission.SYSTEM_ALERT_WINDOW',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
    ],
  },
  web: { favicon: './assets/images/favicon.png' },
  plugins: [
    'expo-router',
    'expo-secure-store',
    ['expo-notifications', { icon: './assets/images/notification-icon.png', color: '#1769AA' }],
    [
      'expo-splash-screen',
      {
        image: './assets/images/splash-icon.png',
        imageWidth: 180,
        resizeMode: 'contain',
        backgroundColor: '#F5F7FA',
      },
    ],
  ],
  experiments: { typedRoutes: true },
  extra: {
    appVariant: variant,
    eas: { projectId: process.env.EAS_PROJECT_ID },
  },
};

export default config;
