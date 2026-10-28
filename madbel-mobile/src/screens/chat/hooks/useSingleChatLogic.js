import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
  useAudioPlayer,
  useAudioPlayerStatus,
} from "expo-audio";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSelector } from "react-redux";
import { useAppLanguage } from "../../../context/LanguageContext";
import {
  useFetchConversationsQuery,
  useFetchMessagesQuery,
  useMarkThreadSeenMutation,
  useSendMessageMutation,
} from "../../../redux/slices/chat/chatSlice";
import { useMadbelTranscribeVoiceMutation } from "../../../redux/slices/madbelApiSlice";
import {
  useMadbelSetTypingStateMutation,
  useMadbelReplyToMessageMutation,
  useMadbelForwardMessageMutation,
} from "../../../redux/slices/madbelSmartflowSlice";
import { addEventListener, removeEventListener } from "../../../utils/socket";
import useSocket from "../../../hooks/useSocket";
import {
  DEFAULT_HEADER_HEIGHT,
  getMessageSortTime,
  toUiMessage,
  upsertMessages,
} from "../chatHelpers";

export const useSingleChatLogic = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { t } = useAppLanguage();
  const insets = useSafeAreaInsets();
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
  const [peerIsOnline, setPeerIsOnline] = useState(
    Boolean(conversation?.isOnline),
  );
  const [replyToMessage, setReplyToMessage] = useState(null);
  const [forwardMessage, setForwardMessage] = useState(null);
  const [forwardModalVisible, setForwardModalVisible] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(DEFAULT_HEADER_HEIGHT);

  // --- Voice note review state ---
  const [recordedUri, setRecordedUri] = useState(null);
  const [recordedDurationMs, setRecordedDurationMs] = useState(0);
  const [recordingElapsedMs, setRecordingElapsedMs] = useState(0);
  const recordingStartRef = useRef(null);
  const recordingTimerRef = useRef(null);

  const selfTypingTimeoutRef = useRef(null);
  const peerTypingTimeoutRef = useRef(null);
  const isSelfTypingRef = useRef(false);
  const [sendMessageMutation, { isLoading: isSending }] =
    useSendMessageMutation();
  const [markThreadSeen] = useMarkThreadSeenMutation();
  const [setTypingState] = useMadbelSetTypingStateMutation();
  const [replyToMessageMutation] = useMadbelReplyToMessageMutation();
  const [forwardMessageMutation] = useMadbelForwardMessageMutation();
  const { data: allThreads = [] } = useFetchConversationsQuery();

  const recorder = useAudioRecorder(RecordingPresets.LOW_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 250);
  const [transcribeVoice, { isLoading: isTranscribing }] =
    useMadbelTranscribeVoiceMutation();

  // Playback for reviewing the recorded clip before sending.
  const previewPlayer = useAudioPlayer(recordedUri || undefined);
  const previewPlayerStatus = useAudioPlayerStatus(previewPlayer);

  const isSendingVoiceMessage = isTranscribing || isSending;

  const {
    data: threadMessagesData,
    isLoading: isInitialMessagesLoading,
    isFetching: isRefreshingMessages,
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

  const orderedMessages = useMemo(
    () =>
      [...messages].sort((a, b) => getMessageSortTime(a) - getMessageSortTime(b)),
    [messages],
  );

  useEffect(() => {
    const apiMessages = threadMessagesData?.messages || [];
    const next = apiMessages
      .map((item) => toUiMessage(item, myUserId))
      .sort((a, b) => getMessageSortTime(a) - getMessageSortTime(b));
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
        if (peerTypingTimeoutRef.current) {
          clearTimeout(peerTypingTimeoutRef.current);
        }
        peerTypingTimeoutRef.current = setTimeout(
          () => setPeerIsTyping(false),
          8000,
        );
      }
    };
    addEventListener("chat:typing:updated", handler);
    return () => {
      removeEventListener("chat:typing:updated", handler);
      if (peerTypingTimeoutRef.current) {
        clearTimeout(peerTypingTimeoutRef.current);
      }
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
      }, 3000);
    },
    [threadId, setTypingState],
  );

  useEffect(
    () => () => {
      if (selfTypingTimeoutRef.current) {
        clearTimeout(selfTypingTimeoutRef.current);
      }
      if (peerTypingTimeoutRef.current) {
        clearTimeout(peerTypingTimeoutRef.current);
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    },
    [],
  );

  // sendMessage now optionally accepts overrideText so the voice-note
  // flow can reuse the exact same send path as typed messages.
  const sendMessage = async (overrideText) => {
    const text = (overrideText ?? message).trim();
    if (!text || !threadId || isSending) return;

    const pendingReply = replyToMessage;
    if (overrideText === undefined) {
      setMessage("");
      setReplyToMessage(null);
    }
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

    try {
      let created;
      if (pendingReply && overrideText === undefined) {
        const result = await replyToMessageMutation({
          message_id: pendingReply.id,
          content: text,
          platform: "ai",
        }).unwrap();
        created = result?.message || result;
      } else {
        const result = await sendMessageMutation({
          threadId,
          type: "text",
          text,
        }).unwrap();
        created = result?.message || result;
      }
      if (created?._id || created?.id) {
        setMessages((prev) =>
          upsertMessages(prev, toUiMessage(created, myUserId)),
        );
      }
    } catch {
      if (overrideText === undefined) {
        setMessage(text);
        if (pendingReply) setReplyToMessage(pendingReply);
      }
      throw new Error("send_failed");
    }
  };

  const handleLongPressMessage = useCallback(
    (item) => {
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
    },
    [t],
  );

  const handleForwardTo = useCallback(
    async (targetThreadId) => {
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
    },
    [forwardMessage, forwardMessageMutation, t],
  );

  // --- Recording controls ---

  const startRecordingTimer = () => {
    recordingStartRef.current = Date.now();
    setRecordingElapsedMs(0);
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    recordingTimerRef.current = setInterval(() => {
      setRecordingElapsedMs(Date.now() - (recordingStartRef.current || Date.now()));
    }, 250);
  };

  const stopRecordingTimer = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    const elapsed = recordingStartRef.current
      ? Date.now() - recordingStartRef.current
      : 0;
    recordingStartRef.current = null;
    setRecordingElapsedMs(0);
    return elapsed;
  };

  const handleRecordButtonPress = async () => {
    if (recorderState?.isRecording) {
      try {
        await recorder.stop();
        const finalDuration = stopRecordingTimer();
        const uri = recorder.uri;
        if (uri) {
          setRecordedUri(uri);
          setRecordedDurationMs(finalDuration);
        } else {
          Alert.alert(t("error"), t("could_not_save_recording"));
        }
      } catch (error) {
        stopRecordingTimer();
        Alert.alert(t("error"), t("could_not_stop_recording"));
      }
    } else {
      try {
        const permission = await requestRecordingPermissionsAsync();
        if (!permission.granted) {
          Alert.alert(
            t("microphone_permission_needed"),
            t("enable_mic_permission_in_settings"),
          );
          return;
        }
        await setAudioModeAsync({
          allowsRecording: true,
          playsInSilentMode: true,
          interruptionMode: "doNotMix",
          shouldPlayInBackground: false,
          shouldRouteThroughEarpiece: false,
        });
        await recorder.prepareToRecordAsync();
        recorder.record();
        startRecordingTimer();
      } catch (error) {
        Alert.alert(t("error"), t("could_not_start_recording"));
      }
    }
  };

  const handleTogglePreviewPlayback = () => {
    if (!recordedUri) return;
    if (previewPlayerStatus?.playing) {
      previewPlayer.pause();
    } else {
      previewPlayer.play();
    }
  };

  const discardRecording = useCallback(() => {
    try {
      previewPlayer.pause();
    } catch (error) {}
    setRecordedUri(null);
    setRecordedDurationMs(0);
  }, [previewPlayer]);

  const handleSendVoiceMessage = async () => {
    if (!recordedUri || !threadId || isSendingVoiceMessage) return;
    try {
      previewPlayer.pause();

      const fetchResponse = await fetch(recordedUri);
      const blob = await fetchResponse.blob();

      const audioBase64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const result = await transcribeVoice({
        audio_base64: audioBase64,
        audio_filename: `voice-${Date.now()}.m4a`,
        audio_mime_type: "audio/m4a",
      }).unwrap();

      const transcript = (result?.data || result)?.transcript;
      if (!transcript) {
        Alert.alert(t("error"), t("could_not_transcribe_voice"));
        return;
      }

      await sendMessage(transcript);
      discardRecording();
    } catch (error) {
      Alert.alert(t("error"), t("could_not_send_voice_message"));
    }
  };

  const inputDisabled = !threadId || isSending;

  const headerName = useMemo(
    () => currentConversation?.name || t("chat"),
    [currentConversation?.name, t],
  );
  const shouldShowSuggestions =
    String(headerName || "").toLowerCase() === "live support";
  const isGroupChat = Boolean(group);

  const previewProgressPercent = previewPlayerStatus?.duration
    ? Math.min(
        100,
        ((previewPlayerStatus?.currentTime || 0) / previewPlayerStatus.duration) * 100,
      )
    : 0;

  const previewTimeLabelMs = previewPlayerStatus?.playing
    ? (previewPlayerStatus?.currentTime || 0) * 1000
    : recordedDurationMs;

  return {
    navigation,
    t,
    insets,
    authUser,
    group,
    threadId,

    message,
    setMessage,
    orderedMessages,
    peerIsTyping,
    peerIsOnline,
    replyToMessage,
    setReplyToMessage,
    forwardMessage,
    forwardModalVisible,
    setForwardModalVisible,
    headerHeight,
    setHeaderHeight,

    recordedUri,
    recordedDurationMs,
    recordingElapsedMs,

    isSending,
    allThreads,

    recorderState,
    isTranscribing,

    previewPlayerStatus,
    isSendingVoiceMessage,

    isInitialMessagesLoading,
    isRefreshingMessages,
    isThreadError,

    flatListRef,

    currentConversation,

    handleTextChange,
    sendMessage,
    handleLongPressMessage,
    handleForwardTo,
    handleRecordButtonPress,
    handleTogglePreviewPlayback,
    discardRecording,
    handleSendVoiceMessage,

    inputDisabled,
    headerName,
    shouldShowSuggestions,
    isGroupChat,
    previewProgressPercent,
    previewTimeLabelMs,
  };
};
