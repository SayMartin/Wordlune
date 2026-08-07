module.exports = {
  expo: {
    name: 'Wordse',
    slug: 'wordse',
    version: '0.0.1',
    orientation: 'portrait',
    userInterfaceStyle: 'automatic',
    icon: './assets/icon.png',
    ios: {
      bundleIdentifier: 'se.wordse.app',
    },
    android: {
      package: 'se.wordse.app',
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
