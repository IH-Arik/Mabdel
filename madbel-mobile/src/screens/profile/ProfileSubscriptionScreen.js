import { useAppLanguage } from "../../context/LanguageContext";
import React from "react";
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  responsiveHeight,
  responsiveWidth,
} from "react-native-responsive-dimensions";
import { useNavigation } from "@react-navigation/native";
import {
  ChevronLeft,
  CheckCircle2,
  ShieldCheck,
  CreditCard,
  BadgeCheck,
  AlertCircle,
} from "lucide-react-native";
import {
  useMadbelListSubscriptionPlansQuery,
  useMadbelGetCurrentSubscriptionQuery,
} from "../../redux/slices/madbelApiSlice";

const PLAN_DETAILS = {
  free: {
    name: "Free (Starter)",
    description: "Personal use & startups",
    priceDisplay: "$0",
    periodDisplay: "forever",
    checkedFeatures: [
      "A voice assistant (unlimited use)",
      "Text AI responses",
      "Answer basic phone calls",
      "Limited SME emails",
      "10 languages support",
      "Male + female AI voices",
      "A web search + summaries",
    ],
    bulletFeatures: [
      "30 voice interactions / month",
      "10 SMS / month",
      "10 emails / month",
      "10 social media messages",
      "Discord, Slack, Pro Teams integration",
    ],
  },
  pro: {
    name: "Basic (Personal Productivity)",
    description: "For professionals who want AI to assist daily work.",
    priceDisplay: "$19.99",
    periodDisplay: "Monthly",
    checkedFeatures: [
      "Everything in Free, plus:",
      "Unlimited text AI interactions",
      "AI-generated emails & SMS",
      "All voice models",
      "Personal contacts list",
      "Schedule simple meetings",
      "Calendar sync",
    ],
    bulletFeatures: [
      "5 voice routing calls / day only",
      "No teams workflows",
      "Basic search reasoning",
    ],
  },
  business: {
    name: "Pro (Small Teams / Business)",
    description: "Scale your enterprise",
    priceDisplay: "$99",
    periodDisplay: "Monthly",
    checkedFeatures: [
      "Everything in Basic, plus:",
      "AI schedule meetings (Teams + Google + Outlook)",
      "Meeting start notifications",
      "Bulk SMS campaigns",
      "Bulk professional emails",
      "Multi-user contact sharing",
      "Advanced AI call handling",
      "Analytics dashboard",
    ],
    bulletFeatures: [
      "Unlimited voice calls",
      "CRM integration tools",
      "Unlimited AI assistants / agents",
    ],
  },
};

