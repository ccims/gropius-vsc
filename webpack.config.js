// webpack.config.js - I'll mark new or modified parts with comments

const path = require('path');
const { VueLoaderPlugin } = require('vue-loader');
const webpack = require('webpack');

module.exports = {
    mode: 'development',
    target: 'web',
    entry: {
        graph: './src/webview/main.ts',
        gropiusComponentVersions: './src/webview/gropius-component-versions.ts',
        componentIssues: './src/webview/componentIssues.ts',
        issueDetails: './src/webview/issueDetails.ts',
        graphs: './src/webview/graphs.ts',
        graphEditor: './src/webview/graph-editor.ts',
        graphWorkspaceEditor: './src/webview/GraphWorkspace.ts',
        graphIssueEditor: './src/webview/GraphIssue.ts'
    },
    output: {
        path: path.resolve(__dirname, 'out', 'webview'),
        filename: '[name].js',
        libraryTarget: 'umd',
    },
    resolve: {
        extensions: ['.ts', '.js', '.vue'],
        alias: {
            vue$: 'vue/dist/vue.esm-bundler.js',
            // NEW: Add this alias for easier imports
            '@': path.resolve(__dirname, 'src'),
        },
    },
    module: {
        rules: [
            {
                test: /\.vue$/,
                loader: 'vue-loader',
                // NEW: Add options for Vue loader
                options: {
                    enableTsInTemplate: true,
                }
            },
            {
                test: /\.ts$/,
                loader: 'ts-loader',
                // MODIFIED: Fix the regex and add important options
                options: {
                    appendTsSuffixTo: [/\.vue$/], // Fixed the regex
                    transpileOnly: true,
                    configFile: path.resolve(__dirname, 'tsconfig.json'),
                },
                exclude: /node_modules/,
            },
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader'],
            },
        ],
    },
    plugins: [
        new VueLoaderPlugin(),
        new webpack.DefinePlugin({
            __VUE_OPTIONS_API__: true,
            __VUE_PROD_DEVTOOLS__: false,
            __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
            // NEW: Add this for better development experience
            'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
        }),
    ],
    devtool: 'source-map',
    // NEW: Add better build output configuration
    stats: {
        modules: false,
        children: false,
        chunks: false,
        assets: false,
    },
};