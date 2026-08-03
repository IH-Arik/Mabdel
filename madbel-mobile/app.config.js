const getEnv = (key) => {
  const value = process.env[key];
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
};

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

module.exports = {
  expo: {
    name: "madbel",
    slug: "madbel",
    scheme: "madbel",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#000000",
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.madbelai.madbel",
      googleServicesFile: "./GoogleService-Info.plist",
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          "We use your location to show nearby activities within 10 miles.",
        NSMicrophoneUsageDescription:
          "Allow Mabdel to record voice commands for AI assistance.",
        NSContactsUsageDescription:
          "Allow Mabdel to import contacts from your phone.",
        NSPhotoLibraryUsageDescription:
          "Allow Mabdel to choose photos and videos for uploads.",
        NSCalendarsUsageDescription:
          "Allow Mabdel to access your calendar so meetings can be synced to Apple Calendar.",
        NSCalendarsFullAccessUsageDescription:
          "Allow Mabdel to access your calendar so meetings can be synced to Apple Calendar.",
        GIDClientID: googleIosClientId,
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff",
      },
      permissions: [
        "ACCESS_COARSE_LOCATION",
        "ACCESS_FINE_LOCATION",
        "READ_CONTACTS",
        "android.permission.READ_CALENDAR",
        "android.permission.WRITE_CALENDAR",
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.RECORD_AUDIO",
        "android.permission.MODIFY_AUDIO_SETTINGS",
        "android.permission.READ_CONTACTS",
        "android.permission.WRITE_CONTACTS",
        "android.permission.READ_MEDIA_IMAGES",
        "android.permission.READ_MEDIA_VIDEO",
      ],
      googleServicesFile: "./google-services.json",
      package: "com.madbelai.madbel",
    },
    plugins: [
      [
        "expo-calendar",
        {
          calendarPermission:
            "Allow Mabdel to access your calendar so meetings can be synced to Apple Calendar.",
        },
      ],
      "@react-native-community/datetimepicker",
      "expo-location",
      [
        "expo-audio",
        {
          microphonePermission:
            "Allow Mabdel to record voice commands for AI assistance.",
        },
      ],
      "expo-speech-recognition",
      "expo-secure-store",
      [
        "expo-contacts",
        {
          contactsPermission:
            "Allow Mabdel to import contacts from your phone.",
        },
      ],
      "expo-asset",
      [
        "expo-splash-screen",
        {
          image: "./assets/splash-icon.png",
          imageWidth: 220,
          resizeMode: "contain",
          backgroundColor: "#000000",
        },
      ],
      [
        "expo-notifications",
        {
          icon: "./assets/icon.png",
          color: "#17CBE8",
          sounds: [],
        },
      ],
      finalIosUrlScheme
        ? [
            "@react-native-google-signin/google-signin",
            { iosUrlScheme: finalIosUrlScheme },
          ]
        : "@react-native-google-signin/google-signin",
    ],
    web: {
      favicon: "./assets/favicon.png",
    },
    extra: {
      googleSignIn: {
        webClientId: googleWebClientId,
        iosClientId: googleIosClientId,
        androidClientId: googleAndroidClientId,
        iosUrlScheme: finalIosUrlScheme,
      },
    },
  },
};
