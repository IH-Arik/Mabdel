import { useAppLanguage } from "../../context/LanguageContext";
import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet, Switch, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft } from "lucide-react-native";
import {
  responsiveHeight,
  responsiveWidth,
} from "react-native-responsive-dimensions";
import { useNavigation } from "@react-navigation/native";
import {
  useMadbelGetNotificationSettingsQuery,
  useMadbelUpdateNotificationSettingsMutation,
} from "../../redux/slices/madbelApiSlice";

const ProfileNotificationScreen = () => {
  const { t } = useAppLanguage();
  const navigation = useNavigation();

  const { data: settingsResponse, isLoading } = useMadbelGetNotificationSettingsQuery(undefined, {
    refetchOnMountOrArgChange: true,
  });
  const [updateSettings, { isLoading: isUpdating }] = useMadbelUpdateNotificationSettingsMutation();

  const [generalNotification, setGeneralNotification] = useState(true);
  const [sound, setSound] = useState(false);
  const [vibrate, setVibrate] = useState(true);

  // Sync state when data is loaded
  React.useEffect(() => {
    if (settingsResponse?.data) {
      const prefs = settingsResponse.data;
      if (prefs.general_notification !== undefined) setGeneralNotification(prefs.general_notification);
      if (prefs.sound !== undefined) setSound(prefs.sound);
      if (prefs.vibrate !== undefined) setVibrate(prefs.vibrate);
    }
  }, [settingsResponse]);

  const handleSave = async () => {
    try {
      await updateSettings({
        general_notification: generalNotification,
        sound: sound,
        vibrate: vibrate,
      }).unwrap();
      Alert.alert(t("success"), t("notification_settings_saved_successfully"));
      navigation.goBack();
    } catch (err) {
      Alert.alert(t("error"), t("could_not_save_notification_settings"));
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.iconWrap} onPress={() => navigation.goBack()}>
            <ChevronLeft size={35} color="#F8FAFC" strokeWidth={2.3} />
          </Pressable>
          <Text style={styles.title}>{t("notification")}</Text>
          <View style={styles.spacer} />
        </View>

        {isLoading ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <ActivityIndicator size="large" color="#12BFD9" />
          </View>
        ) : (
          <>
            <View style={styles.cardList}>
              <View style={styles.cardRow}>
                <Text style={styles.rowText}>{t("general_notification")}</Text>
                <Switch
                  trackColor={{ false: "#1C2330", true: "#DFF3FF" }}
                  thumbColor={generalNotification ? "#12BFD9" : "#12BFD9"}
                  ios_backgroundColor="#1C2330"
                  value={generalNotification}
                  onValueChange={setGeneralNotification}
                />
              </View>

              <View style={styles.cardRow}>
                <Text style={styles.rowText}>{t("sound")}</Text>
                <Switch
                  trackColor={{ false: "#1C2330", true: "#DFF3FF" }}
                  thumbColor={sound ? "#12BFD9" : "#12BFD9"}
                  ios_backgroundColor="#1C2330"
                  value={sound}
                  onValueChange={setSound}
                />
              </View>

              <View style={styles.cardRow}>
                <Text style={styles.rowText}>{t("vibrate")}</Text>
                <Switch
                  trackColor={{ false: "#1C2330", true: "#DFF3FF" }}
                  thumbColor={vibrate ? "#12BFD9" : "#12BFD9"}
                  ios_backgroundColor="#1C2330"
                  value={vibrate}
                  onValueChange={setVibrate}
                />
              </View>
            </View>

            <Pressable 
              style={[styles.saveBtn, isUpdating && { opacity: 0.7 }]} 
              onPress={handleSave}
              disabled={isUpdating}
            >
              <Text style={styles.saveText}>{isUpdating ? "Saving..." : "Save"}</Text>
            </Pressable>
          </>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#020406",
  },
  container: {
    flex: 1,
    paddingHorizontal: responsiveWidth(5),
    paddingTop: responsiveHeight(0.8),
    paddingBottom: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: responsiveHeight(3),
  },
  iconWrap: {
    width: responsiveWidth(9),
    alignItems: "flex-start",
  },
  title: {
    color: "#F8FAFC",
    fontSize: 40 / 2,
    fontWeight: "700",
  },
  spacer: {
    width: responsiveWidth(9),
  },
  cardList: {
    gap: responsiveHeight(1.6),
  },
  cardRow: {
    // minHeight: responsiveHeight(8.6),
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#212530",
    backgroundColor: "#1B1C21",
    padding: responsiveWidth(6),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowText: {
    color: "#EEF2F6",
    fontSize: 32 / 2,
    fontWeight: "400",
  },
  saveBtn: {
    marginTop: "auto",
    marginBottom: 10,
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: "#15C8E3",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#15C8E3",
    shadowOpacity: 0.55,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 22,
    elevation: 9,
  },
  saveText: {
    color: "#E8F4FA",
    fontSize: 32 / 2,
    fontWeight: "600",
  },
});

export default ProfileNotificationScreen;
