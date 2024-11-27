const { defineConfig } = require('@vue/cli-service');

module.exports = defineConfig({
  transpileDependencies: true,
  publicPath: '',
  outputDir: '../dist/webview', // Output folder for the built Vue app
  assetsDir: '',
  filenameHashing: false,
  css: {
    extract: false // Prevents CSS from being extracted into separate files
  }
});
