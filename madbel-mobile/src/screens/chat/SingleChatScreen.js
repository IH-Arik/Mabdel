import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  TextInput,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
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
import {
  responsiveHeight,
  responsiveWidth,
} from "react-native-responsive-dimensions";
import {
  useFetchMessagesQuery,
  useMarkThreadSeenMutation,
  useSendMessageMutation,
} from "../../redux/slices/chat/chatSlice";
import { useMadbelTranscribeVoiceMutation } from "../../redux/slices/madbelApiSlice";
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
  "Billing Issue",
  "Technical Help",
  "Account Problem",
];

const SingleChatScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
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
  const [sendMessageMutation, { isLoading: isSending }] = useSendMessageMutation();
  const [markThreadSeen] = useMarkThreadSeenMutation();

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
    name: "Chat",
    avatar: "https://robohash.org/user.png",
  };

  const groupConversation = group
    ? {
        name: group?.name || "Group Chat",
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

    setMessage("");

    try {
      const result = await sendMessageMutation({
        threadId,
        type: "text",
        text,
      }).unwrap();

      const created = result?.message || result;
      if (created?._id) {
        const uiMessage = toUiMessage(created, myUserId);
        setMessages((prev) => upsertMessages(prev, uiMessage));
      }
    } catch (error) {
      setMessage(text);
      console.log("Failed to send message:", error);
    }
  };

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
        console.log("Transcription failed:", error);
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
        console.log("Failed to start recording:", error);
      }
    }
  };

  const renderMessageItem = ({ item, index }) => {
    const isMe = item.sender === "me";
    const showAvatar = !isMe && (index === 0 || messages[index - 1]?.sender === "me");
    return (
      <MessageBubble
        message={item}
        isMe={isMe}
        showAvatar={showAvatar}
        avatar={currentConversation.avatar}
      />
    );
  };

  const renderEmptyComponent = () => (
    <View className="flex-1 justify-center items-center px-8">
      <Image
        source={{ uri: currentConversation.avatar }}
        className="w-20 h-20 rounded-full mb-4"
      />
      <Text className="text-xl font-semibold text-white mb-1">
        {currentConversation.name}
      </Text>
      <Text className="text-gray-500 text-lg text-center mb-2">
        {isThreadError ? "Failed to load messages" : "No messages yet"}
      </Text>
      <Text className="text-gray-400 text-center text-base">
        Send a message to start the conversation.
      </Text>
    </View>
  );

  const inputDisabled = !threadId || isSending;

  const headerName = useMemo(
    () => currentConversation?.name || "Chat",
    [currentConversation?.name],
  );
  const shouldShowSuggestions =
    String(headerName || "").toLowerCase() === "live support";
  const isGroupChat = Boolean(group);

  return (
    <SafeAreaView className="flex-1 bg-[#020406]">
      <View
        className="flex-row items-center justify-between border-b border-border"
        style={{ padding: responsiveWidth(2) }}
      >
        <Pressable onPress={() => navigation.goBack()} className="p-2">
          <ChevronLeft size={22} color="#fff" />
        </Pressable>
        <View className="flex-row items-center">
          <Image
            source={{ uri: currentConversation.avatar }}
            className="w-8 h-8 rounded-full mr-2"
          />
          <View>
            <Text className="text-lg text-white font-semibold">{headerName}</Text>
            <Text className="text-gray-600">Active now</Text>
          </View>
        </View>
        {isGroupChat ? (
          <Pressable
            className="p-2"
            onPress={() => {
              navigation.navigate("GroupSetting", { group });
            }}
          >
            <Ellipsis color="#fff" />
          </Pressable>
        ) : (
          <View className="p-2" />
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
              <Text className="text-gray-500 mt-2">Loading chat...</Text>
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
          className="bg-gray-900"
          style={{
            paddingHorizontal: responsiveWidth(3),
            paddingVertical: responsiveHeight(1),
            paddingBottom: responsiveHeight(10),
          }}
        >
          {shouldShowSuggestions && (
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
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
                  <Text
                    style={{
                      color: "#D5DEE9",
                      fontSize: 13,
                      fontWeight: "500",
                      textAlign: "center",
                    }}
                  >
                    {item}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
          <View className="flex-row items-center">
            <TextInput
              className={`flex-1 border ${
                message.trim() ? "border-primary" : "border-border"
              } rounded-xl px-4 py-3 text-base text-white`}
              placeholder={threadId ? "Type something..." : "Chat unavailable"}
              placeholderTextColor="#9CA3AF"
              value={message}
              onChangeText={setMessage}
              multiline
              maxLength={500}
              editable={!inputDisabled}
            />
            <Pressable
              className={`ml-2 border rounded-xl p-3 ${
                recorderState?.isRecording ? "border-red-500 bg-red-500/10" : "border-border"
              }`}
              onPress={handleRecordButtonPress}
              disabled={inputDisabled || isTranscribing}
            >
              {isTranscribing ? (
                <ActivityIndicator size="small" color="#71ABE0" />
              ) : recorderState?.isRecording ? (
                <MicOff size={20} color="#EF4444" />
              ) : (
                <Mic size={20} color="#9CA3AF" />
              )}
            </Pressable>
            <Pressable
              className={`ml-2 border rounded-xl p-3 ${
                message.trim() && !inputDisabled ? "border-primary" : "border-border"
              }`}
              onPress={sendMessage}
              disabled={!message.trim() || inputDisabled}
            >
              {isSending ? (
                <ActivityIndicator size="small" color="#71ABE0" />
              ) : (
                <Send
                  size={20}
                  color={message.trim() && !inputDisabled ? "#71ABE0" : "#9CA3AF"}
                />
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>

    </SafeAreaView>
  );
};

export default SingleChatScreen;
