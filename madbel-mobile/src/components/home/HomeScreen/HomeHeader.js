import React, { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { responsiveHeight, responsiveWidth } from "react-native-responsive-dimensions";
import { Bell, ChevronDown, Check } from "lucide-react-native";
import { LANGUAGES, useAppLanguage } from "../../../context/LanguageContext";

const rw = (value) => responsiveWidth(value);
const rh = (value) => responsiveHeight(value);

const HomeHeader = ({ greeting = "Good Morning", onNotificationPress }) => {
  const { appLanguage, setAppLanguage, currentAppLang, t } = useAppLanguage();
  const [showLangModal, setShowLangModal] = useState(false);

  return (
    <>
      <View style={styles.header}>
        <Text style={styles.greeting}>{greeting}</Text>
        <View style={styles.headerRight}>
          <Pressable
            style={styles.langPill}
            onPress={() => setShowLangModal(true)}
          >
            <Text style={styles.langText}>{currentAppLang.label}</Text>
            <ChevronDown size={14} color="#D8E4F3" />
          </Pressable>
          <Pressable style={styles.iconBtn} onPress={onNotificationPress}>
            <Bell size={23} color="#F4F9FF" strokeWidth={2.1} />
          </Pressable>
        </View>
      </View>

      <Modal
        animationType="slide"
        transparent
        visible={showLangModal}
        onRequestClose={() => setShowLangModal(false)}
      >
        <Pressable
          style={styles.langBackdrop}
          onPress={() => setShowLangModal(false)}
        >
          <Pressable style={styles.langSheet} onPress={() => {}}>
            <View style={styles.langHandle} />
            <Text style={styles.langSheetTitle}>{t("app_language")}</Text>
            <Text style={styles.langSheetSub}>{t("app_language_subtitle")}</Text>
            <ScrollView style={styles.langList} showsVerticalScrollIndicator={false}>
              {LANGUAGES.map((lang) => {
                const active = lang.code === appLanguage;
                return (
                  <Pressable
                    key={lang.code}
                    style={[styles.langRow, active && styles.langRowActive]}
                    onPress={() => {
                      setAppLanguage(lang.code);
                      setShowLangModal(false);
                    }}
                  >
                    <View style={styles.langRowLeft}>
                      <Text style={styles.langRowLabel}>{lang.label}</Text>
                      <Text style={[styles.langRowName, active && styles.langRowNameActive]}>
                        {lang.name}
                      </Text>
                    </View>
                    {active && <Check size={18} color="#19CDEB" strokeWidth={2.5} />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: rh(0.4),
  },
  greeting: {
    color: "#F3F8FF",
    fontSize: rw(5),
    fontWeight: "700",
    width: '60%'
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: rw(2.2),
  },
  langPill: {
    height: rh(4.6),
    borderRadius: rh(2.3),
    borderWidth: 1,
    borderColor: "#2B3645",
    backgroundColor: "#0D131D",
    paddingHorizontal: rw(3),
    flexDirection: "row",
    alignItems: "center",
    gap: rw(1.4),
  },
  langText: {
    color: "#D8E4F3",
    fontSize: rw(3.2),
    fontWeight: "600",
  },
  iconBtn: {
    width: rh(4.6),
    height: rh(4.6),
    borderRadius: rh(2.3),
    alignItems: "center",
    justifyContent: "center",
  },
  langBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "flex-end",
  },
  langSheet: {
    maxHeight: "72%",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#233041",
    paddingHorizontal: rw(4),
    paddingTop: rh(1.2),
    paddingBottom: rh(3),
  },
  langHandle: {
    alignSelf: "center",
    width: rw(14),
    height: 5,
    borderRadius: 999,
    backgroundColor: "#334155",
    marginBottom: rh(1.4),
  },
  langSheetTitle: {
    color: "#F4F8FF",
    fontSize: rw(4.6),
    fontWeight: "700",
  },
  langSheetSub: {
    marginTop: rh(0.5),
    marginBottom: rh(1.4),
    color: "#93A4B9",
    fontSize: rw(3.4),
  },
  langList: {
    maxHeight: rh(46),
  },
  langRow: {
    minHeight: rh(6.5),
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#243041",
    backgroundColor: "#0D131D",
    paddingHorizontal: rw(3.5),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: rh(0.9),
  },
  langRowActive: {
    borderColor: "#19CDEB",
    backgroundColor: "#102A33",
  },
  langRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: rw(3),
  },
  langRowLabel: {
    color: "#19CDEB",
    fontWeight: "800",
    fontSize: rw(3.9),
    minWidth: rw(10),
  },
  langRowName: {
    color: "#D8E4F3",
    fontSize: rw(3.9),
    fontWeight: "600",
  },
  langRowNameActive: {
    color: "#FFFFFF",
  },
});

export default HomeHeader;
