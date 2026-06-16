import React from "react";
import { View, Text, Image, StyleSheet } from "react-native";

const MessageBubble = ({
  message,
  isMe,
  showAvatar = true,
  showSenderName = false,
  avatar,
  senderName,
  isLastInGroup = false,
}) => {
  const showReadReceipt = isMe && isLastInGroup && message?.time;

  return (
    <View style={[styles.row, isMe ? styles.rowMe : styles.rowThem]}>
      {/* Avatar for other users */}
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
          <Text style={[styles.text, isMe ? styles.textMe : styles.textThem]}>
            {message.text}
          </Text>
        </View>

        {showReadReceipt ? (
          <Text style={styles.readReceipt}>Read {message.time}</Text>
        ) : message?.time && isMe ? null : message?.time ? (
          <Text style={styles.timeThem}>{message.time}</Text>
        ) : null}
      </View>
    </View>
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
    paddingVertical: 12,
  },
  bubbleMe: {
    backgroundColor: "#17CBE8",
    borderBottomRightRadius: 4,
  },
  bubbleThem: {
    backgroundColor: "#2D3340",
    borderBottomLeftRadius: 4,
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
  readReceipt: {
    fontSize: 11,
    color: "#7A8FA0",
    marginTop: 4,
    marginRight: 2,
  },
  timeThem: {
    fontSize: 11,
    color: "#5D6A7A",
    marginTop: 3,
    marginLeft: 4,
  },
});

export default MessageBubble;
