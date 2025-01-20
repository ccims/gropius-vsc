const path = require('path');
const { VueLoaderPlugin } = require('vue-loader');

module.exports = {
    mode: 'development', // Change to 'production' for production builds
    entry: './src/webview/main.ts', // Entry point for your Vue app
    output: {
        path: path.resolve(__dirname, 'out/webview'), // Output directory
        filename: 'webview.js', // Output file name
    },
    resolve: {
        extensions: ['.ts', '.js', '.vue'], // Extensions to resolve
        alias: {
            vue$: 'vue/dist/vue.esm-bundler.js', // Use the ES module build of Vue
        },
    },
    module: {
        rules: [
            {
                test: /\.vue$/,
                loader: 'vue-loader', // Handle .vue files
            },
            {
                test: /\.ts$/,
                loader: 'ts-loader', // Handle TypeScript files
                options: {
                    appendTsSuffixTo: [/\.vue$/], // Treat .vue files as TypeScript
                },
            },
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader'], // Handle CSS files
            },
        ],
    },
    plugins: [
        new VueLoaderPlugin(), // Enable Vue loader plugin
    ],
    devtool: 'source-map', // Enable source maps for debugging
};
