import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  Pressable,
  TextInput,
  ScrollView,
} from "react-native";
import { ArrowLeft, Sparkles, Mic, Reply, Forward } from "lucide-react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  responsiveHeight,
  responsiveWidth,
} from "react-native-responsive-dimensions";
import {
  useMadbelAiVoiceChatMutation,
  useMadbelAiWorkflowPrefillMutation,
} from "../../redux/slices/madbelApiSlice";
import { redirectFromVoiceResult } from "../../utils/voiceNavigation";
import { useAppLanguage } from "../../context/LanguageContext";

const getVoiceResultTranscript = (voiceResult) => {
  if (!voiceResult) return "";
  return (
    voiceResult.transcript ||
    voiceResult.user_message?.content ||
    voiceResult.content ||
    ""
  );
};

const getVoiceResultAiResponse = (voiceResult) => {
  if (!voiceResult) return "";
  return (
    voiceResult.ai_response ||
    voiceResult.ai_message?.content ||
    voiceResult.response ||
    ""
  );
};

const buildVoiceMessages = (voiceResult, t) => {
  if (!voiceResult) return [];

  const userText = getVoiceResultTranscript(voiceResult) || t("voice_command");
  const aiText = getVoiceResultAiResponse(voiceResult) || t("i_processed_that_request");
  const msgId = voiceResult.history_id || voiceResult.id || Date.now();

  return [
    {
      id: `voice-user-${msgId}`,
      role: "user",
      text: userText,
    },
    {
      id: `voice-ai-${msgId}`,
      role: "assistant",
      text: aiText,
      voiceResult,
    },
  ];
};

const MicConversationScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const tabBarHeight = useBottomTabBarHeight();
  const { t } = useAppLanguage();
  const {
    initialVoiceResult,
    autoRedirect = false,
    workflowIntent,
    currentValues,
  } = route.params || {};

  const activeVoiceResult = useMemo(() => {
    return (
      route.params?.voiceResult ||
      initialVoiceResult ||
      route.params?.params?.voiceResult
    );
  }, [route.params, initialVoiceResult]);

  const [inputText, setInputText] = useState("");
  const [messages, setMessages] = useState(() =>
    buildVoiceMessages(activeVoiceResult, t),
  );
  const [voiceChat, { isLoading }] = useMadbelAiVoiceChatMutation();
  const [workflowPrefill] = useMadbelAiWorkflowPrefillMutation();

  const redirectWithPrefill = useCallback(
    async (voiceResult) => {
      if (!voiceResult?.navigation?.should_redirect) return false;

      const intent = voiceResult?.workflow?.intent;
      const supportsPrefill = [
        "invoice",
        "bulk_message",
        "calendar",
        "lease",
        "agreement",
      ].includes(intent);

      if (!supportsPrefill) {
        return redirectFromVoiceResult(navigation, voiceResult);
      }

      try {
        const prefillResponse = await workflowPrefill({
          workflow_intent: intent,
          transcript: voiceResult.transcript,
        }).unwrap();
        const workflowPrefillData = prefillResponse?.data || prefillResponse;
        return redirectFromVoiceResult(navigation, {
          ...voiceResult,
          prefill: workflowPrefillData?.prefill,
          missing_fields: workflowPrefillData?.missing_fields,
          workflowPrefill: workflowPrefillData,
        });
      } catch {
        return redirectFromVoiceResult(navigation, voiceResult);
      }
    },
    [navigation, workflowPrefill],
  );

  useEffect(() => {
    if (!activeVoiceResult) return;

    const resultId = activeVoiceResult.history_id || getVoiceResultTranscript(activeVoiceResult);
    setMessages((prev) => {
      const alreadyAdded = prev.some(
        (m) =>
          m.id === `voice-ai-${resultId}` ||
          m.id === `voice-user-${resultId}` ||
          (m.role === "user" && m.text === getVoiceResultTranscript(activeVoiceResult)),
      );
      if (alreadyAdded) return prev;

      const newMsgs = buildVoiceMessages(activeVoiceResult, t);
      if (prev.length === 0 || (prev.length === 1 && prev[0].id === "empty-ai")) {
        return newMsgs;
      }
      return [...prev, ...newMsgs];
    });

    if (!autoRedirect) return;
    const timeout = setTimeout(() => {
      redirectWithPrefill(activeVoiceResult);
    }, 900);

    return () => clearTimeout(timeout);
  }, [autoRedirect, activeVoiceResult, redirectWithPrefill, t]);

  const displayMessages = useMemo(() => {
    if (messages.length > 0) return messages;

    return [
      {
        id: "empty-ai",
        role: "assistant",
        text: t("ask_mabdel_ai"),
      },
    ];
  }, [messages, t]);

  const sendPrompt = async () => {
    const transcript = inputText.trim();
    if (!transcript || isLoading) return;

    const userMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: transcript,
    };
    setMessages((prev) => [...prev, userMessage]);
    setInputText("");

    try {
      const response = await voiceChat({
        transcript,
        response_mode: "text",
        workflow_intent: workflowIntent,
        current_values:
          currentValues && typeof currentValues === "object" ? currentValues : {},
      }).unwrap();
      const voiceResult = response?.data || response;
      const assistantMessage = {
        id: `ai-${voiceResult?.history_id || Date.now()}`,
        role: "assistant",
        text: getVoiceResultAiResponse(voiceResult) || t("done"),
        voiceResult,
      };
      setMessages((prev) => [...prev, assistantMessage]);

      const isChatbotFallback = voiceResult?.navigation?.params?.chatbot_fallback;
      if (voiceResult?.navigation?.should_redirect && !isChatbotFallback) {
        setTimeout(() => redirectWithPrefill(voiceResult), 750);
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: "assistant",
          text: error?.data?.message || t("unable_to_process_command"),
        },
      ]);
    }
  };

  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current && messages.length > 0) {
      const timeout = setTimeout(() => {
        scrollRef.current?.scrollToEnd?.({ animated: true });
      }, 120);
      return () => clearTimeout(timeout);
    }
  }, [messages]);

  const backIconSize = responsiveWidth(7.2);
  const metaIconSize = responsiveWidth(4.8);
  const composerIconSize = responsiveWidth(5.3);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ArrowLeft size={backIconSize} color="#F4F8FF" strokeWidth={2.3} />
          </Pressable>
          <Text style={styles.title}>{t("mabdel_ai")}</Text>
          <View style={styles.rightSpacer} />
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.contentScroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd?.({ animated: true })}
        >
          {displayMessages.map((item) => {
            if (item.role === "user") {
              return (
                <View key={item.id} style={styles.userRow}>
                  <View style={styles.userBubble}>
                    <Text style={styles.userBubbleText}>{item.text}</Text>
                  </View>
                  <Text style={styles.readAt}>{t("sent")}</Text>
                </View>
              );
            }

            return (
              <View key={item.id} style={styles.assistantRow}>
                <View style={styles.assistantTagRow}>
                  <Sparkles size={metaIconSize} color="#11D4F0" strokeWidth={2.3} />
                  <Text style={styles.assistantTag}>
                    {item.voiceResult?.navigation?.should_redirect
                      && !item.voiceResult?.navigation?.params?.chatbot_fallback
                  ? t("ai_assistant_opening_workflow")
                      : t("ai_assistant_label")}
                  </Text>
                </View>

                <View style={styles.assistantBubble}>
                  <Text style={styles.assistantText}>{item.text}</Text>
                </View>

                <View style={styles.actionRow}>
                  <Pressable style={styles.actionPill}>
                    <Reply size={metaIconSize} color="#E5EDF9" strokeWidth={2.2} />
                    <Text style={styles.pillText}>{t("reply")}</Text>
                  </Pressable>
                  <Pressable style={styles.actionPill}>
                    <Forward size={metaIconSize} color="#E5EDF9" strokeWidth={2.2} />
                    <Text style={styles.pillText}>{t("forward")}</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}

          {isLoading ? (
            <View style={styles.assistantRow}>
              <View style={[styles.assistantTagRow, { marginTop: responsiveHeight(1.4) }]}>
                <Sparkles size={metaIconSize} color="#11D4F0" strokeWidth={2.3} />
                <Text style={styles.assistantTag}>{t("ai_thinking")}</Text>
              </View>

              <View style={styles.thinkingBubble}>
                <Text style={styles.thinkingDots}>...</Text>
              </View>
            </View>
          ) : null}
        </ScrollView>

        <View
          style={[
            styles.inputRow,
            { marginBottom: tabBarHeight + responsiveHeight(0.8) },
          ]}
        >
          <View style={styles.avatar} />
          <View style={styles.inputWrap}>
            <TextInput
              value={inputText}
              onChangeText={setInputText}
              placeholder={t("type_message")}
              placeholderTextColor="#92A0B7"
              style={styles.input}
            />
            <Pressable
              onPress={() => {
                const parentNav = navigation.getParent?.();
                if (parentNav) {
                  parentNav.navigate("Shop", { screen: "MicListening" });
                } else {
                  navigation.navigate("Shop", { screen: "MicListening" });
                }
              }}
              style={styles.inputIconBtn}
            >
              <Mic color="#91B0CC" size={composerIconSize} strokeWidth={2.3} />
            </Pressable>
            <Pressable
              style={[styles.sendBtn, (!inputText.trim() || isLoading) && styles.sendBtnDisabled]}
              onPress={sendPrompt}
              disabled={!inputText.trim() || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#031218" size="small" />
              ) : (
                <Text style={styles.sendText}>{t("send")}</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#010507",
  },
  screen: {
    flex: 1,
    backgroundColor: "#010507",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: responsiveWidth(3.8),
    paddingTop: responsiveHeight(0.8),
    paddingBottom: responsiveHeight(1),
  },
  backBtn: {
    width: responsiveWidth(11.2),
    height: responsiveWidth(11.2),
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    color: "#F2F7FF",
    fontSize: responsiveWidth(3.6),
    fontWeight: "700",
  },
  rightSpacer: {
    width: responsiveWidth(11.2),
  },
  contentScroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: responsiveWidth(4.8),
    paddingTop: responsiveHeight(1),
    paddingBottom: responsiveHeight(2.4),
  },
  userRow: {
    alignItems: "flex-end",
    marginTop: responsiveHeight(1.6),
    marginBottom: responsiveHeight(0.6),
  },
  assistantRow: {
    alignItems: "flex-start",
    marginTop: responsiveHeight(1.6),
    marginBottom: responsiveHeight(0.6),
  },
  assistantTagRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: responsiveWidth(1.6),
    marginBottom: responsiveHeight(1.2),
  },
  assistantTag: {
    color: "#526077",
    fontSize: responsiveWidth(2.35),
    fontWeight: "500",
    letterSpacing: 1,
  },
  assistantBubble: {
    alignSelf: "flex-start",
    maxWidth: "82%",
    backgroundColor: "#2A2C31",
    borderTopLeftRadius: responsiveWidth(1.2),
    borderTopRightRadius: responsiveWidth(4.8),
    borderBottomLeftRadius: responsiveWidth(4.8),
    borderBottomRightRadius: responsiveWidth(4.8),
    paddingHorizontal: responsiveWidth(4.8),
    paddingVertical: responsiveHeight(2),
    borderWidth: 1,
    borderColor: "#3A3E45",
  },
  assistantText: {
    color: "#E8EDF7",
    fontSize: responsiveWidth(2.7),
    lineHeight: responsiveHeight(2.45),
    fontWeight: "400",
  },
  actionRow: {
    flexDirection: "row",
    gap: responsiveWidth(2.7),
    marginTop: responsiveHeight(1.4),
    marginBottom: responsiveHeight(0.4),
  },
  actionPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: responsiveWidth(1.8),
    borderWidth: 1,
    borderColor: "#3F4753",
    borderRadius: responsiveWidth(5.3),
    paddingHorizontal: responsiveWidth(4),
    paddingVertical: responsiveHeight(0.9),
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  pillText: {
    color: "#EBF1FC",
    fontSize: responsiveWidth(2.2),
    fontWeight: "500",
  },
  userBubble: {
    alignSelf: "flex-end",
    maxWidth: "80%",
    backgroundColor: "#14CBE8",
    borderTopLeftRadius: responsiveWidth(4.8),
    borderTopRightRadius: responsiveWidth(4.8),
    borderBottomLeftRadius: responsiveWidth(4.8),
    borderBottomRightRadius: responsiveWidth(1.2),
    paddingHorizontal: responsiveWidth(4.3),
    paddingVertical: responsiveHeight(2),
  },
  userBubbleText: {
    color: "#09293C",
    fontSize: responsiveWidth(2.7),
    lineHeight: responsiveHeight(2.45),
    fontWeight: "500",
  },
  readAt: {
    color: "#7F8CA2",
    fontSize: responsiveWidth(2.1),
    fontWeight: "500",
    textAlign: "right",
    marginTop: responsiveHeight(0.6),
    marginRight: responsiveWidth(1),
  },
  thinkingBubble: {
    alignSelf: "flex-start",
    maxWidth: "50%",
    marginTop: responsiveHeight(0.8),
    backgroundColor: "#2F3339",
    borderTopLeftRadius: responsiveWidth(1.2),
    borderTopRightRadius: responsiveWidth(4.5),
    borderBottomLeftRadius: responsiveWidth(4.5),
    borderBottomRightRadius: responsiveWidth(4.5),
    paddingHorizontal: responsiveWidth(4.3),
    paddingVertical: responsiveHeight(1),
    borderWidth: 1,
    borderColor: "#414752",
  },
  thinkingDots: {
    color: "#AAB7C9",
    fontSize: responsiveWidth(2.9),
    letterSpacing: 4,
    fontWeight: "700",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: responsiveWidth(3.2),
    paddingVertical: responsiveHeight(1.4),
    borderTopWidth: 1,
    borderTopColor: "#122032",
    backgroundColor: "#05101B",
  },
  avatar: {
    width: responsiveWidth(12.8),
    height: responsiveWidth(12.8),
    borderRadius: responsiveWidth(6.4),
    backgroundColor: "#203648",
    marginRight: responsiveWidth(2.7),
    borderWidth: 1,
    borderColor: "#2A4158",
  },
  inputWrap: {
    flex: 1,
    backgroundColor: "#263A52",
    borderRadius: responsiveWidth(4.8),
    minHeight: responsiveHeight(7),
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: responsiveWidth(4.3),
    paddingRight: responsiveWidth(2.1),
  },
  input: {
    flex: 1,
    color: "#EAF2FF",
    fontSize: responsiveWidth(2.7),
    paddingRight: responsiveWidth(2.1),
  },
  inputIconBtn: {
    paddingHorizontal: responsiveWidth(1.8),
    paddingVertical: responsiveHeight(0.7),
    marginRight: responsiveWidth(1),
  },
  sendBtn: {
    backgroundColor: "#18C6E3",
    borderRadius: responsiveWidth(3.5),
    paddingHorizontal: responsiveWidth(4.8),
    paddingVertical: responsiveHeight(1.2),
    minWidth: responsiveWidth(16),
    alignItems: "center",
  },
  sendBtnDisabled: {
    opacity: 0.55,
  },
  sendText: {
    color: "#EAFAFF",
    fontSize: responsiveWidth(2.7),
    fontWeight: "700",
  },
});

export default MicConversationScreen;
