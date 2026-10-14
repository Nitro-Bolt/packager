const path = require('path');
const rspack = require('@rspack/core');
const {RsdoctorRspackPlugin} = require('@rsdoctor/rspack-plugin');
const HtmlRspackPlugin = require('html-rspack-plugin');
const AddBuildIDToOutputPlugin = require('./src/build/add-build-id-to-output-plugin');
const GenerateServiceWorkerPlugin = require('./src/build/generate-service-worker-plugin');

const isProduction = process.env.NODE_ENV === 'production';
const isStandalone = Boolean(process.env.STANDALONE);
const dist = path.resolve(__dirname, 'dist');
const buildId = isProduction ? require('./src/build/generate-scaffolding-build-id') : null;
const browserFallback = {
  assert: require.resolve('assert/'),
  events: require.resolve('events/'),
  stream: require.resolve('stream-browserify'),
  util: require.resolve('util/'),
  zlib: require.resolve('browserify-zlib')
};

const base = {
  mode: isProduction ? 'production' : 'development'
};

const getVersion = () => {
  if (process.env.VERSION) {
    return process.env.VERSION;
  }
  if (isStandalone) {
    const now = new Date();
    const dateString = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
    const packageJSON = require('./package.json');
    return `Standalone v${packageJSON.version} (${dateString})`;
  }
  return null;
};
const version = getVersion();

const makeScaffolding = ({full}) => ({
  ...base,
  devtool: isProduction ? false : 'source-map',
  output: {
    filename: 'scaffolding/[name].js',
    path: dist
  },
  entry: full ? {
    'scaffolding-full': './src/scaffolding/export.js',
    addons: './src/addons/index.js'
  } : {
    'scaffolding-min': './src/scaffolding/export.js'
  },
  resolve: {
    alias: {
      'text-encoding$': path.resolve(__dirname, 'src', 'scaffolding', 'text-encoding'),
      'htmlparser2$': path.resolve(__dirname, 'src', 'scaffolding', 'htmlparser2'),
      'scratch-translate-extension-languages$': path.resolve(__dirname, 'src', 'scaffolding', 'scratch-translate-extension-languages', 'languages.json'),
      'scratch-parser$': path.resolve(__dirname, 'src', 'scaffolding', 'scratch-parser')
    },
    fallback: browserFallback
  },
  module: {
    rules: [
      {
        test: /en\.json$/,
        resourceQuery: /unstructure/,
        type: 'json',
        loader: path.resolve(__dirname, 'src', 'build', 'unstructure-translations-loader.js')
      },
      {
        resourceQuery: /source/,
        type: 'asset/source'
      },
      {
        test: /\.jsx?$/,
        loader: 'babel-loader',
        include: [
          path.resolve(__dirname, 'src'),
          path.resolve(__dirname, '../scratch-render/src'),
          path.resolve(__dirname, '../scratch-storage/src'),
          path.resolve(__dirname, '../scratch-vm/src'),
          /node_modules[\\/]scratch-[^\\/]+[\\/]src/
        ],
        options: {
          babelrc: false,
          presets: ['@babel/preset-env']
        }
      },
      {
        test: /\.(frag|vert)$/i,
        type: 'asset/source'
      },
      {
        test: /\.(svg|png)$/i,
        type: 'asset/inline'
      },
      full ? {
        test: /\.mp3$/i,
        type: 'asset/inline'
      } : {
        test: /\.mp3$/i,
        type: 'javascript/auto',
        loader: path.resolve(__dirname, 'src', 'build', 'noop-loader.js')
      },
      {
        test: /\.css$/i,
        resourceQuery: {not: [/source/]},
        use: [
          {
            loader: 'style-loader',
            options: {
              insert: path.resolve(__dirname, 'src', 'build', 'insert-style.js')
            }
          },
          {
            loader: 'css-loader',
            options: {
              esModule: false,
              modules: {
                localIdentName: 'sc-[local]',
                exportLocalsConvention: 'camel-case'
              }
            }
          }
        ]
      }
    ]
  },
  plugins: [
    new rspack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
      process: require.resolve('process/browser')
    }),
    ...(buildId ? [new AddBuildIDToOutputPlugin(buildId)] : []),
    ...(process.env.BUNDLE_ANALYZER === (full ? 'scaffolding-full' : 'scaffolding-min') ?
      [new RsdoctorRspackPlugin()] : [])
  ]
});

