import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { useDispatch } from "react-redux";
import {
  Crown,
  Zap,
  CheckCircle2,
  Mic,
  Mail,
  MessageSquare,
  Users,
  BarChart3,
} from "lucide-react-native";
import {
  useMadbelStartTrialMutation,
  useMadbelActivateSubscriptionMutation,
} from "../../redux/slices/madbelApiSlice";
import { useLazyMadbelMeQuery } from "../../redux/slices/madbelApiSlice";
import { setCredentials } from "../../redux/reducers/authReducer";

const FEATURES = [
  { icon: Mic,            label: "Unlimited AI voice assistant" },
  { icon: Mail,           label: "AI-generated emails & SMS" },
  { icon: MessageSquare,  label: "Bulk messaging campaigns" },
  { icon: Users,          label: "Team management & permissions" },
  { icon: BarChart3,      label: "Analytics dashboard" },
];

const colors = {
  bg: "#02080B",
  card: "#0D1E27",
  cardBorder: "#1A2E3B",
  textPrimary: "#F3F6F8",
  textSecondary: "#8FA3AE",
  accent: "#14C6E4",
  accentDim: "rgba(20,198,228,0.10)",
  accentBorder: "rgba(20,198,228,0.22)",
  gold: "#F0B429",
  goldDim: "rgba(240,180,41,0.12)",
  goldBorder: "rgba(240,180,41,0.25)",
};

export default function SubscriptionTrialScreen() {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(null); // "subscription" | "trial"

  const [startTrial] = useMadbelStartTrialMutation();
  const [activateSubscription] = useMadbelActivateSubscriptionMutation();
  const [fetchMe] = useLazyMadbelMeQuery();

  const goHome = () => {
    navigation.reset({ index: 0, routes: [{ name: "BottomNavigator" }] });
  };

  const refreshUserAndGoHome = async () => {
    try {
      const result = await fetchMe().unwrap();
      const user = result?.data || result;
      if (user) {
        dispatch(setCredentials({ user }));
      }
    } catch (_) {}
    goHome();
  };

  const handleSubscription = async () => {
    setLoading("subscription");
    try {
      await activateSubscription().unwrap();
      await refreshUserAndGoHome();
    } catch (err) {
      Alert.alert(
        "Subscription",
        err?.data?.message || "Subscription activation failed. Please try again."
      );
    } finally {
      setLoading(null);
    }
  };

  const handleTrial = async () => {
    setLoading("trial");
    try {
      await startTrial().unwrap();
      await refreshUserAndGoHome();
    } catch (err) {
      Alert.alert(
        "Trial",
        err?.data?.message || "Could not start trial. Please try again."
      );
    } finally {
      setLoading(null);
    }
  };

  const isAnyLoading = loading !== null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={["#031218", "#02080B", "#010406"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.screen}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.heroWrap}>
            <Text style={styles.headline}>
              Choose Your{"\n"}<Text style={styles.headlineAccent}>Access Level</Text>
            </Text>
            <Text style={styles.subline}>
              Unlock Mabdel AI's full power and get started as an Owner.
            </Text>
          </View>

          {/* Features list */}
          <View style={styles.featureCard}>
            <Text style={styles.featureCardTitle}>Owner Features Include</Text>
            {FEATURES.map(({ icon: Icon, label }, idx) => (
              <View
                key={idx}
                style={[
                  styles.featureRow,
                  idx < FEATURES.length - 1 && styles.featureRowBorder,
                ]}
              >
                <View style={styles.featureIconBox}>
                  <Icon size={16} color={colors.accent} strokeWidth={2.3} />
                </View>
                <Text style={styles.featureLabel}>{label}</Text>
                <CheckCircle2 size={15} color={colors.accent} strokeWidth={2.5} />
              </View>
            ))}
          </View>

          {/* Button 1 — Subscription */}
          <Pressable
            style={[styles.btn, styles.btnSubscription, isAnyLoading && styles.btnDisabled]}
            onPress={handleSubscription}
            disabled={isAnyLoading}
          >
            <LinearGradient
              colors={["#F0B429", "#D49A1A"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.btnGradient}
            >
              {loading === "subscription" ? (
                <ActivityIndicator color="#02080B" size={20} />
              ) : (
                <>
                  <Crown size={20} color="#02080B" strokeWidth={2.5} />
                  <View style={styles.btnTextWrap}>
                    <Text style={[styles.btnTitle, { color: "#02080B" }]}>Subscription</Text>
                    <Text style={[styles.btnSub, { color: "rgba(2,8,11,0.65)" }]}>
                      Full access as Owner
                    </Text>
                  </View>
                </>
              )}
            </LinearGradient>
          </Pressable>

          {/* Button 2 — 7 Day Trial */}
          <Pressable
            style={[styles.btn, isAnyLoading && styles.btnDisabled]}
            onPress={handleTrial}
            disabled={isAnyLoading}
          >
            <LinearGradient
              colors={["#1AD3EF", "#0DAFC9"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.btnGradient}
            >
              {loading === "trial" ? (
                <ActivityIndicator color="#02080B" size={20} />
              ) : (
                <>
                  <Zap size={20} color="#02080B" strokeWidth={2.5} />
                  <View style={styles.btnTextWrap}>
                    <Text style={[styles.btnTitle, { color: "#02080B" }]}>7 Day Trial as Owner</Text>
                    <Text style={[styles.btnSub, { color: "rgba(2,8,11,0.65)" }]}>
                      Free · No credit card needed
                    </Text>
                  </View>
                </>
              )}
            </LinearGradient>
          </Pressable>

        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  screen: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: 22,
    paddingTop: 40,
    paddingBottom: 44,
    gap: 14,
  },
  heroWrap: {
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  headline: {
    color: colors.textPrimary,
    fontSize: 32,
    fontWeight: "800",
    textAlign: "center",
    lineHeight: 40,
  },
  headlineAccent: {
    color: colors.accent,
  },
  subline: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    maxWidth: 300,
  },
  featureCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
    overflow: "hidden",
    marginBottom: 4,
  },
  featureCardTitle: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 10,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  featureRowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  featureIconBox: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: colors.accentDim,
    alignItems: "center",
    justifyContent: "center",
  },
  featureLabel: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 13.5,
    fontWeight: "500",
  },
  btn: {
    borderRadius: 18,
    overflow: "hidden",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
    shadowColor: colors.accent,
  },
  btnSubscription: {
    shadowColor: colors.gold,
  },
  btnDisabled: {
    opacity: 0.55,
  },
  btnGradient: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  btnTextWrap: {
    flex: 1,
    gap: 2,
  },
  btnTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#02080B",
  },
  btnSub: {
    fontSize: 12,
    fontWeight: "500",
    color: "rgba(2,8,11,0.65)",
  },
});
