import { useAppLanguage } from "../../context/LanguageContext";
import React, { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
  Alert,
  Share,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  responsiveHeight,
  responsiveWidth,
} from "react-native-responsive-dimensions";
import {
  ArrowLeft,
  Image as ImageIcon,
  Mic,
  Smile,
  Sparkles,
  Clock3,
  Send,
  Share2,
} from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import SystemCalendarModal from "../../components/SystemCalendarModal";
import {
  useMadbelAiChatMutation,
  useMadbelCreateSocialPostMutation,
} from "../../redux/slices/madbelApiSlice";

const PLATFORMS = [
  { id: "facebook", label: "Facebook", emoji: "f", color: "#1877F2" },
  { id: "instagram", label: "Instagram", emoji: "◎", color: "#E1306C" },
  { id: "linkedin", label: "LinkedIn", emoji: "in", color: "#0A66C2" },
  { id: "x", label: "X Post", emoji: "𝕏", color: "#FFFFFF" },
  { id: "threads", label: "Threads", emoji: "@", color: "#FFFFFF" },
];

const CreatePostScreen = () => {
  const { t } = useAppLanguage();
  const navigation = useNavigation();
  const [prompt, setPrompt] = useState("");
  const [content, setContent] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState(["facebook", "linkedin"]);
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [scheduleDate, setScheduleDate] = useState(new Date().toISOString().slice(0, 10));

  // RTK Query Mutations
  const [aiChat, { isLoading: isGenerating }] = useMadbelAiChatMutation();
  const [createSocialPost, { isLoading: isPublishing }] = useMadbelCreateSocialPostMutation();

  const characterCount = useMemo(() => content.length, [content]);

  const togglePlatform = (id) => {
    setSelectedPlatforms((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      Alert.alert(t("empty_prompt"), t("please_enter_a_prompt_describing_your_post_idea"));
      return;
    }
    try {
      const response = await aiChat({
        content: prompt,
        response_mode: "text",
      }).unwrap();
      
      const generated = 
        response?.data?.ai_message?.content || 
        response?.ai_message?.content || 
        response?.data?.response || 
        response?.response || 
        (typeof response?.data === "string" ? response.data : "");
      if (generated) {
        setContent(generated);
      } else {
        Alert.alert(t("ai_error"), t("could_not_generate_content_please_try_again"));
      }
    } catch (error) {
      Alert.alert(t("ai_error"), error?.data?.message || t("something_went_wrong_during_generation"));
    }
  };

  const handlePublishNow = async () => {
    if (!content.trim()) {
      Alert.alert(t("empty_content"), t("please_generate_or_write_some_content_first"));
      return;
    }
    if (selectedPlatforms.length === 0) {
      Alert.alert(t("no_platform_selected"), t("please_select_at_least_one_platform_to_publish"));
      return;
    }

    try {
      const res = await createSocialPost({
        content,
        platforms: selectedPlatforms,
        media_url: null,
        scheduled_at: null,
      }).unwrap();

      const results = res?.data?.results || [];
      const failed = results.filter((r) => r.status === "failed" || r.status === "not_connected");
      const published = results.filter((r) => r.status === "published");

      if (published.length > 0 && failed.length === 0) {
        Alert.alert(t("published"), `${t("posted_to")} ${published.map((r) => r.platform).join(", ")}.`);
        navigation.goBack();
      } else if (published.length > 0) {
        const failedNames = failed.map((r) => `${r.platform}: ${r.error}`).join("\n");
        Alert.alert(
          t("partial_success"),
          `${t("published_to")} ${published.map((r) => r.platform).join(", ")}.\n\n${t("failed")}:\n${failedNames}`,
        );
        navigation.goBack();
      } else {
        const failedNames = failed.map((r) => `${r.platform}: ${r.error}`).join("\n");
        Alert.alert(t("publish_failed"), failedNames || t("could_not_publish_your_post"));
      }
    } catch (error) {
      Alert.alert(t("publish_failed"), error?.data?.message || t("could_not_publish_your_post"));
    }
  };

  const handleSchedulePost = async (dateStr) => {
    if (!content.trim()) {
      Alert.alert(t("empty_content"), t("please_generate_or_write_some_content_first"));
      return;
    }
    if (selectedPlatforms.length === 0) {
      Alert.alert(t("no_platform_selected"), t("please_select_at_least_one_platform"));
      return;
    }

    try {
      const scheduledIso = `${dateStr}T10:00:00.000Z`;
      await createSocialPost({
        content,
        platforms: selectedPlatforms,
        media_url: null,
        scheduled_at: scheduledIso,
      }).unwrap();

      Alert.alert(t("scheduled"), t("post_scheduled_for", { date: dateStr }));
      navigation.goBack();
    } catch (error) {
      Alert.alert(t("schedule_failed"), error?.data?.message || t("could_not_schedule_your_post"));
    }
  };

  const handleShare = async () => {
    if (!content.trim()) {
      Alert.alert(t("empty_content"), t("please_generate_or_write_some_content_first"));
      return;
    }
    try {
      await Share.share({
        message: content,
      });
    } catch (error) {
      Alert.alert(t("share_failed"), error.message);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ArrowLeft size={28} color="#FFFFFF" strokeWidth={2.2} />
          </Pressable>
          <Text style={styles.title}>{t("create_post_with_ai")}</Text>
          <View style={styles.headerSpace} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* AI Generator Card */}
          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <LinearGradient
                colors={["#8C5BFF", "#5B24FF"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.gradientWandWrap}
              >
                <Sparkles size={16} color="#FFFFFF" />
              </LinearGradient>
              <Text style={styles.cardTitle}>{t("generate_post_with_ai")}</Text>
            </View>
            <View style={styles.promptWrap}>
              <TextInput
                value={prompt}
                onChangeText={setPrompt}
                placeholder={t("describe_your_post_idea")}
                placeholderTextColor="#7E8DA5"
                style={styles.promptInput}
                multiline
              />
              <Pressable style={styles.micBtn}>
                <Mic size={20} color="#7E8DA5" />
              </Pressable>
            </View>

            <Pressable 
              style={[styles.generateBtn, !prompt.trim() && styles.generateBtnDisabled]}
              onPress={handleGenerate}
              disabled={isGenerating || !prompt.trim()}
            >
              <LinearGradient
                colors={prompt.trim() ? ["#8C5BFF", "#5B24FF"] : ["#222530", "#1A1C23"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.generateBtnGradient}
              >
                {isGenerating ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Sparkles size={16} color={prompt.trim() ? "#FFFFFF" : "#7E8DA5"} />
                    <Text style={[styles.generateBtnText, !prompt.trim() && { color: "#7E8DA5" }]}>{t("generate_post")}</Text>
                  </>
                )}
              </LinearGradient>
            </Pressable>
          </View>

          {/* Content Header & Counter */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t("content")}</Text>
            <Text style={styles.counterText}>{characterCount} {t("characters")}</Text>
          </View>

          {/* Content Editor Card */}
          <View style={styles.card}>
            <TextInput
              value={content}
              onChangeText={setContent}
              multiline
              textAlignVertical="top"
              style={styles.contentInput}
            />
            <View style={styles.contentActions}>
              <Pressable style={styles.pillBtn}>
                <ImageIcon size={16} color="#96A8C2" />
                <Text style={styles.pillText}>{t("media")}</Text>
              </Pressable>
              <Pressable style={styles.pillBtn}>
                <Smile size={16} color="#96A8C2" />
                <Text style={styles.pillText}>{t("emojis")}</Text>
              </Pressable>
            </View>
          </View>

          {/* Post to Platforms Grid */}
          <Text style={styles.sectionTitle}>{t("post_to_platforms")}</Text>
          <View style={styles.platformRow}>
            {PLATFORMS.map((platform) => {
              const selected = selectedPlatforms.includes(platform.id);
              return (
                <Pressable
                  key={platform.id}
                  style={[
                    styles.platformCard,
                    selected && styles.platformCardActive,
                  ]}
                  onPress={() => togglePlatform(platform.id)}
                >
                  <View
                    style={[
                      styles.platformIconWrap,
                      selected && { borderColor: "#00D2FF", borderWidth: 1 },
                    ]}
                  >
                    <Text style={[styles.platformIconText, { color: platform.color }]}>
                      {platform.emoji}
                    </Text>
                  </View>
                  <Text style={[styles.platformText, selected && styles.platformTextActive]}>
                    {platform.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        {/* Footer CTAs */}
        <View style={styles.footer}>
          <View style={styles.footerRow}>
            <Pressable style={styles.scheduleBtn} onPress={() => setCalendarVisible(true)}>
              <Clock3 size={18} color="#B8C8DA" />
              <Text style={styles.scheduleText}>{t("schedule")}</Text>
            </Pressable>
            <Pressable
              style={[styles.publishBtn, (isPublishing) && { opacity: 0.6 }]}
              onPress={handlePublishNow}
              disabled={isPublishing}
            >
              {isPublishing ? (
                <ActivityIndicator color="#B8C8DA" />
              ) : (
                <>
                  <Send size={18} color="#B8C8DA" />
                  <Text style={styles.publishText}>{t("publish_now")}</Text>
                </>
              )}
            </Pressable>
          </View>
          <Pressable style={styles.shareBtn} onPress={handleShare}>
            <Share2 size={20} color="#001C24" />
            <Text style={styles.shareText}>{t("share_to_social_media")}</Text>
          </Pressable>
        </View>
      </View>

      <SystemCalendarModal
        visible={calendarVisible}
        onClose={() => setCalendarVisible(false)}
        selectedDate={scheduleDate}
        onSelectDate={(date) => {
          setScheduleDate(date);
          handleSchedulePost(date);
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#000000" },
  container: { flex: 1, backgroundColor: "#000000", paddingHorizontal: responsiveWidth(4.5) },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: responsiveHeight(0.5),
    paddingBottom: responsiveHeight(1.5),
  },
  backBtn: { width: responsiveWidth(10), alignItems: "flex-start" },
  headerSpace: { width: responsiveWidth(10) },
  title: { color: "#FFFFFF", fontSize: responsiveWidth(5.2), fontWeight: "700" },
  scrollContent: { gap: responsiveHeight(1.8), paddingBottom: responsiveHeight(18) },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#1F222A",
    backgroundColor: "#121318",
    padding: responsiveWidth(4),
  },
  cardTitleRow: { flexDirection: "row", alignItems: "center", gap: responsiveWidth(2.5) },
  gradientWandWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: { color: "#FFFFFF", fontSize: responsiveWidth(4.5), fontWeight: "700" },
  promptWrap: {
    marginTop: responsiveHeight(1.5),
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#2B3447",
    backgroundColor: "#17181F",
    minHeight: responsiveHeight(8.5),
    paddingHorizontal: responsiveWidth(3.5),
    paddingVertical: responsiveHeight(1),
    flexDirection: "row",
    alignItems: "center",
    gap: responsiveWidth(2),
  },
  promptInput: { flex: 1, color: "#FFFFFF", fontSize: 15, minHeight: responsiveHeight(5), paddingVertical: 0 },
  micBtn: {
    padding: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  generateBtn: {
    marginTop: responsiveHeight(1.5),
    borderRadius: 12,
    overflow: "hidden",
  },
  generateBtnDisabled: {
    opacity: 0.6,
  },
  generateBtnGradient: {
    minHeight: responsiveHeight(5.5),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  generateBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { color: "#FFFFFF", fontSize: responsiveWidth(4.5), fontWeight: "600" },
  counterText: { color: "#7F8EA6", fontSize: responsiveWidth(3.5) },
  contentInput: { minHeight: responsiveHeight(16), color: "#FFFFFF", fontSize: 16, lineHeight: 26, paddingVertical: 0 },
  contentActions: { flexDirection: "row", gap: responsiveWidth(2.5), marginTop: responsiveHeight(1.5) },
  pillBtn: {
    minHeight: responsiveHeight(4.4),
    borderRadius: 999,
    backgroundColor: "#232939",
    paddingHorizontal: responsiveWidth(4.5),
    flexDirection: "row",
    alignItems: "center",
    gap: responsiveWidth(1.5),
  },
  pillText: { color: "#A3B2CA", fontSize: responsiveWidth(3.5) },
  smallGenerateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#171F2A",
    borderWidth: 1,
    borderColor: "rgba(0, 210, 255, 0.2)",
  },
  smallGenerateText: {
    color: "#00D2FF",
    fontSize: 13,
    fontWeight: "600",
  },
  mediaCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#1F222A",
    overflow: "hidden",
  },
  mediaImage: { width: "100%", height: responsiveHeight(20), backgroundColor: "#111" },
  platformRow: { flexDirection: "row", gap: responsiveWidth(2.5) },
  platformCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1F222A",
    backgroundColor: "#121318",
    alignItems: "center",
    paddingVertical: responsiveHeight(1.5),
    gap: responsiveHeight(0.8),
  },
  platformCardActive: { borderColor: "#00D2FF", backgroundColor: "#0C1F2B" },
  platformIconWrap: {
    width: responsiveWidth(11),
    height: responsiveWidth(11),
    borderRadius: responsiveWidth(5.5),
    backgroundColor: "#1A1B22",
    alignItems: "center",
    justifyContent: "center",
  },
  platformIconText: { fontSize: responsiveWidth(4.8), fontWeight: "700" },
  platformText: { color: "#8E9AA0", fontSize: responsiveWidth(3.4) },
  platformTextActive: { color: "#00D2FF" },
  previewTabRow: { flexDirection: "row", gap: responsiveWidth(6), borderBottomWidth: 1, borderBottomColor: "#1F222A" },
  previewTabBtn: { paddingBottom: responsiveHeight(1) },
  previewTabBtnActive: { borderBottomWidth: 2, borderBottomColor: "#00D2FF" },
  previewTabText: { color: "#7F8EA6", fontSize: responsiveWidth(4), fontWeight: "600" },
  previewTabActive: { color: "#00D2FF" },
  previewCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#1F222A",
    backgroundColor: "#121318",
    padding: responsiveWidth(4),
  },
  previewHeaderRow: { flexDirection: "row", alignItems: "center", gap: responsiveWidth(3) },
  previewAvatar: { width: 40, height: 40, borderRadius: 20 },
  previewHeaderInfo: { flex: 1 },
  previewTitle: { color: "#FFFFFF", fontSize: responsiveWidth(4.2), fontWeight: "700" },
  previewSubTitle: { color: "#7F8EA6", fontSize: responsiveWidth(3.2), marginTop: 2 },
  previewBody: { color: "#E2E8F0", fontSize: 14, lineHeight: 22, marginTop: responsiveHeight(1.5) },
  previewImage: {
    marginTop: responsiveHeight(1.5),
    width: "100%",
    height: responsiveHeight(22),
    borderRadius: 14,
    backgroundColor: "#000",
  },
  previewFooterActions: { flexDirection: "row", gap: responsiveWidth(6), marginTop: responsiveHeight(1.5), paddingTop: responsiveHeight(1), borderTopWidth: 1, borderTopColor: "#1F222A" },
  previewActionBtn: { padding: 4 },
  footer: {
    position: "absolute",
    left: responsiveWidth(4.5),
    right: responsiveWidth(4.5),
    bottom: responsiveHeight(2),
    gap: responsiveHeight(1.2),
  },
  footerRow: {
    flexDirection: "row",
    gap: responsiveWidth(3),
  },
  scheduleBtn: {
    flex: 1,
    minHeight: responsiveHeight(6.8),
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2D3647",
    backgroundColor: "#2A3040",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: responsiveWidth(2),
  },
  scheduleText: { color: "#B8C8DA", fontSize: responsiveWidth(4.2), fontWeight: "600" },
  publishBtn: {
    flex: 1,
    minHeight: responsiveHeight(6.8),
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2D3647",
    backgroundColor: "#2A3040",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: responsiveWidth(2),
  },
  publishText: { color: "#B8C8DA", fontSize: responsiveWidth(4.2), fontWeight: "600" },
  shareBtn: {
    minHeight: responsiveHeight(6.8),
    borderRadius: 16,
    backgroundColor: "#00D2FF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: responsiveWidth(2),
  },
  shareText: { color: "#001C24", fontSize: responsiveWidth(4.2), fontWeight: "700" },
});

export default CreatePostScreen;
