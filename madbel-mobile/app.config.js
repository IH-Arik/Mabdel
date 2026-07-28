// const baseConfig = require("./app.json");

// const getEnv = (key) => {
//   const value = process.env[key];
//   return typeof value === "string" && value.trim().length > 0
//     ? value.trim()
//     : undefined;
// };

// const baseExpo = baseConfig.expo || {};
// const basePlugins = Array.isArray(baseExpo.plugins) ? [...baseExpo.plugins] : [];

// const googleIosUrlScheme = getEnv("GOOGLE_IOS_URL_SCHEME");
// const googleWebClientId =
//   getEnv("GOOGLE_WEB_CLIENT_ID") ||
//   "314818251696-n1fklhtg2r5iiflj3gh6v6ckeitn7fvg.apps.googleusercontent.com";
// const googleIosClientId =
//   getEnv("GOOGLE_IOS_CLIENT_ID") ||
//   "314818251696-mf4lp0b6rofccepnmgdlfiss9lppgoep.apps.googleusercontent.com";
// const googleAndroidClientId = getEnv("GOOGLE_ANDROID_CLIENT_ID");
// const derivedIosUrlScheme = googleIosClientId
//   ? `com.googleusercontent.apps.${googleIosClientId.replace(
//       /\.apps\.googleusercontent\.com$/,
//       "",
//     )}`
//   : undefined;
// const finalIosUrlScheme = googleIosUrlScheme || derivedIosUrlScheme;

// // basePlugins.unshift("./plugins/withGoogleSigninPodfileFix");
// // basePlugins.unshift("./plugins/withGoogleSigninIOSConfig");

// if (finalIosUrlScheme) {
//   basePlugins.push([
//     "@react-native-google-signin/google-signin",
//     { iosUrlScheme: finalIosUrlScheme },
//   ]);
// } else {
//   basePlugins.push("@react-native-google-signin/google-signin");
// }

// module.exports = {
//   expo: {
//     ...baseExpo,
//     ios: {
//       ...baseExpo.ios,
//       googleServicesFile: "./GoogleService-Info.plist",
//       infoPlist: {
//         ...(baseExpo.ios?.infoPlist || {}),
//         GIDClientID: googleIosClientId,
//       },
//     },
//     plugins: basePlugins,
//     extra: {
//       ...(baseExpo.extra || {}),
//       googleSignIn: {
//         webClientId: googleWebClientId,
//         iosClientId: googleIosClientId,
//         androidClientId: googleAndroidClientId,
//         iosUrlScheme: finalIosUrlScheme,
//       },
//     },
//   },
// };


const baseConfig = require("./app.json");

const getEnv = (key) => {
  const value = process.env[key];
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
};

const baseExpo = baseConfig.expo || {};
const basePlugins = Array.isArray(baseExpo.plugins)
  ? [...baseExpo.plugins]
  : [];

const googleIosUrlScheme = getEnv("GOOGLE_IOS_URL_SCHEME");
const googleWebClientId =
  getEnv("GOOGLE_WEB_CLIENT_ID") ||
  "314818251696-n1fklhtg2r5iiflj3gh6v6ckeitn7fvg.apps.googleusercontent.com";
const googleIosClientId =
  getEnv("GOOGLE_IOS_CLIENT_ID") ||
  "314818251696-mf4lp0b6rofccepnmgdlfiss9lppgoep.apps.googleusercontent.com";
const googleAndroidClientId = getEnv("GOOGLE_ANDROID_CLIENT_ID");
const derivedIosUrlScheme = googleIosClientId
  ? `com.googleusercontent.apps.${googleIosClientId.replace(
      /\.apps\.googleusercontent\.com$/,
      "",
    )}`
  : undefined;
const finalIosUrlScheme = googleIosUrlScheme || derivedIosUrlScheme;

// basePlugins.unshift("./plugins/withGoogleSigninPodfileFix");
// basePlugins.unshift("./plugins/withGoogleSigninIOSConfig");
basePlugins.unshift("@react-native-community/datetimepicker");
basePlugins.unshift([
  "expo-calendar",
  {
    calendarPermission:
      "Allow Mabdel to access your calendar so meetings can be synced to Apple Calendar.",
  },
]);

if (finalIosUrlScheme) {
  basePlugins.push([
    "@react-native-google-signin/google-signin",
    { iosUrlScheme: finalIosUrlScheme },
  ]);
} else {
  basePlugins.push("@react-native-google-signin/google-signin");
}

module.exports = {
  expo: {
    ...baseExpo,
    ios: {
      ...baseExpo.ios,
      googleServicesFile: "./GoogleService-Info.plist",
      infoPlist: {
        ...(baseExpo.ios?.infoPlist || {}),
        NSCalendarsUsageDescription:
          "Allow Mabdel to access your calendar so meetings can be synced to Apple Calendar.",
        NSCalendarsFullAccessUsageDescription:
          "Allow Mabdel to access your calendar so meetings can be synced to Apple Calendar.",
        GIDClientID: googleIosClientId,
      },
    },
    plugins: basePlugins,
    extra: {
      ...(baseExpo.extra || {}),
      googleSignIn: {
        webClientId: googleWebClientId,
        iosClientId: googleIosClientId,
        androidClientId: googleAndroidClientId,
        iosUrlScheme: finalIosUrlScheme,
      },
    },
  },
};
