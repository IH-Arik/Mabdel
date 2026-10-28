import React from "react";
import {
  View,
  Text,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import {
  responsiveHeight,
  responsiveWidth,
} from "react-native-responsive-dimensions";
import { useSingleChatLogic } from "./hooks/useSingleChatLogic";
import ChatHeader from "./components/ChatHeader";
import ReplyPreviewBar from "./components/ReplyPreviewBar";
import SupportSuggestions from "./components/SupportSuggestions";
import VoiceNoteReview from "./components/VoiceNoteReview";
import ChatTextInputRow from "./components/ChatTextInputRow";
import ForwardMessageModal from "./components/ForwardMessageModal";
import ChatEmptyState from "./components/ChatEmptyState";
import ChatMessageItem from "./components/ChatMessageItem";

const SingleChatScreen = () => {
  const {
    navigation,
    t,
    insets,
    group,
    threadId,

    message,
    setMessage,
    orderedMessages,
    peerIsTyping,
    peerIsOnline,
    replyToMessage,
    setReplyToMessage,
    forwardModalVisible,
    setForwardModalVisible,
    headerHeight,
    setHeaderHeight,

    recordedUri,

    isSending,
    allThreads,

    recorderState,

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
    handleTogglePreviewPlayback,
    discardRecording,
    handleSendVoiceMessage,

    inputDisabled,
    headerName,
    shouldShowSuggestions,
    isGroupChat,
    previewProgressPercent,
    previewTimeLabelMs,
    recordingElapsedMs,
  } = useSingleChatLogic();

  const renderMessageItem = ({ item, index }) => (
    <ChatMessageItem
      item={item}
      index={index}
      orderedMessages={orderedMessages}
      avatar={currentConversation.avatar}
      onLongPress={handleLongPressMessage}
      t={t}
    />
  );

  const renderEmptyComponent = () => (
    <ChatEmptyState
      currentConversation={currentConversation}
      isThreadError={isThreadError}
      t={t}
    />
  );

  return (
    <View style={{ flex: 1, backgroundColor: "#020406" }}>
      <ChatHeader
        onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
        onBackPress={() => navigation.goBack()}
        headerName={headerName}
        peerIsOnline={peerIsOnline}
        peerIsTyping={peerIsTyping}
        isGroupChat={isGroupChat}
        onGroupSettingPress={() => navigation.navigate("GroupSetting", { group })}
        t={t}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === "ios" ? headerHeight : 0}
      >
        <View style={{ flex: 1 }}>
          {isInitialMessagesLoading && orderedMessages.length === 0 ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="small" color="#71ABE0" />
              <Text className="text-gray-500 mt-2">{t("loading_chat")}</Text>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={orderedMessages}
              renderItem={renderMessageItem}
              keyExtractor={(item) => String(item.id)}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                flexGrow: 1,
                paddingHorizontal: 16,
                paddingVertical: 16,
              }}
              ListEmptyComponent={renderEmptyComponent}
              onContentSizeChange={() => {
                if (orderedMessages.length > 0) {
                  flatListRef.current?.scrollToEnd?.({ animated: true });
                }
              }}
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
            paddingBottom: insets.bottom + responsiveHeight(6),
          }}
        >
          <ReplyPreviewBar
            replyToMessage={replyToMessage}
            currentConversation={currentConversation}
            onDismiss={() => setReplyToMessage(null)}
            t={t}
          />

          <SupportSuggestions
            visible={shouldShowSuggestions && !recordedUri && !recorderState?.isRecording}
            onSelect={(item) => setMessage(item)}
            t={t}
          />

          {/* My avatar + input row */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-end",
              gap: responsiveWidth(2),
            }}
          >
            {recordedUri ? (
              <VoiceNoteReview
                onDiscard={discardRecording}
                isSendingVoiceMessage={isSendingVoiceMessage}
                onTogglePreviewPlayback={handleTogglePreviewPlayback}
                previewPlayerStatus={previewPlayerStatus}
                previewProgressPercent={previewProgressPercent}
                previewTimeLabelMs={previewTimeLabelMs}
                onSend={handleSendVoiceMessage}
              />
            ) : (
              <ChatTextInputRow
                recorderState={recorderState}
                recordingElapsedMs={recordingElapsedMs}
                message={message}
                onChangeText={handleTextChange}
                threadId={threadId}
                inputDisabled={inputDisabled}
                onSendPress={() => sendMessage()}
                isSending={isSending}
                t={t}
              />
            )}
          </View>
        </View>
      </KeyboardAvoidingView>

      {isRefreshingMessages && orderedMessages.length > 0 ? (
        <View
          style={{
            position: "absolute",
            top: headerHeight + responsiveHeight(2),
            alignSelf: "center",
            backgroundColor: "rgba(18, 20, 26, 0.9)",
            borderRadius: 999,
            paddingHorizontal: 12,
            paddingVertical: 6,
          }}
        >
          <Text style={{ color: "#8FA3B8", fontSize: 11 }}>Refreshing...</Text>
        </View>
      ) : null}

      <ForwardMessageModal
        visible={forwardModalVisible}
        onClose={() => setForwardModalVisible(false)}
        insets={insets}
        allThreads={allThreads}
        threadId={threadId}
        onForwardTo={handleForwardTo}
        t={t}
      />
    </View>
  );
};

export default SingleChatScreen;
