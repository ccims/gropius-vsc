const path = require('path');
const { VueLoaderPlugin } = require('vue-loader');
const webpack = require('webpack');

module.exports = {
    mode: 'development', // Change to 'production' for production builds
    entry: {
        graph: './src/webview/main.ts', // Original Vue app
        componentDetails: './src/webview/component-details.ts', // New Vue app
        graphEditor: './src/webview/graph-editor.ts'
    },
    output: {
        path: path.resolve(__dirname, 'out/webview'),
        filename: '[name].js', // Use [name] to create unique filenames like graph.js and componentDetails.js
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
                    appendTsSuffixTo: [/\\.vue$/], // Treat .vue files as TypeScript
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
        new webpack.DefinePlugin({
            __VUE_OPTIONS_API__: true, // Enable Vue Options API
            __VUE_PROD_DEVTOOLS__: false, // Disable Vue DevTools in production
            __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false, // Explicitly disable hydration mismatch details
        }),
    ],
    devtool: 'source-map', // Enable source maps for debugging
};