const ProfileSubscriptionScreen = () => {
  const { t } = useAppLanguage();
  const navigation = useNavigation();

  const {
    data: plansResponse,
    isLoading: isPlansLoading,
    isError: isPlansError,
    refetch: refetchPlans,
  } = useMadbelListSubscriptionPlansQuery();

  const {
    data: currentSubResponse,
    isLoading: isSubLoading,
    isError: isSubError,
    refetch: refetchSub,
  } = useMadbelGetCurrentSubscriptionQuery();

  const plans = plansResponse?.data?.items || [];
  const currentPlanCode = currentSubResponse?.data?.plan?.code || "free";

  const handleRefetch = () => {
    refetchPlans();
    refetchSub();
  };

  const getPriceText = (priceCents) => {
    if (priceCents === 0) return "$0";
    return `$${(priceCents / 100).toFixed(0)}`;
  };

  const capitalize = (str) => {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  const handleUpgrade = (plan) => {
    Alert.alert(
      "Upgrade Plan",
      `Would you like to upgrade to the ${plan.name || plan.code} plan?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Upgrade",
          onPress: () => {
            Alert.alert(t("request_sent"), t("processing_subscription_update_via_app_store"));
          },
        },
      ]
    );
  };

  const renderContent = () => {
    if (isPlansLoading || isSubLoading) {
      return (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color="#00D2FF" />
          <Text style={styles.stateText}>{t("loading_subscription_plans")}</Text>
        </View>
      );
    }

    if (isPlansError || isSubError) {
      return (
        <View style={styles.centerState}>
          <AlertCircle size={48} color="#FF6B6B" />
          <Text style={styles.stateText}>{t("failed_to_load_subscription_details")}</Text>
          <Pressable style={styles.retryBtn} onPress={handleRefetch}>
            <Text style={styles.retryText}>{t("retry")}</Text>
          </Pressable>
        </View>
      );
    }

    // Order plans so 'free' is first, then 'pro' (Basic), then 'business' (Pro)
    const sortedPlans = [...plans].sort((a, b) => {
      const order = { free: 1, pro: 2, business: 3 };
      return (order[a.code] || 99) - (order[b.code] || 99);
    });

    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.topWrap}>
          <Text style={styles.screenTitle}>{t("choose_your_plan")}</Text>
          <Text style={styles.screenSubTitle}>{t("empower_your_business_with_mabdel_ai")}</Text>
        </View>

        {sortedPlans.map((plan) => {
          const isCurrent = plan.code === currentPlanCode;
          const ctaText = isCurrent ? "CURRENT PLAN" : "UPGRADE NOW";

          // Resolve details from PLAN_DETAILS helper or fallback to API values
          const details = PLAN_DETAILS[plan.code] || {
            name: plan.name,
            description: plan.description,
            priceDisplay: getPriceText(plan.price_cents),
            periodDisplay: capitalize(plan.billing_interval),
            checkedFeatures: plan.features || [],
            bulletFeatures: [],
          };

          return (
            <View key={plan.code} style={styles.planCard}>
              <View style={styles.planHeaderRow}>
                <View style={styles.planTitleWrap}>
                  <Text style={styles.planTitle}>{details.name}</Text>
                  <Text style={styles.planSubtitle}>{details.description}</Text>
                </View>

                <View style={styles.priceWrap}>
                  <Text style={styles.planPrice}>{details.priceDisplay}</Text>
                  <Text style={styles.planPeriod}>{details.periodDisplay}</Text>
                </View>
              </View>

              <View style={styles.featuresWrap}>
                {details.checkedFeatures.map((feature, idx) => (
                  <View key={`check-${idx}`} style={styles.featureRow}>
                    <CheckCircle2 size={16} color="#00D2FF" strokeWidth={2.5} />
                    <Text style={styles.featureText}>{feature}</Text>
                  </View>
                ))}

                {details.bulletFeatures.map((feature, idx) => (
                  <View key={`bullet-${idx}`} style={styles.bulletRow}>
                    <Text style={styles.bulletDot}>{t("")}</Text>
                    <Text style={styles.bulletText}>{feature}</Text>
                  </View>
                ))}
              </View>

              <Pressable
                style={[
                  styles.planButton,
                  isCurrent ? styles.planButtonDisabled : styles.planButtonActive,
                ]}
                disabled={isCurrent}
                onPress={() => handleUpgrade(plan)}
              >
                <Text
                  style={[
                    styles.planButtonText,
                    isCurrent
                      ? styles.planButtonTextDisabled
                      : styles.planButtonTextActive,
                  ]}
                >
                  {ctaText}
                </Text>
              </Pressable>
            </View>
          );
        })}

        <View style={styles.footerWrap}>
          <View style={styles.footerIconsRow}>
            <ShieldCheck size={18} color="#8E9AA0" />
            <CreditCard size={18} color="#8E9AA0" />
            <BadgeCheck size={18} color="#8E9AA0" />
          </View>
          <Text style={styles.footerText}>{t("payments_are_secure_and_encrypted_cancel_anytime_f")}</Text>
        </View>
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.headerIconWrap} onPress={() => navigation.goBack()}>
            <ChevronLeft size={30} color="#F8FAFC" strokeWidth={2.3} />
          </Pressable>
          <Text style={styles.headerTitle}>{t("subscription_plans")}</Text>
          <View style={styles.headerSpacer} />
        </View>

        {renderContent()}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#000000",
  },
  container: {
    flex: 1,
    paddingHorizontal: responsiveWidth(4.2),
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: responsiveHeight(1.5),
  },
  headerIconWrap: {
    width: responsiveWidth(8),
  },
  headerTitle: {
    color: "#F8FAFC",
    fontSize: 18,
    fontWeight: "700",
  },
  headerSpacer: {
    width: responsiveWidth(8),
  },
  scrollContent: {
    gap: responsiveHeight(1.5),
    paddingBottom: responsiveHeight(4),
  },
  topWrap: {
    marginBottom: responsiveHeight(1),
    alignItems: "center",
    marginTop: responsiveHeight(1.5),
  },
  screenTitle: {
    color: "#F8FAFC",
    fontSize: 32,
    fontWeight: "800",
  },
  screenSubTitle: {
    marginTop: 6,
    color: "#00D2FF",
    fontSize: 14,
    fontWeight: "600",
  },
  planCard: {
    borderRadius: 20,
    backgroundColor: "#11131A",
    borderWidth: 1,
    borderColor: "#1F2433",
    paddingHorizontal: 20,
    paddingVertical: 20,
    shadowColor: "#00D2FF",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 10,
    elevation: 4,
  },
  planHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  planTitleWrap: {
    flex: 1,
  },
  planTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "700",
    lineHeight: 28,
  },
  planSubtitle: {
    color: "#8E9AA0",
    fontSize: 13,
    fontWeight: "400",
    marginTop: 4,
  },
  priceWrap: {
    alignItems: "flex-end",
  },
  planPrice: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "700",
    lineHeight: 36,
  },
  planPeriod: {
    color: "#8E9AA0",
    fontSize: 13,
    fontWeight: "400",
    marginTop: 2,
  },
  featuresWrap: {
    marginTop: 18,
    gap: 8,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  featureText: {
    flex: 1,
    color: "#E2E8F0",
    fontSize: 13.5,
    lineHeight: 18,
    fontWeight: "500",
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingLeft: 12,
  },
  bulletDot: {
    color: "#8E9AA0",
    fontSize: 14,
    lineHeight: 16,
  },
  bulletText: {
    flex: 1,
    color: "#8E9AA0",
    fontSize: 13,
    lineHeight: 18,
  },
  planButton: {
    marginTop: 20,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  planButtonDisabled: {
    backgroundColor: "#1E2330",
  },
  planButtonActive: {
    backgroundColor: "#00D2FF",
    shadowColor: "#00D2FF",
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 10,
    elevation: 4,
  },
  planButtonText: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  planButtonTextDisabled: {
    color: "#8E9AA0",
  },
  planButtonTextActive: {
    color: "#FFFFFF",
  },
  footerWrap: {
    alignItems: "center",
    paddingHorizontal: 12,
    marginTop: 16,
  },
  footerIconsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
    marginBottom: 8,
  },
  footerText: {
    color: "#8E9AA0",
    fontSize: 10.5,
    lineHeight: 16,
    textAlign: "center",
  },
  centerState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 20,
  },
  stateText: {
    color: "#8E9AA0",
    fontSize: 16,
    textAlign: "center",
  },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#00D2FF",
    marginTop: 8,
  },
  retryText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
});

export default ProfileSubscriptionScreen;