const commonFrontendPlugins = () => [
  new rspack.DefinePlugin({
    'process.env.SCAFFOLDING_BUILD_ID': buildId ? JSON.stringify(buildId) : '("development-" + Math.random().toString().substring(2))',
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development')
  })
];

const makeWebsite = () => ({
  ...base,
  devtool: isStandalone ? false : 'source-map',
  output: {
    filename: isProduction ? 'js/[name].[contenthash].js' : 'js/[name].js',
    path: dist
  },
  entry: {
    p4: './src/p4/index.js'
  },
  resolve: {
    alias: {
      svelte: path.resolve('node_modules', 'svelte')
    },
    fallback: browserFallback,
    extensions: ['.mjs', '.js', '.svelte'],
    mainFields: ['svelte', 'browser', 'module', 'main']
  },
  optimization: {
    splitChunks: {
      chunks: 'all',
      minChunks: 2
    }
  },
  module: {
    parser: isStandalone ? {
      javascript: {
        dynamicImportMode: 'eager'
      }
    } : undefined,
    rules: [
      {
        test: /en\.json$/,
        resourceQuery: /unstructure/,
        type: 'json',
        loader: path.resolve(__dirname, 'src', 'build', 'unstructure-translations-loader.js')
      },
      {
        resourceQuery: /service-worker/,
        type: 'asset/resource',
        generator: {
          filename: 'sw.js'
        }
      },
      {
        test: /\.(png|svg)$/i,
        resourceQuery: {not: [/service-worker/]},
        type: isStandalone ? 'asset/inline' : 'asset/resource',
        generator: isStandalone ? undefined : {
          filename: 'assets/[name].[contenthash][ext]'
        }
      },
      {
        test: /\.(html|svelte)$/,
        loader: 'svelte-loader'
      }
    ]
  },
  plugins: [
    ...commonFrontendPlugins(),
    new rspack.CopyRspackPlugin({
      patterns: [{from: 'static'}]
    }),
    new rspack.DefinePlugin({
      'process.env.ENABLE_SERVICE_WORKER': JSON.stringify(process.env.ENABLE_SERVICE_WORKER),
      'process.env.STANDALONE': JSON.stringify(isStandalone),
      'process.env.VERSION': JSON.stringify(version)
    }),
    new HtmlRspackPlugin({
      filename: 'index.html',
      template: './src/p4/template.ejs',
      chunks: ['p4']
    }),
    new GenerateServiceWorkerPlugin(),
    ...(process.env.BUNDLE_ANALYZER === 'p4' ? [new RsdoctorRspackPlugin()] : [])
  ],
  devServer: {
    static: {
      directory: dist
    },
    compress: true,
    client: {
      overlay: true
    },
    host: '0.0.0.0',
    port: 8947
  }
});

const makeNode = () => ({
  ...base,
  devtool: false,
  target: 'node',
  output: {
    filename: '[name].js',
    path: dist,
    library: {
      name: 'packager',
      type: 'umd'
    }
  },
  node: {
    __dirname: false
  },
  entry: {
    packager: './src/packager/node/export.js'
  },
  externals: {
    '@turbowarp/jszip': '@turbowarp/jszip',
    '@turbowarp/sbdl': '@turbowarp/sbdl',
    '@fiahfy/icns': '@fiahfy/icns',
    'cross-fetch': 'cross-fetch',
    'sha.js': 'sha.js'
  },
  module: {
    rules: [{
      test: /\.(png|svg)$/i,
      type: 'asset/resource'
    }]
  },
  plugins: [
    ...commonFrontendPlugins(),
    ...(process.env.BUNDLE_ANALYZER === 'node' ? [new RsdoctorRspackPlugin()] : [])
  ]
});

module.exports = [
  makeScaffolding({full: true}),
  makeScaffolding({full: false}),
  ...(process.env.BUILD_MODE === 'node' ? [makeNode()] : [makeWebsite()])
];
