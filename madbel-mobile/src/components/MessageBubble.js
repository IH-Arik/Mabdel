import React from "react";
import { View, Text, Image, Pressable, StyleSheet } from "react-native";

const STATUS_TICKS = {
  sent:      { symbol: "✓",  color: "#5D6A7A" },
  delivered: { symbol: "✓✓", color: "#5D6A7A" },
  read:      { symbol: "✓✓", color: "#17CBE8" },
};

const MessageBubble = ({
  message,
  isMe,
  showAvatar = true,
  showSenderName = false,
  avatar,
  senderName,
  isLastInGroup = false,
  onLongPress,
}) => {
  const status = message?.raw?.status || message?.status || null;
  const tick = isMe && isLastInGroup ? (STATUS_TICKS[status] || STATUS_TICKS.sent) : null;

  const replyPreview = message?.raw?.reply_to_message_preview || message?.replyPreview || null;
  const forwardFrom  = message?.raw?.forward_from_message_preview || message?.forwardPreview || null;

  return (
    <Pressable
      onLongPress={onLongPress}
      delayLongPress={350}
      style={[styles.row, isMe ? styles.rowMe : styles.rowThem]}
    >
      {!isMe && (
        <View style={styles.avatarSlot}>
          {showAvatar ? (
            <Image
              source={{ uri: avatar || "https://robohash.org/user.png" }}
              style={styles.avatar}
            />
          ) : null}
        </View>
      )}

      <View style={[styles.bubbleWrap, isMe ? styles.bubbleWrapMe : styles.bubbleWrapThem]}>
        {!isMe && showSenderName && senderName ? (
          <Text style={styles.senderName}>{senderName}</Text>
        ) : null}

        <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
          {/* Reply quote */}
          {replyPreview ? (
            <View style={[styles.quoteBar, isMe ? styles.quoteBarMe : styles.quoteBarThem]}>
              <Text style={[styles.quoteText, isMe ? styles.quoteTextMe : styles.quoteTextThem]} numberOfLines={2}>
                {replyPreview}
              </Text>
            </View>
          ) : null}

          {/* Forward label */}
          {forwardFrom ? (
            <Text style={[styles.forwardLabel, isMe ? styles.forwardLabelMe : styles.forwardLabelThem]}>
              ↪ Forwarded
            </Text>
          ) : null}

          <Text style={[styles.text, isMe ? styles.textMe : styles.textThem]}>
            {message.text}
          </Text>
        </View>

        {/* Timestamp row */}
        <View style={[styles.metaRow, isMe ? styles.metaRowMe : styles.metaRowThem]}>
          {message?.time ? (
            <Text style={styles.timeText}>{message.time}</Text>
          ) : null}
          {tick ? (
            <Text style={[styles.tickText, { color: tick.color }]}>{tick.symbol}</Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    marginBottom: 8,
    alignItems: "flex-end",
  },
  rowMe: {
    justifyContent: "flex-end",
  },
  rowThem: {
    justifyContent: "flex-start",
  },
  avatarSlot: {
    width: 34,
    height: 34,
    marginRight: 8,
    alignSelf: "flex-end",
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  bubbleWrap: {
    maxWidth: "75%",
  },
  bubbleWrapMe: {
    alignItems: "flex-end",
  },
  bubbleWrapThem: {
    alignItems: "flex-start",
  },
  senderName: {
    fontSize: 11,
    color: "#7A8FA0",
    marginBottom: 3,
    marginLeft: 4,
  },
  bubble: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  bubbleMe: {
    backgroundColor: "#17CBE8",
    borderBottomRightRadius: 4,
  },
  bubbleThem: {
    backgroundColor: "#2D3340",
    borderBottomLeftRadius: 4,
  },
  quoteBar: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 6,
  },
  quoteBarMe: {
    backgroundColor: "rgba(0,0,0,0.15)",
    borderLeftWidth: 3,
    borderLeftColor: "rgba(0,0,0,0.3)",
  },
  quoteBarThem: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderLeftWidth: 3,
    borderLeftColor: "#17CBE8",
  },
  quoteText: {
    fontSize: 13,
    lineHeight: 18,
  },
  quoteTextMe: {
    color: "rgba(0,0,0,0.7)",
  },
  quoteTextThem: {
    color: "#A8B8C8",
  },
  forwardLabel: {
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 4,
  },
  forwardLabelMe: {
    color: "rgba(0,0,0,0.5)",
  },
  forwardLabelThem: {
    color: "#5D9AB0",
  },
  text: {
    fontSize: 16,
    lineHeight: 22,
  },
  textMe: {
    color: "#020406",
    fontWeight: "500",
  },
  textThem: {
    color: "#E8EFF7",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 3,
    gap: 4,
  },
  metaRowMe: {
    justifyContent: "flex-end",
    marginRight: 2,
  },
  metaRowThem: {
    justifyContent: "flex-start",
    marginLeft: 4,
  },
  timeText: {
    fontSize: 11,
    color: "#5D6A7A",
  },
  tickText: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: -2,
  },
});

export default MessageBubble;
