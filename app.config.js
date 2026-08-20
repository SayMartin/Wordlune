module.exports = {
  expo: {
    name: 'Wordlune',
    slug: 'wordlune',
    version: '0.0.1',
    orientation: 'portrait',
    userInterfaceStyle: 'automatic',
    icon: './assets/icon.png',
    ios: {
      bundleIdentifier: 'se.wordlune.app',
    },
    // Declared so a deep link opens the app rather than the browser; the
    // matching intent-filter is already in android/app/src/main/AndroidManifest.xml.
    scheme: 'se.wordlune.app',
    // expo-sharing backs the native half of the GDPR data export (Settings ->
    // Data & Privacy). `npx expo install` can't edit a dynamic config itself,
    // so this is registered by hand.
    plugins: ['expo-sharing'],
    android: {
      package: 'se.wordlune.app',
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#4f46e5',
      },
      // NOTE: this repo uses the bare workflow (android/ is committed), so
      // these are NOT what ships — Gradle merges the checked-in manifest as
      // written. They exist so that a future `expo prebuild` regenerates the
      // same intent rather than silently reinstating the library defaults.
      // The authoritative version is the tools:node="remove" block in
      // android/app/src/main/AndroidManifest.xml; keep the two in step.
      permissions: ['android.permission.INTERNET'],
      blockedPermissions: [
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.WRITE_EXTERNAL_STORAGE',
        'android.permission.SYSTEM_ALERT_WINDOW',
        'android.permission.VIBRATE',
      ],
    },
    web: {
      bundler: 'metro',
      output: 'single',
      favicon: './assets/favicon.png',
    },
  },
};
