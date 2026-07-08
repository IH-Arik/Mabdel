import { useAppLanguage } from "../context/LanguageContext";
import React, { useMemo, useState, useEffect } from "react";
import { LinearGradient } from "expo-linear-gradient";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
  ActivityIndicator,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import {
  ArrowLeft,
  Bell,
  ChevronRight,
  IdCard,
  Mic,
  ShieldCheck,
} from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { featureSlides } from "../../assets/data/data";
import {
  useMadbelGetOnboardingSlidesQuery,
  useMadbelGetOnboardingProgressQuery,
  useMadbelSaveOnboardingProgressMutation,
  useMadbelSkipOnboardingMutation,
  useMadbelCompleteOnboardingMutation,
  useMadbelGetPermissionsQuery,
  useMadbelUpdatePermissionsMutation,
  useMadbelAcceptAllPermissionsMutation,
} from "../redux/slices/madbelApiSlice";

const colors = {
  bg: "#02080B",
  card: "#171D22",
  cardBorder: "#222A33",
  textPrimary: "#F2F6F8",
  textSecondary: "#A4B0B7",
  accent: "#11C7E5",
  mutedDot: "#2F3C52",
  toggleOff: "#2A3C55",
};

const DEVICE_ID_KEY = "@device_id";

const generateUUID = () => {
  const { t } = useAppLanguage();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

const getOrCreateDeviceId = async () => {
  try {
    let deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (!deviceId) {
      deviceId = generateUUID();
      await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
    }
    return deviceId;
  } catch (error) {
    return generateUUID();
  }
};

export default function OnboardingScreen() {
  const navigation = useNavigation();
  const [deviceId, setDeviceId] = useState(null);
  const [slideIndex, setSlideIndex] = useState(0);
  const [showPermissionPage, setShowPermissionPage] = useState(false);
  const [hasInitializedProgress, setHasInitializedProgress] = useState(false);
  const [permissions, setPermissions] = useState({
    microphone: true,
    notifications: true,
    contacts: true,
  });

  const { t } = useAppLanguage();

  // Load device_id on mount
  useEffect(() => {
    const initDeviceId = async () => {
      const id = await getOrCreateDeviceId();
      setDeviceId(id);
    };
    initDeviceId();
  }, []);

  // Fetch onboarding slides
  const { data: slidesResponse, isLoading: isSlidesLoading } = useMadbelGetOnboardingSlidesQuery();
  const apiSlides = slidesResponse?.data;

  // Fallback to local slides if API slides are empty or loading
  const slides = useMemo(() => {
    if (apiSlides && apiSlides.length > 0) {
      return apiSlides.map((slide) => ({
        ...slide,
        image: slide.image_url,
      }));
    }
    return featureSlides;
  }, [apiSlides]);

  // Fetch progress
  const {
    data: progressResponse,
    isSuccess: isProgressSuccess,
    isError: isProgressError,
    isLoading: isProgressLoading,
  } = useMadbelGetOnboardingProgressQuery(
    { device_id: deviceId },
    { skip: !deviceId }
  );

  const [saveProgress] = useMadbelSaveOnboardingProgressMutation();
  const [skipOnboarding] = useMadbelSkipOnboardingMutation();
  const [completeOnboarding] = useMadbelCompleteOnboardingMutation();

  // Fetch permissions
  const {
    data: permissionsResponse,
    isLoading: isPermissionsLoading,
  } = useMadbelGetPermissionsQuery(
    { device_id: deviceId },
    { skip: !deviceId || !showPermissionPage }
  );

  const [updatePermissions] = useMadbelUpdatePermissionsMutation();
  const [acceptAllPermissions] = useMadbelAcceptAllPermissionsMutation();

  // Initialize progress when response is ready
  useEffect(() => {
    if (isProgressSuccess && progressResponse?.data && !hasInitializedProgress) {
      const data = progressResponse.data;
      if (data.is_skipped) {
        navigation.navigate("Auth");
      } else if (data.is_completed) {
        setShowPermissionPage(true);
      } else {
        const savedStep = data.current_step || 0;
        if (savedStep >= 0 && savedStep < slides.length) {
          setSlideIndex(savedStep);
        }
      }
      setHasInitializedProgress(true);
    }
    if (isProgressError && !hasInitializedProgress) {
      setHasInitializedProgress(true);
    }
  }, [isProgressSuccess, isProgressError, progressResponse, slides.length, hasInitializedProgress]);

  // Sync permissions when response is ready
  const apiPermissions = permissionsResponse?.data?.permissions;
  const privacyTitle = permissionsResponse?.data?.privacy_message_title || "PRIVACY SECURED";
  const privacyBody = permissionsResponse?.data?.privacy_message_body || "Mabdel uses end-to-end encryption for all shared data.";

  useEffect(() => {
    if (apiPermissions && apiPermissions.length > 0) {
      const initialMap = {};
      apiPermissions.forEach((item) => {
        initialMap[item.key] = item.enabled;
      });
      setPermissions((prev) => ({ ...prev, ...initialMap }));
    }
  }, [apiPermissions]);

  const isProgressChecking = !deviceId || isProgressLoading;
  const isLastFeatureSlide = slideIndex === slides.length - 1;
  const currentSlide = slides[slideIndex];

  const dots = useMemo(
    () =>
      slides.map((slide, index) => (
        <View
          key={slide.id}
          style={[
            styles.dot,
            index === slideIndex ? styles.dotActive : styles.dotInactive,
          ]}
        />
      )),
    [slides, slideIndex]
  );

  const goNext = async () => {
    if (isLastFeatureSlide) {
      setShowPermissionPage(true);
      if (deviceId) {
        try {
          await completeOnboarding({ device_id: deviceId }).unwrap();
        } catch (error) {
        }
      }
      return;
    }
    const nextIndex = slideIndex + 1;
    setSlideIndex(nextIndex);
    if (deviceId) {
      try {
        await saveProgress({ device_id: deviceId, current_step: nextIndex }).unwrap();
      } catch (error) {
      }
    }
  };

  const goBack = () => {
    if (showPermissionPage) {
      setShowPermissionPage(false);
      return;
    }
    if (slideIndex > 0) {
      const prevIndex = slideIndex - 1;
      setSlideIndex(prevIndex);
      if (deviceId) {
        saveProgress({ device_id: deviceId, current_step: prevIndex }).catch((err) => {
        });
      }
      return;
    }
  };

  const handleSkip = async () => {
    if (deviceId) {
      try {
        await skipOnboarding({ device_id: deviceId }).unwrap();
      } catch (error) {
      }
    }
    navigation.navigate("Auth");
  };

  const togglePermission = async (key) => {
    const nextVal = !permissions[key];
    const newPermissions = { ...permissions, [key]: nextVal };
    setPermissions(newPermissions);

    if (deviceId) {
      try {
        await updatePermissions({
          device_id: deviceId,
          microphone_enabled: newPermissions.microphone ?? true,
          notifications_enabled: newPermissions.notifications ?? true,
          contacts_enabled: newPermissions.contacts ?? false,
        }).unwrap();
      } catch (error) {
      }
    }
  };

  const handleAcceptAll = async () => {
    if (deviceId) {
      try {
        await acceptAllPermissions({ device_id: deviceId }).unwrap();
      } catch (error) {
      }
    }
    navigation.navigate("Auth");
  };

  const renderTitle = (slide) => {
    if (!slide) return "";
    const title = slide.title;
    
    const highlightWord = slide.highlightedWord || (title.includes("AI Assistant") ? "AI Assistant" : null);
    
    if (highlightWord && title.includes(highlightWord)) {
      const parts = title.split(highlightWord);
      return (
        <>
          {parts[0]}
          <Text style={styles.titleAccent}>{highlightWord}</Text>
          {parts[1] || ""}
        </>
      );
    }
    return title;
  };

  const ctaButtonText = (currentSlide?.id === "assistant" || isLastFeatureSlide) ? "Get Started" : "Next";

  const fallbackPermissions = [
    {
      key: "microphone",
      title: "Microphone",
      description: "Enable voice commands and AI dictation for hands-free assistance.",
    },
    {
      key: "notifications",
      title: "Notifications",
      description: "Receive real-time updates on business insights and task completions.",
    },
    {
      key: "contacts",
      title: "Contacts",
      description: "Allow the assistant to help schedule meetings and manage client relations.",
    },
  ];

  const permissionItems = useMemo(() => {
    if (apiPermissions && apiPermissions.length > 0) {
      return apiPermissions;
    }
    return fallbackPermissions;
  }, [apiPermissions]);

  const getPermissionIcon = (key) => {
    switch (key) {
      case "microphone":
        return <Mic size={30} color={colors.accent} strokeWidth={2.3} />;
      case "notifications":
        return <Bell size={30} color={colors.accent} strokeWidth={2.3} />;
      case "contacts":
        return <IdCard size={30} color={colors.accent} strokeWidth={2.3} />;
      default:
        return <ShieldCheck size={30} color={colors.accent} strokeWidth={2.3} />;
    }
  };

  if (showPermissionPage) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <LinearGradient
          colors={["#02080B", "#010405"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.screen}
        >
          <View style={styles.topRow}>
            <Pressable onPress={goBack} hitSlop={12}>
              <ArrowLeft size={32} color={colors.textPrimary} strokeWidth={2.5} />
            </Pressable>
            {isPermissionsLoading && <ActivityIndicator size="small" color={colors.accent} />}
            <View style={styles.topRightSpacer} />
          </View>

          <ScrollView
            contentContainerStyle={styles.permissionScrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.permissionsTitle}>{t("permissions")}</Text>
            <Text style={styles.permissionsSubTitle}>{t("mabdel_ai_needs_access_to_some_features_to_provide")}</Text>

            {permissionItems.map((item) => (
              <PermissionCard
                key={item.key}
                title={item.title}
                description={item.description}
                icon={getPermissionIcon(item.key)}
                value={!!permissions[item.key]}
                onToggle={() => togglePermission(item.key)}
              />
            ))}

            <View style={styles.privacyCard}>
              <LinearGradient
                colors={["rgba(17,199,229,0.12)", "rgba(17,199,229,0.02)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.privacyCardFill}
              >
                <ShieldCheck size={42} color={colors.accent} strokeWidth={2.3} />
                <Text style={styles.privacyTitle}>{privacyTitle}</Text>
                <Text style={styles.privacyBody}>{privacyBody}</Text>
              </LinearGradient>
            </View>

            <Pressable
              style={styles.ctaButton}
              onPress={handleAcceptAll}
            >
              <Text style={styles.ctaText}>{t("accept_all")}</Text>
            </Pressable>
          </ScrollView>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={["#031218", "#02080B", "#010406"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.screen}
      >
        <View style={styles.topRow}>
          <Pressable onPress={goBack} hitSlop={12}>
            <ArrowLeft size={32} color={colors.textPrimary} strokeWidth={2.5} />
          </Pressable>
          {isSlidesLoading && <ActivityIndicator size="small" color={colors.accent} />}
          <Pressable onPress={handleSkip} hitSlop={12}>
            <Text style={styles.skipText}>{t("skip")}</Text>
          </Pressable>
        </View>

        <View style={styles.illustrationWrapper}>
          <FeatureIllustration source={currentSlide?.image} />
        </View>

        <View style={styles.textSection}>
          <Text style={styles.featureTitle}>
            {renderTitle(currentSlide)}
          </Text>
          <Text style={styles.featureDescription}>{currentSlide?.description}</Text>
        </View>

        <Pressable
          style={[styles.ctaButton, isProgressChecking && { opacity: 0.7 }]}
          onPress={goNext}
          disabled={isProgressChecking}
        >
          {isProgressChecking ? (
            <ActivityIndicator size="small" color={colors.textPrimary} />
          ) : (
            <View style={styles.ctaInline}>
              <Text style={styles.ctaText}>{ctaButtonText}</Text>
              <ChevronRight size={28} color={colors.textPrimary} strokeWidth={2.5} />
            </View>
          )}
        </Pressable>

        <View style={styles.dotsRow}>{dots}</View>
      </LinearGradient>
    </SafeAreaView>
  );
}

function PermissionCard({ title, description, icon, value, onToggle }) {
  return (
    <View style={styles.permissionCard}>
      <View style={styles.permissionIconBox}>{icon}</View>
      <View style={styles.permissionTextWrap}>
        <Text style={styles.permissionTitle}>{title}</Text>
        <Text style={styles.permissionDescription}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: colors.toggleOff, true: colors.accent }}
        thumbColor="#F5F6F8"
        ios_backgroundColor={colors.toggleOff}
      />
    </View>
  );
}

function FeatureIllustration({ source }) {
  const imageSource = typeof source === "string" ? { uri: source } : source;
  if (!imageSource) return null;
  return (
    <View style={styles.illuCanvas}>
      <Image source={imageSource} style={styles.featureImage} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  screen: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 22,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topRightSpacer: {
    width: 28,
    height: 28,
  },
  skipText: {
    color: colors.textPrimary,
    fontSize: 38 / 2,
    fontWeight: "700",
  },
  illustrationWrapper: {
    marginTop: 14,
    height: "40%",
    alignItems: "center",
    justifyContent: "center",
  },
  illuCanvas: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  featureImage: {
    width: "80%",
    height: "80%",
  },
  textSection: {
    alignItems: "center",
    gap: 18,
    marginTop: 10,
    minHeight: 190,
  },
  featureTitle: {
    color: colors.textPrimary,
    textAlign: "center",
    fontSize: 58 / 2,
    lineHeight: 68 / 2,
    fontWeight: "800",
  },
  titleAccent: {
    color: colors.accent,
  },
  featureDescription: {
    color: colors.textSecondary,
    textAlign: "center",
    fontSize: 28 / 2,
    lineHeight: 34 / 2,
    width: "94%",
  },
  ctaButton: {
    borderRadius: 22,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    height: 84,
    shadowColor: colors.accent,
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 7 },
    elevation: 8,
  },
  ctaInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  ctaText: {
    color: colors.textPrimary,
    fontSize: 34 / 2,
    fontWeight: "700",
  },
  dotsRow: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },
  dot: {
    height: 13,
    borderRadius: 9,
  },
  dotActive: {
    width: 44,
    backgroundColor: colors.accent,
  },
  dotInactive: {
    width: 13,
    backgroundColor: colors.mutedDot,
  },
  permissionScrollContent: {
    paddingTop: 8,
    paddingBottom: 20,
    gap: 14,
  },
  permissionsTitle: {
    color: colors.textPrimary,
    textAlign: "center",
    fontSize: 52 / 2,
    fontWeight: "800",
    marginTop: 10,
  },
  permissionsSubTitle: {
    color: colors.textSecondary,
    textAlign: "center",
    fontSize: 22 / 2,
    lineHeight: 32 / 2,
    marginBottom: 8,
    paddingHorizontal: 8,
  },
  permissionCard: {
    borderRadius: 26,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  permissionIconBox: {
    width: 74,
    height: 74,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(17,199,229,0.13)",
  },
  permissionTextWrap: {
    flex: 1,
    gap: 5,
  },
  permissionTitle: {
    color: colors.textPrimary,
    fontSize: 42 / 2,
    fontWeight: "800",
  },
  permissionDescription: {
    color: colors.textSecondary,
    fontSize: 17,
    lineHeight: 24,
  },
  privacyCard: {
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "rgba(17,199,229,0.22)",
    overflow: "hidden",
    marginTop: 3,
  },
  privacyCardFill: {
    paddingVertical: 38,
    paddingHorizontal: 16,
    alignItems: "center",
    gap: 10,
  },
  privacyTitle: {
    color: colors.accent,
    fontSize: 36 / 2,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  privacyBody: {
    color: colors.textSecondary,
    textAlign: "center",
    fontSize: 17,
    lineHeight: 25,
    width: "88%",
  },
});
