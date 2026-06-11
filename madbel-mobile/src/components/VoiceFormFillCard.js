import React from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Mic } from "lucide-react-native";
import {
  responsiveHeight,
  responsiveWidth,
} from "react-native-responsive-dimensions";
import { useNavigation, useRoute } from "@react-navigation/native";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import {
  useMadbelAiChatMutation,
  useMadbelAiWorkflowPrefillMutation,
} from "../redux/slices/madbelApiSlice";

const VoiceFormFillCard = ({
  label = "form",
  workflowIntent,
  sourceScreen,
  currentValues,
}) => {
  const navigation = useNavigation();
  const route = useRoute();
  const [modalVisible, setModalVisible] = React.useState(false);
  const [voicePrompt, setVoicePrompt] = React.useState("");
  const [isRecordingVoice, setIsRecordingVoice] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [workflowPrefill] = useMadbelAiWorkflowPrefillMutation();
  const [aiChat] = useMadbelAiChatMutation();

  useSpeechRecognitionEvent("result", (event) => {
    const text = event.results?.[0]?.transcript;
    if (text) {
      setVoicePrompt(text);
    }
  });

  useSpeechRecognitionEvent("end", () => {
    setIsRecordingVoice(false);
  });

  React.useEffect(
    () => () => {
      ExpoSpeechRecognitionModule.stop();
    },
    [],
  );

  const closeModal = () => {
    setModalVisible(false);
    setIsRecordingVoice(false);
    ExpoSpeechRecognitionModule.stop();
  };

  const handleOpenModal = () => {
    setVoicePrompt("");
    setModalVisible(true);
  };

  const handleStartVoiceRecording = async () => {
    try {
      const { granted } =
        await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!granted) return;

      setVoicePrompt("");
      setIsRecordingVoice(true);
      ExpoSpeechRecognitionModule.start({
        lang: "en-US",
        interimResults: true,
        maxAlternatives: 1,
      });
    } catch {
      setIsRecordingVoice(false);
    }
  };

  const handleStopVoiceRecording = () => {
    ExpoSpeechRecognitionModule.stop();
    setIsRecordingVoice(false);
  };

  React.useEffect(() => {
    if (modalVisible) {
      handleStartVoiceRecording();
    }
  }, [modalVisible]);

  const extractStructuredData = (responsePayload = {}) => {
    const payload = responsePayload?.data || responsePayload || {};
    const possibleStructured =
      payload?.prefill ||
      payload?.workflow?.output ||
      payload?.invoice_data ||
      payload?.fields ||
      payload?.structured_data ||
      payload?.workflowPrefill?.prefill ||
      null;

    if (possibleStructured && typeof possibleStructured === "object") {
      return possibleStructured;
    }

    const rawText =
      payload?.response ||
      payload?.ai_response ||
      payload?.text ||
      payload?.message ||
      "";
    const maybeJsonStart = String(rawText).indexOf("{");
    const maybeJsonEnd = String(rawText).lastIndexOf("}");

    if (maybeJsonStart >= 0 && maybeJsonEnd > maybeJsonStart) {
      return JSON.parse(String(rawText).slice(maybeJsonStart, maybeJsonEnd + 1));
    }

    return null;
  };

  const handleSubmitPrompt = async () => {
    const transcript = voicePrompt.trim();
    if (!transcript) return;

    try {
      setIsSubmitting(true);

      const workflowResponse = await workflowPrefill({
        transcript,
        workflow_intent: workflowIntent,
        current_values:
          currentValues && typeof currentValues === "object" ? currentValues : {},
      }).unwrap();

      const workflowPayload = workflowResponse?.data || workflowResponse || {};

      const chatResponse = await aiChat({
        content: transcript,
        response_mode: "text",
        voice_id: null,
      }).unwrap();

      const parsedPrefill =
        extractStructuredData(workflowPayload) ||
        extractStructuredData(chatResponse) ||
        workflowPayload?.prefill ||
        null;

      if (!parsedPrefill || typeof parsedPrefill !== "object") {
        throw new Error("No structured form data found in AI response.");
      }

      if (route?.name === sourceScreen) {
        navigation.setParams?.({
          prefill: parsedPrefill,
          prefillPrompt: transcript,
        });
      } else if (sourceScreen) {
        navigation.navigate(sourceScreen, {
          prefill: parsedPrefill,
          prefillPrompt: transcript,
        });
      }

      closeModal();
    } catch (error) {
      Alert.alert(
        "Voice processing failed",
        error?.data?.message || error?.message || "Could not process voice command.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <Pressable onPress={handleOpenModal} style={styles.micCircle}>
        <Mic color="#EAF9FF" size={32} strokeWidth={2.4} />
      </Pressable>


      <Text style={styles.text}>Tap mic to fill {label} via AI chat</Text>

      <Modal
        animationType="fade"
        transparent
        visible={modalVisible}
        onRequestClose={closeModal}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {`${String(label || "Form")
                .split(" ")
                .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
                .join(" ")} Command`}
            </Text>
            <TextInput
              value={voicePrompt}
              onChangeText={setVoicePrompt}
              placeholder={`e.g. "Create ${label} from this voice command"`}
              placeholderTextColor="#778499"
              style={styles.voiceInput}
              multiline
            />

            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={closeModal}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.stopBtn}
                onPress={isRecordingVoice ? handleStopVoiceRecording : handleStartVoiceRecording}
              >
                <Text style={styles.stopBtnText}>
                  {isRecordingVoice ? "Stop" : "Record"}
                </Text>
              </Pressable>
              <Pressable
                style={styles.applyBtn}
                onPress={handleSubmitPrompt}
                disabled={!voicePrompt.trim() || isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#031218" />
                ) : (
                  <Text style={styles.applyBtnText}>Process</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: responsiveHeight(1),
    marginBottom: responsiveHeight(0.6),
    position: "relative",
  },
  micCircle: {
    width: responsiveWidth(26),
    height: responsiveWidth(26),
    borderRadius: responsiveWidth(13),
    backgroundColor: "#18CDEB",
    alignItems: "center",
    justifyContent: "center",
  },
  glowWrap: {
    position: "absolute",
    right: responsiveWidth(23),
    top: responsiveHeight(0.6),
    width: responsiveWidth(14),
    height: responsiveWidth(14),
    alignItems: "center",
    justifyContent: "center",
  },
  glowOuter: {
    width: "100%",
    height: "100%",
    borderRadius: 999,
    backgroundColor: "rgba(190,245,255,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  glowMiddle: {
    width: "80%",
    height: "80%",
    borderRadius: 999,
    backgroundColor: "rgba(42,185,175,0.55)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(216,246,255,0.7)",
  },
  glowInner: {
    width: "58%",
    height: "58%",
    borderRadius: 999,
    backgroundColor: "#1A5364",
    borderWidth: 1,
    borderColor: "rgba(231,250,255,0.9)",
  },
  text: {
    marginTop: responsiveHeight(1),
    color: "#19CDEB",
    fontSize: 28 / 2,
    fontWeight: "500",
    textAlign: "center",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(1, 4, 10, 0.58)",
    justifyContent: "center",
    paddingHorizontal: responsiveWidth(5),
  },
  modalCard: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "#2B3C67",
    backgroundColor: "#111A2D",
    paddingHorizontal: responsiveWidth(4.6),
    paddingVertical: responsiveHeight(2),
    gap: responsiveHeight(1.5),
  },
  modalTitle: {
    color: "#E8F1FF",
    fontSize: 50 / 2,
    fontWeight: "800",
  },
  voiceInput: {
    minHeight: responsiveHeight(12.5),
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#344567",
    backgroundColor: "#1C2A45",
    color: "#DDE8FB",
    paddingHorizontal: responsiveWidth(4),
    paddingVertical: responsiveHeight(1.6),
    textAlignVertical: "top",
    fontSize: 20 / 2,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: responsiveWidth(2),
  },
  cancelBtn: {
    flex: 1,
    minHeight: responsiveHeight(6.3),
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#3A4D77",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1A2741",
  },
  cancelBtnText: {
    color: "#D6E2F4",
    fontSize: 40 / 2,
    fontWeight: "700",
  },
  stopBtn: {
    flex: 1,
    minHeight: responsiveHeight(6.3),
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#3A4D77",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1A2741",
  },
  stopBtnText: {
    color: "#D6E2F4",
    fontSize: 40 / 2,
    fontWeight: "700",
  },
  applyBtn: {
    flex: 1.2,
    minHeight: responsiveHeight(6.3),
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#21C0DF",
  },
  applyBtnText: {
    color: "#051728",
    fontSize: 42 / 2,
    fontWeight: "800",
  },
});

export default VoiceFormFillCard;
