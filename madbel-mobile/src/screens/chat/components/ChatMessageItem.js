import React from "react";
import { View, Text } from "react-native";
import MessageBubble from "../../../components/MessageBubble";

const ChatMessageItem = ({ item, index, orderedMessages, avatar, onLongPress, t }) => {
  const isMe = item.sender === "me";
  const showAvatar =
    !isMe && (index === 0 || orderedMessages[index - 1]?.sender === "me");
  const isLastInGroup =
    isMe &&
    (index === orderedMessages.length - 1 ||
      orderedMessages[index + 1]?.sender !== "me");

  const currentHasDate = Boolean(item?.raw?.createdAt);
  const prevItem = orderedMessages[index - 1];
  const prevHasDate = Boolean(prevItem?.raw?.createdAt);
  const showDateSeparator =
    currentHasDate &&
    (index === 0 ||
      !prevHasDate ||
      new Date(item.raw.createdAt).toDateString() !==
        new Date(prevItem.raw.createdAt).toDateString());

  return (
    <>
      {showDateSeparator && item?.time ? (
        <View style={{ alignItems: "center", marginVertical: 12 }}>
          <Text style={{ color: "#5D6A7A", fontSize: 12, fontWeight: "600" }}>
            {new Date(item.raw.createdAt).toDateString() === new Date().toDateString()
              ? `${t("today")}, ${item.time}`
              : new Date(item.raw.createdAt)
                  .toLocaleDateString([], {
                    month: "short",
                    day: "numeric",
                  })
                  .toUpperCase()}
          </Text>
        </View>
      ) : null}
      <MessageBubble
        message={item}
        isMe={isMe}
        showAvatar={showAvatar}
        isLastInGroup={isLastInGroup}
        avatar={avatar}
        onLongPress={() => {
          onLongPress(item);
        }}
      />
    </>
  );
};

export default ChatMessageItem;
