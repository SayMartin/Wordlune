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
    android: {
      package: 'se.wordlune.app',
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
