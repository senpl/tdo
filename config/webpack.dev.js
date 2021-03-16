var webpack = require('webpack'),
    merge = require('webpack-merge'),
    common = require('./webpack.config');

var specific = {
    mode: 'development',
    module: {
        rules: [{
            test: /\.scss$/,
            use: ["style-loader", "css-loader", "sass-loader"]
        }, {
            test: /\.css$/,
            use: ["style-loader", "css-loader"]
        }]
    },
    plugins: [
        new webpack.HotModuleReplacementPlugin()
    ],
    output: {
        publicPath: '/'
    },
    devtool: 'eval-cheap-source-map',
    devServer: {
        hot: true,
        port: 8088,
        noInfo: false,
        open: false,
        overlay: {
            warnings: true,
            errors: true,
        },
        inline: true,
            disableHostCheck: true,
   contentBase: 'dist',
        historyApiFallback: true
    }
};

module.exports = merge(common, specific);
