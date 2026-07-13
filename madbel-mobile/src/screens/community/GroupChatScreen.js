import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSelector } from "react-redux";
import {
  ChevronLeft,
  FileText,
  Info,
  Mic,
  MicOff,
  Send,
  Users,
} from "lucide-react-native";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import { useAppLanguage } from "../../context/LanguageContext";
import {
  responsiveHeight,
  responsiveWidth,
} from "react-native-responsive-dimensions";
import {
  useMadbelCreateMessageMutation,
  useMadbelGetGroupQuery,
  useMadbelListMessagesQuery,
  useMadbelMarkConversationReadMutation,
  useMadbelSetTypingStateMutation,
  useMadbelTranscribeVoiceMutation,
} from "../../redux/slices/madbelSmartflowSlice";
import { addEventListener, removeEventListener } from "../../utils/socket";
import useSocket from "../../hooks/useSocket";

const formatTime = (dateValue) => {
  if (!dateValue) return "";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const getMessageTimestamp = (message) => {
  const values = [
    message?.raw?.createdAt,
    message?.raw?.created_at,
    message?.raw?.timestamp,
    message?.raw?.updatedAt,
    message?.raw?.updated_at,
  ];

  for (const value of values) {
    if (!value) continue;
    const ts = new Date(value).getTime();
    if (!Number.isNaN(ts)) return ts;
  }

  return 0;
};

const isImageUrl = (value) => /\.(jpeg|jpg|gif|png|webp|heic|heif)$/i.test(String(value || ""));
const isPdfUrl = (value) => /\.pdf(\?.*)?$/i.test(String(value || ""));

const getInitials = (name) =>
  String(name || "?")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";

const normalizeMessage = (message, myUserId) => {
  const senderId = String(
    message?.senderUserId ||
      message?.sender_user_id ||
      message?.sender?.id ||
      message?.sender?.user_id ||
      message?.user_id ||
      "",
  );
  const isSelf = Boolean(message?.sender_is_self || message?.senderIsSelf) || senderId === String(myUserId || "");
  const senderName =
    message?.senderName ||
    message?.sender_name ||
    message?.sender?.fullName ||
    message?.sender?.name ||
    message?.sender?.full_name ||
    "Member";
  const senderAvatar =
    message?.senderAvatar ||
    message?.sender_avatar ||
    message?.sender?.avatar ||
    message?.sender?.avatar_url ||
    message?.sender?.profileImage ||
    message?.sender?.profile_image ||
    "";

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
    senderName,
    senderAvatar,
    raw: message,
  };
};

const upsertMessages = (prev, nextMessage) => {
  if (!nextMessage?.id) return prev;
  const exists = prev.some((item) => String(item.id) === String(nextMessage.id));
  if (exists) return prev;
  return [...prev, nextMessage];
};

const Avatar = ({ uri, name, size = 34 }) => {
  const initials = getInitials(name);
  return (
    <View
      style={[
        styles.avatarBase,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
      ]}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={[
            styles.avatarImage,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
            },
          ]}
        />
      ) : (
        <View
          style={[
            styles.avatarFallback,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
            },
          ]}
        >
          <Text style={[styles.avatarFallbackText, { fontSize: size * 0.34 }]}>
            {initials}
          </Text>
        </View>
      )}
    </View>
  );
};

const MentionText = ({ text, style, mentionStyle }) => {
  const words = String(text || "").split(/(\s+)/);
  return (
    <Text style={style}>
      {words.map((word, index) =>
        /^@\S+/.test(word) ? (
          <Text key={`${word}-${index}`} style={mentionStyle}>
            {word}
          </Text>
        ) : (
          <Text key={`${word}-${index}`}>{word}</Text>
        ),
      )}
    </Text>
  );
};

const GroupChatScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { t } = useAppLanguage();
  const tr = (key, fallback = key) => {
    const value = t?.(key);
    return value && value !== key ? value : fallback;
  };
  const authUser = useSelector((state) => state?.auth?.user);
  const myUserId = authUser?._id || authUser?.id || authUser?.userId;

  const routeGroup = route?.params?.group || {};
  const groupId =
    route?.params?.group_id ||
    routeGroup?.group_id ||
    routeGroup?.id ||
    routeGroup?.conversation_id ||
    routeGroup?.conversationId ||
    routeGroup?.threadId ||
    routeGroup?.thread_id ||
    null;

  const {
    data: groupResponse,
    isLoading: isGroupLoading,
    isFetching: isGroupFetching,
  } = useMadbelGetGroupQuery(
    { group_id: groupId },
    { skip: !groupId },
  );
  const group = groupResponse?.data || routeGroup || {};
  const threadId =
    group?.conversation_id ||
    routeGroup?.conversation_id ||
    routeGroup?.conversationId ||
    routeGroup?.threadId ||
    routeGroup?.thread_id ||
    groupId ||
    null;
  const hasGroupIdentity = Boolean(
    group?.name ||
      group?.title ||
      group?.directPeer?.fullName ||
      group?.member_count ||
      routeGroup?.name ||
      routeGroup?.title,
  );

  const groupMembers = useMemo(() => {
    if (Array.isArray(group?.members)) return group.members;
    if (Array.isArray(routeGroup?.members)) return routeGroup.members;
    return [];
  }, [group?.members, routeGroup?.members]);

  const memberCount = useMemo(() => {
    if (typeof group?.member_count === "number") return group.member_count;
    if (Array.isArray(group?.member_ids)) return group.member_ids.length;
    if (Array.isArray(groupMembers)) return groupMembers.length;
    return 0;
  }, [group?.member_count, group?.member_ids, groupMembers]);

  const avatarStack = useMemo(() => {
    const source = groupMembers.length > 0 ? groupMembers : [];
    return source
      .slice(0, 3)
      .map((member, index) => ({
        key: String(member?.id || member?.contact_id || index),
        name:
          member?.name ||
          member?.full_name ||
          member?.fullName ||
          member?.email ||
          member?.phone ||
          "Member",
        uri:
          member?.avatar_url ||
          member?.avatar ||
          member?.profileImage ||
          member?.profile_image ||
          "",
      }));
  }, [groupMembers]);

  const groupName = group?.name || group?.title || tr("group_chat", "Group Chat");

  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [typingLabel, setTypingLabel] = useState("");
  const [isPeerTyping, setIsPeerTyping] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [markConversationRead] = useMadbelMarkConversationReadMutation();
  const [createMessage] = useMadbelCreateMessageMutation();
  const [setTypingState] = useMadbelSetTypingStateMutation();
  const [transcribeVoice, { isLoading: isTranscribing }] =
    useMadbelTranscribeVoiceMutation();

  const recorder = useAudioRecorder(RecordingPresets.LOW_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 250);
  const typingTimeoutRef = useRef(null);
  const selfTypingTimeoutRef = useRef(null);
  const scrollTimeoutRef = useRef(null);
  const flatListRef = useRef(null);
  const isSelfTypingRef = useRef(false);

  const {
    data: messagesResponse,
    isLoading: isInitialMessagesLoading,
    isFetching: isRefreshingMessages,
    isError: isMessagesError,
  } = useMadbelListMessagesQuery(
    { conversation_id: threadId, page: 1, page_size: 100 },
    { skip: !threadId },
  );

  useSocket({
    threadId,
    enabled: Boolean(threadId),
    onMessage: (incoming) => {
      const payload = incoming?.data || incoming;
      if (
        payload?.conversation_id &&
        String(payload.conversation_id) !== String(threadId)
      ) {
        return;
      }
      const normalized = normalizeMessage(payload, myUserId);
      setMessages((prev) => upsertMessages(prev, normalized));
    },
  });

  useEffect(() => {
    if (!threadId) return undefined;

    const handleMembershipRemoved = (payload) => {
      if (String(payload?.user_id || "") !== String(myUserId || "")) return;
      const conversationId = String(payload?.channel || payload?.conversation_id || "");
      if (conversationId && conversationId !== String(threadId)) return;
      Alert.alert(
        tr("access_removed", "Access removed"),
        tr(
          "you_no_longer_have_access_to_this_group_chat",
          "You no longer have access to this group chat.",
        ),
        [{ text: tr("ok", "OK"), onPress: () => navigation.goBack() }],
      );
    };

    const handleMembershipAdded = (payload) => {
      if (String(payload?.user_id || "") !== String(myUserId || "")) return;
      const conversationId = String(payload?.channel || payload?.conversation_id || "");
      if (conversationId && conversationId !== String(threadId)) return;
      markConversationRead({ conversation_id: threadId }).catch(() => null);
    };

    const offRemoved = addEventListener("global_member.removed", handleMembershipRemoved);
    const offAdded = addEventListener("global_member.added", handleMembershipAdded);
    return () => {
      offRemoved?.();
      offAdded?.();
    };
  }, [markConversationRead, myUserId, navigation, threadId, tr]);

  useEffect(() => {
    const rawMessages =
      messagesResponse?.data?.items ||
      messagesResponse?.data ||
      messagesResponse?.messages ||
      [];
    const next = Array.isArray(rawMessages)
      ? rawMessages
          .map((item) => normalizeMessage(item, myUserId))
          .sort((a, b) => getMessageTimestamp(a) - getMessageTimestamp(b))
      : [];
    setMessages(next);
  }, [messagesResponse, myUserId]);

  useEffect(() => {
    if (!threadId) return;
    markConversationRead({ conversation_id: threadId }).catch(() => null);
  }, [markConversationRead, threadId]);

  useEffect(() => {
    const handler = (payload) => {
      const conversationId = String(
        payload?.conversation_id || payload?.conversationId || "",
      );
      if (conversationId && String(threadId) !== conversationId) return;

      const actorId = String(
        payload?.user_id ||
          payload?.actor_id ||
          payload?.senderUserId ||
          payload?.sender_user_id ||
          "",
      );
      if (actorId && actorId === String(myUserId || "")) return;

      const isTyping = Boolean(payload?.is_typing);
      setIsPeerTyping(isTyping);
      setTypingLabel(
        payload?.user_name ||
          payload?.userName ||
          payload?.sender_name ||
          payload?.senderName ||
          payload?.name ||
          "",
      );

      if (isTyping) {
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        typingTimeoutRef.current = setTimeout(() => {
          setIsPeerTyping(false);
          setTypingLabel("");
        }, 6000);
      }
    };

    addEventListener("chat:typing:updated", handler);
    return () => {
      removeEventListener("chat:typing:updated", handler);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [myUserId, threadId]);

  useEffect(() => {
    return () => {
      if (selfTypingTimeoutRef.current) {
        clearTimeout(selfTypingTimeoutRef.current);
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  const orderedMessages = useMemo(
    () =>
      [...messages].sort((a, b) => getMessageTimestamp(a) - getMessageTimestamp(b)),
    [messages],
  );

  useEffect(() => {
    if (!flatListRef.current || orderedMessages.length === 0) return;

    scrollTimeoutRef.current = setTimeout(() => {
      flatListRef.current?.scrollToEnd?.({ animated: true });
    }, 50);

    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = null;
      }
    };
  }, [orderedMessages]);

  const handleTextChange = useCallback(
    (text) => {
      setMessage(text);
      if (!threadId) return;

      if (text.length > 0 && !isSelfTypingRef.current) {
        isSelfTypingRef.current = true;
        setTypingState({
          conversation_id: threadId,
          is_typing: true,
          actor_type: "user",
        }).catch(() => null);
      }

      if (selfTypingTimeoutRef.current) {
        clearTimeout(selfTypingTimeoutRef.current);
      }

      selfTypingTimeoutRef.current = setTimeout(() => {
        isSelfTypingRef.current = false;
        setTypingState({
          conversation_id: threadId,
          is_typing: false,
          actor_type: "user",
        }).catch(() => null);
      }, 2500);
    },
    [setTypingState, threadId],
  );

  const stopSelfTyping = useCallback(() => {
    if (isSelfTypingRef.current) {
      isSelfTypingRef.current = false;
      if (selfTypingTimeoutRef.current) {
        clearTimeout(selfTypingTimeoutRef.current);
      }
      setTypingState({
        conversation_id: threadId,
        is_typing: false,
        actor_type: "user",
      }).catch(() => null);
    }
  }, [setTypingState, threadId]);

  const onSend = useCallback(async () => {
    const text = message.trim();
    if (!text || !threadId || isSending) return;

    setMessage("");
    stopSelfTyping();
    setIsSending(true);

    try {
      const result = await createMessage({
        conversation_id: threadId,
        content: text,
        platform: "ai",
        direction: "outbound",
      }).unwrap();

      const created = result?.data?.message || result?.data || result?.message || result;
      if (created?._id || created?.id) {
        setMessages((prev) =>
          upsertMessages(prev, normalizeMessage(created, myUserId)),
        );
      }
    } catch (error) {
      console.log("Failed to send message:", error);
      setMessage(text);
      Alert.alert(
        tr("error", "Error"),
        error?.data?.message || error?.message || tr("could_not_send_message", "Could not send message."),
      );
    } finally {
      setIsSending(false);
    }
  }, [createMessage, isSending, message, myUserId, stopSelfTyping, threadId, tr]);

  const handleRecordButtonPress = async () => {
    if (recorderState?.isRecording) {
      try {
        await recorder.stop();
        const uri = recorder.uri || recorder.getStatus?.()?.uri;
        if (uri) {
          const response = await fetch(uri);
          const blob = await response.blob();

          const audioBase64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              const result = String(reader.result || "");
              resolve(result.split(",")[1] || "");
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });

          const result = await transcribeVoice({
            audio_base64: audioBase64,
            audio_filename: `group-chat-${Date.now()}.m4a`,
            audio_mime_type: "audio/m4a",
          }).unwrap();

          const transcript = result?.data?.transcript || result?.transcript;
          if (transcript) {
            setMessage((prev) => (prev ? `${prev} ${transcript}` : transcript));
          }
        }
      } catch {
        // keep the UI quiet on voice failures
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
      } catch {
        // keep the UI quiet on voice failures
      }
    }
  };

  const renderAttachment = (item) => {
    const mediaUrl =
      item?.raw?.media_url ||
      item?.raw?.mediaUrl ||
      item?.raw?.attachment_url ||
      "";

    if (!mediaUrl) return null;

    if (isImageUrl(mediaUrl)) {
      return <Image source={{ uri: mediaUrl }} style={styles.imageAttachment} />;
    }

    return (
      <View style={styles.fileCard}>
        <View style={styles.fileIconWrap}>
          <FileText size={18} color="#FF626E" />
        </View>
        <View style={styles.fileInfo}>
          <Text style={styles.fileName} numberOfLines={1}>
            {item?.raw?.file_name || item?.raw?.fileName || "Attachment"}
          </Text>
          <Text style={styles.fileSize} numberOfLines={1}>
            {isPdfUrl(mediaUrl) ? "PDF" : "File"}
          </Text>
        </View>
      </View>
    );
  };

  const renderMessageItem = ({ item, index }) => {
    const isMe = item.sender === "me";
    const previous = orderedMessages[index - 1];
    const showDateSeparator =
      index === 0 ||
      new Date(item?.raw?.createdAt || 0).toDateString() !==
        new Date(previous?.raw?.createdAt || 0).toDateString();

    return (
      <View style={styles.messageWrap}>
              {showDateSeparator && item?.time ? (
          <View style={styles.dateSeparator}>
            <Text style={styles.dateSeparatorText}>
              {new Date(item?.raw?.createdAt || Date.now()).toDateString() ===
              new Date().toDateString()
                ? tr("today", "Today")
                : new Date(item?.raw?.createdAt || Date.now())
                    .toLocaleDateString([], {
                      month: "short",
                      day: "2-digit",
                      year: "numeric",
                    })
                    .toUpperCase()}
            </Text>
          </View>
        ) : null}

        {!isMe ? <Text style={styles.senderName}>{item.senderName}</Text> : null}

        <View style={[styles.row, isMe ? styles.rowMe : styles.rowThem]}>
          {!isMe ? (
            <View style={styles.avatarColumn}>
              <Avatar uri={item.senderAvatar} name={item.senderName} size={34} />
            </View>
          ) : (
            <View style={styles.avatarColumn} />
          )}

          <View style={[styles.bubbleColumn, isMe ? styles.bubbleColumnMe : styles.bubbleColumnThem]}>
            <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
              <MentionText
                text={item.text}
                style={[styles.messageText, isMe ? styles.messageTextMe : styles.messageTextThem]}
                mentionStyle={[styles.messageText, styles.mentionText]}
              />
            </View>
            {renderAttachment(item)}
            <Text style={[styles.timeText, isMe ? styles.timeTextMe : styles.timeTextThem]}>
              {item.time}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const composerDisabled = !threadId || isSending;
  const subtitleCount = `${memberCount} ${tr("members", "Members")}`;

  if ((isGroupLoading || isGroupFetching) && !hasGroupIdentity) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <ActivityIndicator color="#18CBEA" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? headerHeight : 0}
      >
        <View
          style={styles.header}
          onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height)}
        >
          <Pressable style={styles.iconButton} onPress={() => navigation.goBack()}>
            <ChevronLeft size={30} color="#F3F7FF" strokeWidth={2.4} />
          </Pressable>

          <Pressable
            style={styles.headerCenter}
            onPress={() => navigation.navigate("GroupSetting", { group })}
          >
            <Text style={styles.headerTitle} numberOfLines={1}>
              {groupName}
            </Text>
            <View style={styles.headerMetaRow}>
              <Text style={styles.headerSubtitle}>{subtitleCount}</Text>
              <View style={styles.avatarStack}>
                {avatarStack.length > 0 ? (
                  avatarStack.map((member, index) => (
                    <View
                      key={member.key}
                      style={[
                        styles.stackAvatarWrap,
                        { marginLeft: index === 0 ? 0 : -10 },
                      ]}
                    >
                      <Avatar uri={member.uri} name={member.name} size={24} />
                    </View>
                  ))
                ) : (
                  <View style={styles.stackFallback}>
                    <Users size={12} color="#0A1220" />
                  </View>
                )}
              </View>
            </View>
          </Pressable>

          <Pressable
            style={styles.iconButton}
            onPress={() => navigation.navigate("GroupSetting", { group })}
          >
            <Info size={26} color="#A7B0C2" strokeWidth={2.2} />
          </Pressable>
        </View>

        {isInitialMessagesLoading && orderedMessages.length === 0 ? (
          <View style={styles.center}>
            <ActivityIndicator color="#18CBEA" />
            <Text style={styles.loadingText}>{tr("loading_chat", "Loading chat")}</Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={orderedMessages}
            renderItem={renderMessageItem}
            keyExtractor={(item) => String(item.id)}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>{groupName}</Text>
                <Text style={styles.emptyText}>
                  {isMessagesError
                    ? tr("failed_to_load_messages", "Failed to load messages.")
                    : tr(
                        "no_messages_yet_start_the_conversation",
                        "No messages yet. Start the conversation.",
                      )}
                </Text>
              </View>
            }
            ListFooterComponent={
              <View style={styles.footerExtras}>
                {isPeerTyping ? (
                  <Text style={styles.typingText}>
                    {typingLabel
                      ? `${typingLabel} ${tr("is_typing", "is typing")}`
                      : tr("someone_is_typing", "Someone is typing...")}
                  </Text>
                ) : null}
                {isRefreshingMessages && orderedMessages.length > 0 ? (
                  <Text style={styles.refreshText}>
                    {tr("refreshing", "Refreshing")}
                  </Text>
                ) : null}
              </View>
            }
            onContentSizeChange={() => {
              if (orderedMessages.length > 0) {
                flatListRef.current?.scrollToEnd?.({ animated: true });
              }
            }}
          />
        )}

        <View
          style={[
            styles.composer,
            {
              paddingBottom: insets.bottom + responsiveHeight(5),
            },
          ]}
        >
          {/* <Avatar uri={authUser?.avatar || authUser?.profile_image} name={authUser?.full_name || authUser?.name || "M"} size={40} /> */}

          <View style={styles.inputShell}>
            <TextInput
              value={message}
              onChangeText={handleTextChange}
              placeholder={tr("type_a_message", "Type a message...")}
              placeholderTextColor="#5A667B"
              style={styles.input}
              editable={!composerDisabled}
              multiline={false}
              returnKeyType="send"
              onSubmitEditing={onSend}
            />
            {/* <Pressable
              onPress={handleRecordButtonPress}
              disabled={composerDisabled || isTranscribing}
              style={styles.micButton}
              hitSlop={8}
            >
              {isTranscribing ? (
                <ActivityIndicator size="small" color="#8FA4BA" />
              ) : recorderState?.isRecording ? (
                <MicOff size={20} color="#FF5E6C" />
              ) : (
                <Mic size={20} color="#8B96A8" />
              )}
            </Pressable> */}
          </View>

          <Pressable
            onPress={onSend}
            disabled={!message.trim() || composerDisabled}
            style={({ pressed }) => [
              styles.sendButton,
              (!message.trim() || composerDisabled) && styles.sendButtonDisabled,
              pressed && message.trim() && !composerDisabled && styles.sendButtonPressed,
            ]}
          >
            {isSending ? (
              <ActivityIndicator size="small" color="#02131B" />
            ) : (
              <Send size={18} color="#02131B" strokeWidth={2.8} />
            )}
          </Pressable>
        </View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#020406",
  },
  container: {
    flex: 1,
    backgroundColor: "#020406",
    paddingHorizontal: responsiveWidth(4.2),
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: responsiveHeight(0.6),
    paddingBottom: responsiveHeight(1.4),
    borderBottomWidth: 1,
    borderBottomColor: "#151B24",
  },
  iconButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flex: 1,
    paddingHorizontal: 8,
    alignItems: "flex-start",
  },
  headerTitle: {
    color: "#F4F7FF",
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 26,
  },
  headerMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 2,
  },
  headerSubtitle: {
    color: "#97A2B5",
    fontSize: 13,
    fontWeight: "500",
  },
  avatarStack: {
    flexDirection: "row",
    alignItems: "center",
  },
  stackAvatarWrap: {
    borderWidth: 1.5,
    borderColor: "#020406",
    borderRadius: 999,
  },
  stackFallback: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#18CBEA",
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    paddingTop: responsiveHeight(2),
    paddingBottom: responsiveHeight(2),
    flexGrow: 1,
  },
  messageWrap: {
    marginBottom: responsiveHeight(1.8),
  },
  dateSeparator: {
    alignItems: "center",
    marginBottom: responsiveHeight(1.4),
  },
  dateSeparatorText: {
    color: "#7D899B",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1,
  },
  senderName: {
    color: "#9FA8B8",
    fontSize: 13,
    fontWeight: "600",
    marginLeft: responsiveWidth(2),
    marginBottom: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  rowThem: {
    justifyContent: "flex-start",
  },
  rowMe: {
    justifyContent: "flex-end",
  },
  avatarColumn: {
    width: 42,
    marginRight: 8,
  },
  bubbleColumn: {
    maxWidth: "82%",
  },
  bubbleColumnThem: {
    alignItems: "flex-start",
  },
  bubbleColumnMe: {
    alignItems: "flex-end",
  },
  bubble: {
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  bubbleThem: {
    backgroundColor: "#1C2230",
    borderTopLeftRadius: 6,
  },
  bubbleMe: {
    backgroundColor: "#18CBEA",
    borderTopRightRadius: 6,
    shadowColor: "#18CBEA",
    shadowOpacity: 0.24,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 12,
    elevation: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 24,
  },
  messageTextThem: {
    color: "#E8EEF7",
  },
  messageTextMe: {
    color: "#021017",
    fontWeight: "600",
  },
  mentionText: {
    color: "#7C5CFF",
  },
  timeText: {
    marginTop: 6,
    fontSize: 11,
    color: "#7A8596",
  },
  timeTextMe: {
    textAlign: "right",
    marginRight: 2,
  },
  timeTextThem: {
    textAlign: "left",
    marginLeft: 2,
  },
  imageAttachment: {
    width: responsiveWidth(72),
    height: responsiveWidth(44),
    borderRadius: 18,
    marginTop: 8,
    backgroundColor: "#1C2230",
  },
  fileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 8,
    width: responsiveWidth(72),
    borderRadius: 18,
    backgroundColor: "#1C2230",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  fileIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#2A1420",
    alignItems: "center",
    justifyContent: "center",
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    color: "#F1F5FB",
    fontSize: 14,
    fontWeight: "600",
  },
  fileSize: {
    marginTop: 2,
    color: "#90A0B6",
    fontSize: 12,
  },
  footerExtras: {
    paddingTop: 6,
    paddingBottom: 12,
  },
  typingText: {
    color: "#9AA6B7",
    fontSize: 13,
    fontWeight: "500",
    paddingLeft: responsiveWidth(1),
  },
  refreshText: {
    color: "#7ADDEE",
    fontSize: 12,
    marginTop: 6,
    paddingLeft: responsiveWidth(1),
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: responsiveHeight(10),
  },
  emptyTitle: {
    color: "#F3F7FF",
    fontSize: 20,
    fontWeight: "800",
  },
  emptyText: {
    color: "#8593A7",
    fontSize: 14,
    textAlign: "center",
    marginTop: 8,
  },
  loadingText: {
    color: "#8593A7",
    fontSize: 14,
    marginTop: 10,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  composer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingTop: responsiveHeight(1.2),
    paddingBottom: responsiveHeight(1.2),
    borderTopWidth: 1,
    borderTopColor: "#151B24",
    backgroundColor: "#020406",
  },
  inputShell: {
    flex: 1,
    minHeight: 56,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "#2A3140",
    backgroundColor: "#111826",
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 18,
    paddingRight: 8,
  },
  input: {
    flex: 1,
    color: "#EAF1FA",
    fontSize: 15,
    paddingVertical: 0,
    includeFontPadding: false,
  },
  micButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#131B27",
    marginLeft: 8,
  },
  sendButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#18CBEA",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#18CBEA",
    shadowOpacity: 0.32,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 12,
    elevation: 6,
  },
  sendButtonPressed: {
    transform: [{ scale: 0.98 }],
  },
  sendButtonDisabled: {
    backgroundColor: "#2A3140",
    shadowOpacity: 0,
  },
  avatarBase: {
    overflow: "hidden",
  },
  avatarImage: {
    backgroundColor: "#192332",
  },
  avatarFallback: {
    backgroundColor: "#192332",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarFallbackText: {
    color: "#21D4EE",
    fontWeight: "800",
  },
});

export default GroupChatScreen;
