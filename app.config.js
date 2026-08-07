module.exports = {
  expo: {
    name: 'WordseNative',
    slug: 'WordseNative',
    version: '0.0.1',
    orientation: 'portrait',
    userInterfaceStyle: 'automatic',
    icon: './assets/icon.png',
    ios: {
      bundleIdentifier: 'org.reactjs.native.example.WordseNative',
    },
    android: {
      package: 'com.wordsenative',
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#4f46e5',
      },
    },
    web: {
      bundler: 'metro',
      output: 'single',
      favicon: './assets/favicon.png',
    },
  },
};
