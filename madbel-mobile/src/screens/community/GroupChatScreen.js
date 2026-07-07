import { useAppLanguage } from "../../context/LanguageContext";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import {
  responsiveHeight,
  responsiveWidth,
} from "react-native-responsive-dimensions";
import { useForm } from "react-hook-form";
import {
  ChevronLeft,
  Clock,
  Send,
  Mic,
  MicOff,
} from "lucide-react-native";
import { useSelector } from "react-redux";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import ControllerTextInput from "../../components/ControllerTextInput";
import {
  useFetchMessagesQuery,
  useMarkThreadSeenMutation,
  useSendMessageMutation,
} from "../../redux/slices/chat/chatSlice";
import { useMadbelTranscribeVoiceMutation } from "../../redux/slices/madbelApiSlice";
import useSocket from "../../hooks/useSocket";

const formatTime = (dateValue) => {
  const { t } = useAppLanguage();
  if (!dateValue) return "";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const toUiMessage = (message, myUserId) => {
  const senderId = String(message?.senderUserId || message?.sender_user_id || "");
  const isSelf = Boolean(message?.sender_is_self || message?.senderIsSelf || senderId === String(myUserId));
  return {
    id: message?._id || message?.id || `${Date.now()}-${Math.random()}`,
    text: message?.text || message?.content || "",
    time: formatTime(
      message?.createdAt ||
        message?.created_at ||
        message?.timestamp ||
        message?.updatedAt ||
        message?.updated_at,
    ),
    sender: isSelf ? "me" : "them",
    senderUserId: senderId,
    senderName: message?.senderName || message?.sender_name || message?.sender?.fullName || message?.sender?.name || "Member",
    senderAvatar: message?.senderAvatar || message?.sender_avatar || message?.sender?.avatar || message?.sender?.avatar_url || "https://robohash.org/user.png",
    raw: message,
  };
};

const upsertMessages = (prev, nextMessage) => {
  if (!nextMessage?.id) return prev;
  const exists = prev.some((item) => String(item.id) === String(nextMessage.id));
  if (exists) return prev;
  return [...prev, nextMessage];
};


const UserAvatar = ({ uri }) => (
  <View style={styles.avatarWrap}>
    <Image source={{ uri }} style={styles.avatarImage} />
    <View style={styles.activeDot} />
  </View>
);

const GroupChatScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const authUser = useSelector((state) => state?.auth?.user);
  const myUserId = authUser?._id || authUser?.id || authUser?.userId;

  const { group } = route.params || {};
  const groupName = group?.name || "Marketing Team";
  const threadId =
    group?.conversation_id ||
    group?.conversationId ||
    group?.threadId ||
    group?.thread_id ||
    group?.id ||
    null;

  const [messages, setMessages] = useState([]);
  const [sendMessageMutation, { isLoading: isSending }] = useSendMessageMutation();
  const [markThreadSeen] = useMarkThreadSeenMutation();

  const recorder = useAudioRecorder(RecordingPresets.LOW_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 250);
  const [transcribeVoice, { isLoading: isTranscribing }] = useMadbelTranscribeVoiceMutation();

  const { control, handleSubmit, reset, setValue, getValues } = useForm({
    defaultValues: {
      message: "",
    },
  });

  const {
    data: threadMessagesData,
    isFetching: isLoadingMessages,
    isError: isThreadError,
  } = useFetchMessagesQuery(threadId, { skip: !threadId });

  useSocket({
    threadId,
    enabled: Boolean(threadId),
    onMessage: (incoming) => {
      const normalized = toUiMessage(incoming, myUserId);
      setMessages((prev) => upsertMessages(prev, normalized));
    },
  });

  const scrollViewRef = useRef(null);
  const scrollTimeoutRef = useRef(null);

  useEffect(() => {
    const apiMessages = threadMessagesData?.messages || [];
    if (apiMessages.length > 0) {
      const next = apiMessages.map((item) => toUiMessage(item, myUserId));
      setMessages(next);
    }
  }, [myUserId, threadMessagesData?.messages]);

  useEffect(() => {
    if (threadId) {
      markThreadSeen(threadId).catch(() => null);
    }
  }, [markThreadSeen, threadId]);

  useEffect(() => {
    if (!scrollViewRef.current || chatMessages.length === 0) return undefined;

    scrollTimeoutRef.current = setTimeout(() => {
      scrollViewRef.current?.scrollToEnd?.({ animated: true });
    }, 100);

    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = null;
      }
    };
  }, [messages]);

  const onSendPress = handleSubmit(async (data) => {
    const text = (data.message || "").trim();
    if (!text || !threadId || isSending) return;

    reset({ message: "" });

    try {
      const result = await sendMessageMutation({
        threadId,
        text,
      }).unwrap();

      const created = result?.message || result;
      if (created?._id || created?.id) {
        const uiMessage = toUiMessage(created, myUserId);
        setMessages((prev) => upsertMessages(prev, uiMessage));
      }
    } catch (error) {
      setValue("message", text);
    }
  });

  const handleRecordButtonPress = async () => {
    if (recorderState?.isRecording) {
      try {
        await recorder.stop();
        const uri = recorder.uri || recorder.getStatus?.()?.uri;
        if (uri) {
          const fetchResponse = await fetch(uri);
          const blob = await fetchResponse.blob();
          
          const audioBase64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });

          const result = await transcribeVoice({
            audio_base64: audioBase64,
            audio_filename: `mabdel-transcribe-${Date.now()}.m4a`,
            audio_mime_type: "audio/m4a",
          }).unwrap();
          
          const transcriptData = result?.data || result;
          const t = transcriptData?.transcript;
          if (t) {
            const currentVal = getValues("message");
            setValue("message", currentVal ? currentVal + " " + t : t);
          }
        }
      } catch (error) {
      }
    } else {
      try {
        const permission = await requestRecordingPermissionsAsync();
        if (!permission.granted) return;
        await setAudioModeAsync({
          allowsRecording: true,
          playsInSilentMode: true,
          interruptionMode: "doNotMix",
          shouldPlayInBackground: false,
          shouldRouteThroughEarpiece: false,
        });
        await recorder.prepareToRecordAsync();
        recorder.record();
      } catch (error) {
      }
    }
  };

  const renderMicIcon = () => {
    if (isTranscribing) {
      return <ActivityIndicator size="small" color="#14C9E7" />;
    }
    if (recorderState?.isRecording) {
      return <MicOff size={20} color="#FC4C58" />;
    }
    return <Mic size={20} color="#8E9AA0" />;
  };

  const chatMessages = messages;

  const renderMessageItem = (msg, index) => {
    const isMe = msg.sender === "me";
    const isImage = msg.raw?.media_url?.match(/\.(jpeg|jpg|gif|png|webp)/i) || msg.isMockImage;
    const isPdf = msg.raw?.media_url?.match(/\.pdf/i) || msg.isMockPdf;

    if (isMe) {
      return (
        <View key={msg.id} style={[styles.messageGroup, { alignItems: "flex-end" }]}>
          <View style={styles.rightBubble}>
            <Text style={styles.rightText}>{msg.text}</Text>
          </View>
          <Text style={[styles.timeText, { marginRight: 4, marginTop: 4 }]}>{msg.time}</Text>
        </View>
      );
    }

    return (
      <View key={msg.id} style={styles.messageGroup}>
        <Text style={styles.senderName}>{msg.senderName}</Text>
        <View style={styles.leftBubble}>
          <Text style={styles.leftText}>
            {msg.text.includes("@") ? (
              msg.text.split(" ").map((word, idx) => {
                if (word.startsWith("@")) {
                  return <Text key={idx} style={styles.mention}>{word} </Text>;
                }
                return `${word} `;
              })
            ) : (
              msg.text
            )}
          </Text>
        </View>

        {isImage && (
          <Image
            source={{ uri: msg.raw?.media_url || msg.imageUri }}
            style={styles.previewImage}
          />
        )}

        {isPdf && (
          <View style={styles.fileCard}>
            <View style={styles.fileIconWrap}>
              <Text style={styles.fileIcon}>{t("")}</Text>
            </View>
            <View style={styles.fileInfo}>
              <Text style={styles.fileName}>{msg.fileName || "Document.pdf"}</Text>
              <Text style={styles.fileSize}>{msg.fileSize || "2.4 MB"}</Text>
            </View>
          </View>
        )}

        <View style={styles.footerRow}>
          <UserAvatar uri={msg.senderAvatar} />
          <Text style={styles.timeText}>{msg.time}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.iconWrap} onPress={() => navigation.goBack()}>
            <ChevronLeft size={28} color="#FFFFFF" strokeWidth={2.3} />
          </Pressable>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>{groupName}</Text>
            {Array.isArray(group?.member_ids) && group.member_ids.length > 0 && (
              <View style={styles.membersRow}>
                <Text style={styles.membersText}>{group.member_ids.length} members</Text>
              </View>
            )}
          </View>

          <Pressable onPress={() => navigation.navigate("GroupSetting", { group })} style={styles.headerRight}>
            <Clock size={24} color="#C0CBDB" />
          </Pressable>
        </View>

        {isLoadingMessages && messages.length === 0 ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <ActivityIndicator color="#00C2FF" size="large" />
          </View>
        ) : (
          <ScrollView
            ref={scrollViewRef}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.chatContent}
          >
            {chatMessages.length === 0 ? (
              <Text style={styles.typingText}>{t("no_messages_yet_start_the_conversation")}</Text>
            ) : (
              chatMessages.map(renderMessageItem)
            )}
          </ScrollView>
        )}

        <View style={styles.bottomBar}>
          <ControllerTextInput
            name="message"
            control={control}
            placeholder={t("type_a_message")}
            placeholderTextColor="#7A879F"
            containerStyle={styles.chatInputContainer}
            inputStyle={styles.chatInput}
            inputWrapperStyle={styles.chatInputWrap}
            rightIcon={renderMicIcon()}
            onPressToggle={handleRecordButtonPress}
            onSubmitEditing={onSendPress}
          />

          <Pressable style={styles.sendBtn} onPress={onSendPress} disabled={isSending}>
            <Send size={18} color="#08131D" />
          </Pressable>
        </View>
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
    borderBottomWidth: 1,
    borderBottomColor: "#11151D",
  },
  iconWrap: {
    padding: 4,
  },
  headerCenter: {
    flex: 1,
    marginLeft: responsiveWidth(4),
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 19,
    fontWeight: "700",
  },
  membersRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
    gap: 6,
  },
  membersText: {
    color: "#8E9AA0",
    fontSize: 13,
  },
  stackAvatars: {
    flexDirection: "row",
    alignItems: "center",
  },
  stackAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#000000",
  },
  stackAvatarShift: {
    marginLeft: -6,
  },
  headerRight: {
    padding: 4,
  },
  chatContent: {
    paddingVertical: responsiveHeight(2),
    paddingBottom: responsiveHeight(4),
    gap: responsiveHeight(1),
  },
  messageGroup: {
    marginBottom: responsiveHeight(2),
    gap: 6,
  },
  senderName: {
    color: "#8E9AA0",
    fontSize: 13,
    fontWeight: "500",
    marginLeft: 4,
    marginBottom: 2,
  },
  leftBubble: {
    maxWidth: "85%",
    backgroundColor: "#1E2230",
    borderRadius: 20,
    borderTopLeftRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignSelf: "flex-start",
  },
  leftText: {
    color: "#E2E8F0",
    fontSize: 15,
    lineHeight: 22,
  },
  mention: {
    color: "#9B86FA",
    fontWeight: "600",
  },
  rightBubble: {
    maxWidth: "85%",
    backgroundColor: "#00C2FF",
    borderRadius: 20,
    borderTopRightRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignSelf: "flex-end",
    shadowColor: "#00C2FF",
    shadowOpacity: 0.5,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 10,
    elevation: 8,
  },
  rightText: {
    color: "#08141C",
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600",
  },
  avatarWrap: {
    width: 32,
    height: 32,
    position: "relative",
  },
  avatarImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  activeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#22C55E",
    borderWidth: 2,
    borderColor: "#000000",
    position: "absolute",
    right: -1,
    bottom: -1,
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
    marginLeft: 4,
  },
  timeText: {
    color: "#6B7280",
    fontSize: 11,
  },
  previewImage: {
    width: responsiveWidth(70),
    height: responsiveWidth(42),
    borderRadius: 16,
    marginTop: 4,
    alignSelf: "flex-start",
  },
  fileCard: {
    width: responsiveWidth(70),
    height: 64,
    borderRadius: 16,
    backgroundColor: "#1E2230",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    marginTop: 4,
    alignSelf: "flex-start",
  },
  fileIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#2E1618",
    alignItems: "center",
    justifyContent: "center",
  },
  fileIcon: {
    color: "#FC6166",
    fontSize: 16,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    color: "#E2E8F0",
    fontSize: 14,
    fontWeight: "500",
  },
  fileSize: {
    color: "#8E9AA0",
    fontSize: 11,
    marginTop: 1,
  },
  typingText: {
    color: "#8E9AA0",
    fontSize: 13,
    marginLeft: 4,
    marginTop: 4,
  },
  bottomBar: {
    paddingVertical: responsiveHeight(1.5),
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: responsiveHeight(4),
  },
  chatInputContainer: {
    flex: 1,
  },
  chatInputWrap: {
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#1F242E",
    backgroundColor: "#0E1116",
  },
  chatInput: {
    height: 48,
    color: "#FFFFFF",
    fontSize: 15,
    backgroundColor: "transparent",
    borderWidth: 0,
    paddingLeft: 16,
    paddingRight: 40,
  },
  sendBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#00C2FF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#00C2FF",
    shadowOpacity: 0.5,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 8,
    elevation: 6,
  },
});

export default GroupChatScreen;
