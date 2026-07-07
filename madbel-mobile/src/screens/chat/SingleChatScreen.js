import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Modal,
  Pressable,
  TextInput,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft, Ellipsis, Send, Mic, MicOff } from "lucide-react-native";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import * as FileSystem from "expo-file-system";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSelector } from "react-redux";
import MessageBubble from "../../components/MessageBubble";
import { useAppLanguage } from "../../context/LanguageContext";
import {
  responsiveHeight,
  responsiveWidth,
} from "react-native-responsive-dimensions";
import {
  useFetchConversationsQuery,
  useFetchMessagesQuery,
  useMarkThreadSeenMutation,
  useSendMessageMutation,
} from "../../redux/slices/chat/chatSlice";
import { useMadbelTranscribeVoiceMutation } from "../../redux/slices/madbelApiSlice";
import {
  useMadbelSetTypingStateMutation,
  useMadbelReplyToMessageMutation,
  useMadbelForwardMessageMutation,
} from "../../redux/slices/madbelSmartflowSlice";
import { addEventListener, removeEventListener } from "../../utils/socket";
import useSocket from "../../hooks/useSocket";

const formatTime = (dateValue) => {
  if (!dateValue) return "";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const toUiMessage = (message, myUserId) => {
  const senderId = String(message?.senderUserId || "");
  const isSelf = Boolean(message?.sender_is_self || message?.senderIsSelf);
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
    sender: isSelf || senderId === String(myUserId || "") ? "me" : "them",
    senderUserId: senderId,
    status: message?.status || message?.delivery_status || null,
    raw: message,
  };
};

const upsertMessages = (prev, nextMessage) => {
  if (!nextMessage?.id) return prev;
  const exists = prev.some((item) => String(item.id) === String(nextMessage.id));
  if (exists) return prev;
  return [...prev, nextMessage];
};
const ADMIN_SUPPORT_SUGGESTIONS = [
  "billing_issue",
  "technical_help",
  "account_problem",
];

const SingleChatScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { t } = useAppLanguage();
  const authUser = useSelector((state) => state?.auth?.user);
  const myUserId = authUser?._id || authUser?.id || authUser?.userId;

  const { conversation, threadId: routeThreadId, group } = route.params || {};
  const threadId =
    routeThreadId ||
    group?.threadId ||
    conversation?._id ||
    conversation?.id ||
    null;

  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [peerIsTyping, setPeerIsTyping] = useState(false);
  const [peerIsOnline, setPeerIsOnline] = useState(Boolean(conversation?.isOnline));
  const [replyToMessage, setReplyToMessage] = useState(null);
  const [forwardMessage, setForwardMessage] = useState(null);
  const [forwardModalVisible, setForwardModalVisible] = useState(false);
  const typingTimeoutRef = useRef(null);
  const isSelfTypingRef = useRef(false);
  const [sendMessageMutation, { isLoading: isSending }] = useSendMessageMutation();
  const [markThreadSeen] = useMarkThreadSeenMutation();
  const [setTypingState] = useMadbelSetTypingStateMutation();
  const [replyToMessageMutation] = useMadbelReplyToMessageMutation();
  const [forwardMessageMutation] = useMadbelForwardMessageMutation();
  const { data: allThreads = [] } = useFetchConversationsQuery();

  const recorder = useAudioRecorder(RecordingPresets.LOW_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 250);
  const [transcribeVoice, { isLoading: isTranscribing }] = useMadbelTranscribeVoiceMutation();

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

  const flatListRef = useRef(null);
  const scrollTimeoutRef = useRef(null);

  const defaultConversation = {
    name: t("chat"),
    avatar: "https://robohash.org/user.png",
  };

  const groupConversation = group
    ? {
        name: group?.name || t("group_chat"),
        avatar: group?.avatar || "https://robohash.org/group.png",
      }
    : null;

  const currentConversation =
    conversation || groupConversation || defaultConversation;

  useEffect(() => {
    const apiMessages = threadMessagesData?.messages || [];
    const next = apiMessages.map((item) => toUiMessage(item, myUserId));
    setMessages(next);
  }, [myUserId, threadMessagesData?.messages]);

  useEffect(() => {
    if (threadId) {
      markThreadSeen(threadId).catch(() => null);
    }
  }, [markThreadSeen, threadId]);

  useEffect(() => {
    const handler = (payload) => {
      const myId = String(myUserId || "");
      const actorId = String(payload?.user_id || payload?.actor_id || "");
      if (actorId && actorId === myId) return;
      const isTyping = Boolean(payload?.is_typing);
      setPeerIsTyping(isTyping);
      if (isTyping) {
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => setPeerIsTyping(false), 8000);
      }
    };
    addEventListener("chat:typing:updated", handler);
    return () => {
      removeEventListener("chat:typing:updated", handler);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [myUserId]);

  useEffect(() => {
    const handler = (payload) => {
      const actorId = String(payload?.user_id || "");
      if (!actorId || actorId === String(myUserId || "")) return;
      setPeerIsOnline(payload?.presence === "online");
    };
    addEventListener("chat:presence:updated", handler);
    return () => removeEventListener("chat:presence:updated", handler);
  }, [myUserId]);

  const handleTextChange = useCallback(
    (text) => {
      setMessage(text);
      if (!threadId) return;
      if (text.length > 0 && !isSelfTypingRef.current) {
        isSelfTypingRef.current = true;
        setTypingState({ conversation_id: threadId, is_typing: true, actor_type: "user" }).catch(() => null);
      }
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        isSelfTypingRef.current = false;
        setTypingState({ conversation_id: threadId, is_typing: false, actor_type: "user" }).catch(() => null);
      }, 3000);
    },
    [threadId, setTypingState],
  );

  useEffect(() => {
    if (!flatListRef.current || messages.length === 0) return undefined;

    scrollTimeoutRef.current = setTimeout(() => {
      flatListRef.current?.scrollToEnd?.({ animated: true });
    }, 100);

    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = null;
      }
    };
  }, [messages]);

  const sendMessage = async () => {
    const text = message.trim();
    if (!text || !threadId || isSending) return;

    const pendingReply = replyToMessage;
    setMessage("");
    setReplyToMessage(null);
    if (isSelfTypingRef.current) {
      isSelfTypingRef.current = false;
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      setTypingState({ conversation_id: threadId, is_typing: false, actor_type: "user" }).catch(() => null);
    }

    try {
      let created;
      if (pendingReply) {
        const result = await replyToMessageMutation({
          message_id: pendingReply.id,
          content: text,
          platform: "ai",
        }).unwrap();
        created = result?.message || result;
      } else {
        const result = await sendMessageMutation({ threadId, type: "text", text }).unwrap();
        created = result?.message || result;
      }
      if (created?._id || created?.id) {
        setMessages((prev) => upsertMessages(prev, toUiMessage(created, myUserId)));
      }
    } catch {
      setMessage(text);
      if (pendingReply) setReplyToMessage(pendingReply);
    }
  };

  const handleLongPressMessage = useCallback((item) => {
    Alert.alert(
      t("message_actions"),
      null,
      [
        {
          text: t("reply"),
          onPress: () => setReplyToMessage(item),
        },
        {
          text: t("forward"),
          onPress: () => {
            setForwardMessage(item);
            setForwardModalVisible(true);
          },
        },
        { text: t("cancel"), style: "cancel" },
      ],
      { cancelable: true },
    );
  }, [t]);

  const handleForwardTo = useCallback(async (targetThreadId) => {
    if (!forwardMessage || !targetThreadId) return;
    setForwardModalVisible(false);
    try {
      await forwardMessageMutation({
        message_id: forwardMessage.id,
        conversation_id: targetThreadId,
        platform: "ai",
      }).unwrap();
    } catch {
      Alert.alert(t("error"), t("could_not_forward_message"));
    }
    setForwardMessage(null);
  }, [forwardMessage, forwardMessageMutation, t]);

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
             setMessage((prev) => (prev ? prev + " " + t : t));
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

  const renderMessageItem = ({ item, index }) => {
    const isMe = item.sender === "me";
    const showAvatar = !isMe && (index === 0 || messages[index - 1]?.sender === "me");
    const isLastInGroup =
      isMe && (index === messages.length - 1 || messages[index + 1]?.sender !== "me");

    const showDateSeparator =
      index === 0 ||
      new Date(item?.raw?.createdAt || 0).toDateString() !==
        new Date(messages[index - 1]?.raw?.createdAt || 0).toDateString();

    return (
      <>
        {showDateSeparator && item?.time ? (
          <View style={{ alignItems: "center", marginVertical: 12 }}>
            <Text style={{ color: "#5D6A7A", fontSize: 12, fontWeight: "600" }}>
              {new Date(item?.raw?.createdAt || Date.now()).toDateString() ===
              new Date().toDateString()
                ? `${t("today")}, ${item.time}`
                : new Date(item?.raw?.createdAt || 0).toLocaleDateString([], {
                    month: "short",
                    day: "numeric",
                  }).toUpperCase()}
            </Text>
          </View>
        ) : null}
        <MessageBubble
          message={item}
          isMe={isMe}
          showAvatar={showAvatar}
          isLastInGroup={isLastInGroup}
          avatar={currentConversation.avatar}
          onLongPress={() => handleLongPressMessage(item)}
        />
      </>
    );
  };

  const renderEmptyComponent = () => (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 32 }}>
      {currentConversation.avatar ? (
        <Image
          source={{ uri: currentConversation.avatar }}
          style={{ width: 80, height: 80, borderRadius: 40, marginBottom: 16 }}
        />
      ) : null}
      <Text style={{ fontSize: 18, fontWeight: "600", color: "#F8FAFC", marginBottom: 4 }}>
        {currentConversation.name}
      </Text>
      <Text style={{ color: "#5D6A7A", fontSize: 15, textAlign: "center" }}>
        {isThreadError ? t("failed_to_load_messages") : t("no_messages_yet")}
      </Text>
      <Text style={{ color: "#3D4A58", fontSize: 14, textAlign: "center", marginTop: 4 }}>
        {t("send_message_to_start")}
      </Text>
    </View>
  );

  const inputDisabled = !threadId || isSending;

  const headerName = useMemo(
    () => currentConversation?.name || t("chat"),
    [currentConversation?.name, t],
  );
  const shouldShowSuggestions =
    String(headerName || "").toLowerCase() === "live support";
  const isGroupChat = Boolean(group);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#020406" }}>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: responsiveWidth(2),
          paddingVertical: responsiveHeight(1),
          borderBottomWidth: 1,
          borderBottomColor: "#141820",
        }}
      >
        <Pressable onPress={() => navigation.goBack()} style={{ padding: 8 }}>
          <ChevronLeft size={26} color="#F8FAFC" />
        </Pressable>

        <View style={{ alignItems: "center", flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={{ fontSize: 17, color: "#F8FAFC", fontWeight: "700" }}>
              {headerName}
            </Text>
            <View
              style={{
                width: 9,
                height: 9,
                borderRadius: 5,
                backgroundColor: peerIsOnline ? "#22C55E" : "#5D6A7A",
              }}
            />
          </View>
          <Text style={{ fontSize: 13, color: peerIsTyping ? "#17CBE8" : peerIsOnline ? "#22C55E" : "#5D6A7A", fontWeight: "600", marginTop: 1 }}>
            {peerIsTyping ? t("typing") : peerIsOnline ? t("online") : t("offline")}
          </Text>
        </View>

        {isGroupChat ? (
          <Pressable
            style={{ padding: 8 }}
            onPress={() => navigation.navigate("GroupSetting", { group })}
          >
            <Ellipsis color="#F8FAFC" />
          </Pressable>
        ) : (
          <View style={{ width: 42 }} />
        )}
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <View className="flex-1">
          {isLoadingMessages ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="small" color="#71ABE0" />
              <Text className="text-gray-500 mt-2">{t("loading_chat")}</Text>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              renderItem={renderMessageItem}
              keyExtractor={(item) => String(item.id)}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                flexGrow: 1,
                paddingHorizontal: 16,
                paddingVertical: 16,
              }}
              ListEmptyComponent={renderEmptyComponent}
            />
          )}
        </View>

        <View
          style={{
            backgroundColor: "#0D1520",
            borderTopWidth: 1,
            borderTopColor: "#141820",
            paddingHorizontal: responsiveWidth(3),
            paddingTop: responsiveHeight(1),
            paddingBottom: responsiveHeight(10),
          }}
        >
          {/* Reply preview bar */}
          {replyToMessage ? (
            <View style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: "#1A2435",
              borderRadius: 12,
              paddingHorizontal: responsiveWidth(3),
              paddingVertical: responsiveHeight(0.8),
              marginBottom: responsiveHeight(0.8),
              borderLeftWidth: 3,
              borderLeftColor: "#17CBE8",
            }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#17CBE8", fontSize: 12, fontWeight: "700", marginBottom: 2 }}>
                  {t("replying_to")} {replyToMessage.sender === "me" ? t("yourself") : currentConversation.name}
                </Text>
                <Text style={{ color: "#8A9AB0", fontSize: 13 }} numberOfLines={1}>
                  {replyToMessage.text}
                </Text>
              </View>
              <Pressable onPress={() => setReplyToMessage(null)} style={{ paddingLeft: 8, paddingVertical: 4 }}>
                <Text style={{ color: "#5D6A7A", fontSize: 20, lineHeight: 20 }}>✕</Text>
              </Pressable>
            </View>
          ) : null}

          {shouldShowSuggestions && (
            <View
              style={{
                flexDirection: "row",
                gap: responsiveWidth(2),
                marginBottom: responsiveHeight(1.1),
              }}
            >
              {ADMIN_SUPPORT_SUGGESTIONS.map((item) => (
                <Pressable
                  key={item}
                  onPress={() => setMessage(item)}
                  style={{
                    flex: 1,
                    minHeight: responsiveHeight(4.8),
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: "#2E3545",
                    backgroundColor: "#111826",
                    alignItems: "center",
                    justifyContent: "center",
                    paddingHorizontal: responsiveWidth(1.5),
                  }}
                >
                  <Text style={{ color: "#D5DEE9", fontSize: 13, fontWeight: "500", textAlign: "center" }}>
                    {t(item)}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          {/* My avatar + input row */}
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: responsiveWidth(2) }}>
            {/* User avatar */}
            <View style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: "#1B2A3B",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}>
              {authUser?.avatar || authUser?.profile_image ? (
                <Image
                  source={{ uri: authUser?.avatar || authUser?.profile_image }}
                  style={{ width: 36, height: 36, borderRadius: 18 }}
                />
              ) : (
                <Text style={{ color: "#17CBE8", fontWeight: "700", fontSize: 14 }}>
                  {String(authUser?.full_name || authUser?.name || "M")[0].toUpperCase()}
                </Text>
              )}
            </View>

            {/* Input + mic + send */}
            <View style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "flex-end",
              backgroundColor: "#1A2435",
              borderRadius: 24,
              paddingHorizontal: responsiveWidth(4),
              paddingVertical: responsiveHeight(0.8),
              borderWidth: 1,
              borderColor: "#232A34",
              gap: 8,
            }}>
              <TextInput
                style={{
                  flex: 1,
                  color: "#E8EFF7",
                  fontSize: 15,
                  maxHeight: 100,
                  paddingVertical: 6,
                }}
                placeholder={threadId ? t("type_message") : t("chat_unavailable")}
                placeholderTextColor="#4A5568"
                value={message}
                onChangeText={handleTextChange}
                multiline
                maxLength={500}
                editable={!inputDisabled}
              />
              <Pressable
                onPress={handleRecordButtonPress}
                disabled={inputDisabled || isTranscribing}
                style={{ paddingBottom: 6 }}
              >
                {isTranscribing ? (
                  <ActivityIndicator size="small" color="#17CBE8" />
                ) : recorderState?.isRecording ? (
                  <MicOff size={20} color="#EF4444" />
                ) : (
                  <Mic size={20} color="#5D6A7A" />
                )}
              </Pressable>
            </View>

            {/* Send button */}
            <Pressable
              onPress={sendMessage}
              disabled={!message.trim() || inputDisabled}
              style={{
                backgroundColor: message.trim() && !inputDisabled ? "#17CBE8" : "#1A2435",
                borderRadius: 24,
                paddingHorizontal: responsiveWidth(5),
                paddingVertical: responsiveHeight(1.3),
                borderWidth: 1,
                borderColor: message.trim() && !inputDisabled ? "#17CBE8" : "#232A34",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {isSending ? (
                <ActivityIndicator size="small" color="#020406" />
              ) : (
                <Text style={{
                  color: message.trim() && !inputDisabled ? "#020406" : "#5D6A7A",
                  fontWeight: "700",
                  fontSize: 15,
                }}>
                  {t("send")}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Forward conversation picker modal */}
      <Modal
        visible={forwardModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setForwardModalVisible(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" }}
          onPress={() => setForwardModalVisible(false)}
        >
          <Pressable
            style={{
              backgroundColor: "#0D1520",
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              paddingTop: 16,
              paddingBottom: responsiveHeight(6),
              maxHeight: responsiveHeight(60),
            }}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={{ color: "#F8FAFC", fontSize: 17, fontWeight: "700", textAlign: "center", marginBottom: 14 }}>
              {t("forward_to")}
            </Text>
            <FlatList
              data={allThreads.filter((t) => (t._id || t.id) !== threadId)}
              keyExtractor={(item) => String(item._id || item.id)}
              renderItem={({ item }) => (
                <Pressable
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 20,
                    paddingVertical: 13,
                    borderBottomWidth: 1,
                    borderBottomColor: "#141820",
                    gap: 12,
                  }}
                  onPress={() => handleForwardTo(item._id || item.id)}
                >
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "#1B2A3B", alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ color: "#17CBE8", fontWeight: "700", fontSize: 16 }}>
                      {String(item.directPeer?.fullName || item.name || "?")[0].toUpperCase()}
                    </Text>
                  </View>
                  <Text style={{ color: "#E8EFF7", fontSize: 15, fontWeight: "600" }}>
                    {item.directPeer?.fullName || item.name || t("unknown_user")}
                  </Text>
                </Pressable>
              )}
              ListEmptyComponent={
                <Text style={{ color: "#5D6A7A", textAlign: "center", paddingVertical: 24 }}>{t("no_other_conversations")}</Text>
              }
            />
          </Pressable>
        </Pressable>
      </Modal>

    </SafeAreaView>
  );
};

export default SingleChatScreen;
