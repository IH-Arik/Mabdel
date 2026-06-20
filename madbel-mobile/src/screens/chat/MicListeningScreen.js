import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { ArrowLeft, Mic } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import {
  responsiveHeight,
  responsiveWidth,
} from "react-native-responsive-dimensions";
import {
  useMadbelAiChatMutation,
  useMadbelAiVoiceChatUploadMutation,
  useMadbelAiWorkflowPrefillMutation,
} from "../../redux/slices/madbelApiSlice";
import { redirectFromVoiceResult } from "../../utils/voiceNavigation";

const actionChips = [
  "Create Invoice",
  "Send Bulk Message",
  "Schedule Meeting",
  "New Agreement",
];

const buildWorkflowPrefillBody = (transcript) => ({
  transcript,
  audio_url: "",
  audio_base64: "",
  audio_mime_type: "audio/wav",
  audio_filename: "voice.wav",
  response_mode: "both",
  voice_id: "",
  workflow_intent: "",
  current_values: {},
});

const formatJson = (value) => {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const getGeneratedTextFromWorkflow = (responsePayload = {}) => {
  const payload = responsePayload?.data || responsePayload || {};
  const candidates = [
    payload?.generated_text,
    payload?.transcript,
    payload?.prompt,
    payload?.content,
    payload?.ai_response,
    payload?.response,
    payload?.prefill_prompt,
    payload?.workflow?.prompt,
  ];

  const generated = candidates.find(
    (value) => typeof value === "string" && value.trim().length > 0,
  );

  return generated ? generated.trim() : "";
};

const MicListeningScreen = () => {
  const navigation = useNavigation();
  const pulse = useRef(new Animated.Value(0)).current;
  const redirectTimeoutRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const [transcribedText, setTranscribedText] = useState("");
  const [typedPrompt, setTypedPrompt] = useState("");
  const [statusText, setStatusText] = useState("Preparing microphone...");
  const [errorText, setErrorText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [workflowJsonResponse, setWorkflowJsonResponse] = useState("");
  const [workflowPrefill] = useMadbelAiWorkflowPrefillMutation();
  const [aiChat] = useMadbelAiChatMutation();
  const [aiVoiceChatUpload] = useMadbelAiVoiceChatUploadMutation();

  useSpeechRecognitionEvent("result", (event) => {
    const text = event.results[0]?.transcript;
    if (text) {
      setTranscribedText(text);
      setTypedPrompt(text); // auto-fill the text input for visibility
    }
  });

  useSpeechRecognitionEvent("end", () => {
    setIsRecording(false);
  });

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1400,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1400,
          useNativeDriver: true,
        }),
      ]),
    );

    loop.start();
    return () => loop.stop();
  }, [pulse]);

  useEffect(
    () => () => {
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
      }
    },
    [],
  );

  const startRecording = useCallback(async () => {
    if (redirectTimeoutRef.current) {
      clearTimeout(redirectTimeoutRef.current);
      redirectTimeoutRef.current = null;
    }

    setErrorText("");
    setTranscribedText("");
    setTypedPrompt("");
    setWorkflowJsonResponse("");
    try {
      const { granted } =
        await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!granted) {
        throw new Error("Speech recognition permissions not granted");
      }

      ExpoSpeechRecognitionModule.start({
        lang: "en-US",
        interimResults: true,
        maxAlternatives: 1,
      });

      setIsRecording(true);
      setStatusText("Listening...");
    } catch (error) {
      setStatusText("Microphone unavailable");
      setErrorText(error?.message || "Unable to start voice recording.");
    }
  }, []);

  useEffect(() => {
    startRecording();
    return () => {
      ExpoSpeechRecognitionModule.stop();
    };
  }, [startRecording]);

  const submitWorkflowPrefill = useCallback(
    async (rawTranscript) => {
      const transcript = rawTranscript.trim();
      const requestBody = buildWorkflowPrefillBody(transcript);

      const workflowResponse = await workflowPrefill(requestBody).unwrap();
      const workflowPayload = workflowResponse?.data || workflowResponse || {};

      const generatedText = getGeneratedTextFromWorkflow(workflowPayload);
      let finalResult = workflowPayload;

      if (generatedText) {
        setStatusText("Processing AI chat...");
        const chatResponse = await aiChat({
          content: generatedText,
          response_mode: "text",
          voice_id: null,
        }).unwrap();
        finalResult = chatResponse?.data || chatResponse || workflowPayload;
      } else {
        setStatusText("No text found. Uploading voice...");
        const uploadResponse = await aiVoiceChatUpload({
          transcript,
          audio_url: "",
          audio_base64: "",
          audio_mime_type: "audio/wav",
          audio_filename: "voice.wav",
          response_mode: "both",
          voice_id: "",
          workflow_intent: "",
        }).unwrap();
        finalResult = uploadResponse?.data || uploadResponse || workflowPayload;
      }

      setWorkflowJsonResponse(
        formatJson({
          workflow_prefill: workflowPayload,
          ai_result: finalResult,
        }),
      );
      setStatusText("Workflow response received");

      if (finalResult?.navigation?.path || finalResult?.navigation?.screen) {
        redirectTimeoutRef.current = setTimeout(() => {
          redirectFromVoiceResult(navigation, finalResult);
          redirectTimeoutRef.current = null;
        }, 800);
      }
    },
    [aiChat, aiVoiceChatUpload, navigation, workflowPrefill],
  );

  const stopAndProcessRecording = useCallback(async () => {
    if (isProcessing) return;

    try {
      setIsProcessing(true);
      setErrorText("");
      setWorkflowJsonResponse("");
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
        redirectTimeoutRef.current = null;
      }
      setStatusText("Processing...");

      if (isRecording) {
        ExpoSpeechRecognitionModule.stop();
        setIsRecording(false);
      }

      const finalTranscript = (transcribedText || typedPrompt).trim();
      await submitWorkflowPrefill(finalTranscript);
    } catch (error) {
      setWorkflowJsonResponse(formatJson(error?.data || error));
      setErrorText(
        error?.data?.message || "Voice command failed. Please try again.",
      );
      setStatusText("Listening stopped");
    } finally {
      setIsProcessing(false);
    }
  }, [
    isProcessing,
    isRecording,
    transcribedText,
    typedPrompt,
    submitWorkflowPrefill,
  ]);

  const sendTypedPrompt = useCallback(
    async (promptOverride) => {
      const transcript =
        typeof promptOverride === "string"
          ? promptOverride.trim()
          : typedPrompt.trim();
      if (!transcript || isProcessing) return;

      setIsProcessing(true);
      setStatusText("Processing...");
      setErrorText("");
      setWorkflowJsonResponse("");
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
        redirectTimeoutRef.current = null;
      }

      try {
        if (isRecording) {
          ExpoSpeechRecognitionModule.stop();
          setIsRecording(false);
        }

        await submitWorkflowPrefill(transcript);
        setTypedPrompt("");
      } catch (error) {
        setWorkflowJsonResponse(formatJson(error?.data || error));
        setErrorText(error?.data?.message || "Unable to process that command.");
        setStatusText("Listening stopped");
      } finally {
        setIsProcessing(false);
      }
    },
    [isProcessing, isRecording, typedPrompt, submitWorkflowPrefill],
  );

  const ringOneScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.08],
  });

  const ringTwoScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.16],
  });

  const tabBarHeight = useBottomTabBarHeight();
  const iconSize = responsiveWidth(7.7);
  const micCenterIcon = responsiveWidth(13.3);
  const composerIcon = responsiveWidth(5.3);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ArrowLeft size={iconSize} color="#F4F8FF" strokeWidth={2.3} />
          </Pressable>
          <Text style={styles.title}>Mabdel AI</Text>
          <View style={styles.rightSpacer} />
        </View>

        <Text style={styles.listening}>{statusText}</Text>

        <View
          style={[
            styles.orbArea,
            workflowJsonResponse ? styles.orbAreaWithResponse : null,
          ]}
        >
          <LinearGradient
            colors={["rgba(18,199,228,0.34)", "rgba(18,199,228,0)"]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.orbGlow}
          />

          <Animated.View
            style={[
              styles.ring,
              styles.outerRing,
              {
                transform: [{ scale: ringTwoScale }],
                opacity: pulse.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.5, 0.9],
                }),
              },
            ]}
          />
          <Animated.View
            style={[
              styles.ring,
              styles.innerRing,
              {
                transform: [{ scale: ringOneScale }],
                opacity: pulse.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.6, 1],
                }),
              },
            ]}
          />

          <Pressable
            onPress={stopAndProcessRecording}
            disabled={isProcessing}
            style={styles.micButton}
          >
            <LinearGradient
              colors={["#1CD3EF", "#16BCD9"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.micCore}
            >
              {isProcessing ? (
                <ActivityIndicator color="#EAF9FF" size="large" />
              ) : (
                <Mic color="#EAF9FF" size={micCenterIcon} strokeWidth={2.7} />
              )}
            </LinearGradient>
          </Pressable>

          <View style={[styles.floatDot, styles.dotOne]} />
          <View style={[styles.floatDot, styles.dotTwo]} />
          <View style={[styles.floatDot, styles.dotThree]} />
        </View>

        <Text style={styles.processing}>
          {isProcessing
            ? "PROCESSING"
            : isRecording
              ? "TAP MIC TO FINISH"
              : "READY"}
        </Text>
        {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}
        {workflowJsonResponse ? (
          <View style={styles.responseCard}>
            <Text style={styles.responseTitle}>JSON Response</Text>
            <ScrollView
              style={styles.responseScroll}
              contentContainerStyle={styles.responseContent}
              nestedScrollEnabled
              showsVerticalScrollIndicator
            >
              <Text selectable style={styles.responseJson}>
                {workflowJsonResponse}
              </Text>
            </ScrollView>
          </View>
        ) : null}

        <View style={styles.bottomArea}>
          <View
            style={[
              styles.inputRow,
              {
                marginBottom: Math.max(
                  tabBarHeight - responsiveHeight(2.5),
                  responsiveHeight(1.2),
                ),
              },
            ]}
          >
            <View style={styles.avatar} />
            <View style={styles.inputWrap}>
              <TextInput
                value={typedPrompt}
                onChangeText={setTypedPrompt}
                placeholder="Type a message..."
                placeholderTextColor="#92A0B7"
                style={styles.input}
              />
              <Pressable onPress={startRecording} style={styles.inputIconBtn}>
                <Mic color="#91B0CC" size={composerIcon} strokeWidth={2.3} />
              </Pressable>
              <Pressable
                style={styles.sendBtn}
                onPress={() => sendTypedPrompt()}
                disabled={isProcessing || !typedPrompt.trim()}
              >
                <Text style={styles.sendText}>Send</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.chipRow}>
            {actionChips.map((chip) => (
              <Pressable
                key={chip}
                style={styles.chip}
                onPress={() => sendTypedPrompt(chip)}
              >
                <Text style={styles.chipText}>{chip}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#010507" },
  screen: { flex: 1, backgroundColor: "#010507" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: responsiveWidth(3.7),
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
  rightSpacer: { width: responsiveWidth(11.2) },
  listening: {
    color: "#F3F8FF",
    fontSize: responsiveWidth(7.7),
    fontWeight: "700",
    textAlign: "center",
    marginTop: responsiveHeight(3.4),
  },
  orbArea: {
    height: responsiveHeight(47),
    justifyContent: "center",
    alignItems: "center",
    marginTop: responsiveHeight(1),
  },
  orbAreaWithResponse: {
    height: responsiveHeight(30),
    marginTop: 0,
  },
  orbGlow: {
    position: "absolute",
    width: responsiveWidth(92),
    height: responsiveWidth(92),
    borderRadius: responsiveWidth(46),
  },
  ring: {
    position: "absolute",
    borderWidth: 2,
    borderColor: "rgba(34,194,224,0.38)",
    borderRadius: 999,
  },
  innerRing: {
    width: responsiveWidth(66),
    height: responsiveWidth(66),
  },
  outerRing: {
    width: responsiveWidth(84),
    height: responsiveWidth(84),
    borderColor: "rgba(34,194,224,0.26)",
  },
  micButton: {
    borderRadius: responsiveWidth(20.5),
  },
  micCore: {
    width: responsiveWidth(41),
    height: responsiveWidth(41),
    borderRadius: responsiveWidth(20.5),
    justifyContent: "center",
    alignItems: "center",
  },
  floatDot: {
    position: "absolute",
    backgroundColor: "rgba(231,240,255,0.7)",
    borderRadius: 999,
  },
  dotOne: {
    width: responsiveWidth(5.2),
    height: responsiveWidth(5.2),
    top: responsiveHeight(10),
    right: responsiveWidth(17),
  },
  dotTwo: {
    width: responsiveWidth(3.9),
    height: responsiveWidth(3.9),
    left: responsiveWidth(17),
    bottom: responsiveHeight(10),
  },
  dotThree: {
    width: responsiveWidth(3.6),
    height: responsiveWidth(3.6),
    right: responsiveWidth(5.2),
    bottom: responsiveHeight(21.5),
    opacity: 0.6,
  },
  processing: {
    color: "#16CAE7",
    textAlign: "center",
    letterSpacing: 3,
    fontSize: responsiveWidth(2.9),
    marginTop: -responsiveHeight(0.8),
    marginBottom: responsiveHeight(2.2),
    fontWeight: "500",
  },
  errorText: {
    color: "#FF8A8A",
    fontSize: responsiveWidth(2.6),
    textAlign: "center",
    marginTop: -responsiveHeight(1.2),
    marginBottom: responsiveHeight(1.4),
    paddingHorizontal: responsiveWidth(8),
  },
  responseCard: {
    marginHorizontal: responsiveWidth(4),
    marginBottom: responsiveHeight(1.4),
    maxHeight: responsiveHeight(24),
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1D4254",
    backgroundColor: "#071520",
    overflow: "hidden",
  },
  responseTitle: {
    color: "#BFEFFF",
    fontSize: responsiveWidth(2.7),
    fontWeight: "700",
    paddingHorizontal: responsiveWidth(3.2),
    paddingTop: responsiveHeight(1),
    paddingBottom: responsiveHeight(0.7),
    borderBottomWidth: 1,
    borderBottomColor: "#123042",
  },
  responseScroll: {
    maxHeight: responsiveHeight(19),
  },
  responseContent: {
    paddingHorizontal: responsiveWidth(3.2),
    paddingVertical: responsiveHeight(1),
  },
  responseJson: {
    color: "#E3F8FF",
    fontSize: responsiveWidth(2.45),
    lineHeight: responsiveWidth(3.5),
  },
  bottomArea: {
    marginTop: "auto",
    paddingHorizontal: responsiveWidth(3.2),
    borderTopWidth: 1,
    borderTopColor: "#122032",
    backgroundColor: "#05101B",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: responsiveHeight(1.2),
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
  },
  sendText: {
    color: "#EAFAFF",
    fontSize: responsiveWidth(2.7),
    fontWeight: "700",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: responsiveWidth(2.1),
    marginBottom: responsiveHeight(0.8),
  },
  chip: {
    borderRadius: responsiveWidth(4.3),
    backgroundColor: "#20344C",
    borderWidth: 1,
    borderColor: "#314960",
    paddingVertical: responsiveHeight(1),
    paddingHorizontal: responsiveWidth(4),
    alignItems: "center",
  },
  chipText: {
    color: "#E5EFFD",
    fontSize: responsiveWidth(2.4),
    fontWeight: "500",
  },
});

export default MicListeningScreen;
