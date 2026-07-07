import { View, Text, StyleSheet, Image } from "react-native";
import { useAppLanguage } from "../../context/LanguageContext";
import React, { useEffect } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";

const BeginScreen = () => {
  const { t } = useAppLanguage();
  const navigation = useNavigation();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigation.replace("Onboarding");
    }, 1700);

    return () => clearTimeout(timer);
  }, [navigation]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={["#031017", "#02080B", "#010304"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.screen}
      >
        <Image
          source={require("../../../assets/images/logo.png")}
          style={styles.logoGlow}
          resizeMode="contain"
        />
        <View style={styles.brandWrap}>
          <Text style={styles.brandTitle}>{t("smartflow")}</Text>
          <Text style={styles.brandSubTitle}>{t("automating_future")}</Text>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#02080B",
  },
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  logoGlow: {
    width: '60%',
    height: '60%',
  },
  brandWrap: {
    marginTop: 28,
    alignItems: "center",
    gap: 8,
  },
  brandTitle: {
    color: "#11C7E5",
    fontSize: 64 / 2,
    fontWeight: "800",
  },
  brandSubTitle: {
    color: "#11C7E5",
    fontSize: 14,
    letterSpacing: 6,
    fontWeight: "700",
  },
});

export default BeginScreen;
