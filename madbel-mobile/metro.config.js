// const { getDefaultConfig } = require("expo/metro-config");
// const { withNativeWind } = require('nativewind/metro');
 
// const config = getDefaultConfig(__dirname)
 
// module.exports = withNativeWind(config, { input: './global.css' })


// const { getDefaultConfig } = require('expo/metro-config');
// const { withNativeWind } = require('nativewind/metro');

// const config = getDefaultConfig(__dirname);
// module.exports = withNativeWind(config, { input: './global.css' })

// config.resolver.extraNodeModules = {
//   '@': `${__dirname}/src`,
// };

// config.resolver.alias = {
//   '@': './src',
// };

// module.exports = config;

const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

// Get default config
const config = getDefaultConfig(__dirname);

// Add your path configurations FIRST
config.resolver.extraNodeModules = {
  '@': `${__dirname}/src`,
};

config.resolver.alias = {
  '@': './src',
};

// THEN apply NativeWind and export ONCE
module.exports = withNativeWind(config, { input: './global.css' });