import { useAppLanguage } from "../../context/LanguageContext";
import React from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft } from "lucide-react-native";
import {
  responsiveHeight,
  responsiveWidth,
} from "react-native-responsive-dimensions";
import { useNavigation } from "@react-navigation/native";
import { useMadbelGetAboutUsQuery } from "../../redux/slices/madbelApiSlice";

const ProfileAboutScreen = () => {
  const { t } = useAppLanguage();
  const navigation = useNavigation();
  const { data: aboutResponse, isLoading } = useMadbelGetAboutUsQuery(undefined, {
    refetchOnMountOrArgChange: true,
  });

  const blocks = aboutResponse?.data?.blocks || [];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.iconWrap} onPress={() => navigation.goBack()}>
            <ChevronLeft size={35} color="#F8FAFC" strokeWidth={2.3} />
          </Pressable>
          <Text style={styles.title}>{t("about_us")}</Text>
          <View style={styles.spacer} />
        </View>

        {isLoading ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <ActivityIndicator size="large" color="#12BFD9" />
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
            {blocks.map((item, index) => (
              <Text key={String(index)} style={styles.paragraph}>
                {`${item.order || index + 1}. ${item.body}`}
              </Text>
            ))}
          </ScrollView>
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
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: responsiveHeight(2.6),
  },
  iconWrap: {
    width: responsiveWidth(9),
    alignItems: "flex-start",
  },
  title: {
    color: "#F8FAFC",
    fontSize: 52 / 2,
    fontWeight: "700",
  },
  spacer: {
    width: responsiveWidth(9),
  },
  content: {
    gap: responsiveHeight(1.8),
    paddingBottom: responsiveHeight(3),
  },
  paragraph: {
    color: "#EFF3F7",
    fontSize: 48 / 2,
    lineHeight: 40,
    fontWeight: "400",
  },
});

export default ProfileAboutScreen;
