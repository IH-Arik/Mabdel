import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { responsiveWidth } from "react-native-responsive-dimensions";

const rw = (value) => responsiveWidth(value);

const AvatarStack = ({
  avatars,
  countText,
  size = rw(9),
  overlap = -rw(2),
}) => {
  const getAvatarUri = (avatar) => {
    if (!avatar) return "";
    if (typeof avatar === "string") return avatar;
    return avatar?.uri || avatar?.avatar || avatar?.profileImage || "";
  };

  const getInitial = (avatar) => {
    const name =
      (typeof avatar === "object" && avatar?.name) ||
      (typeof avatar === "string" ? avatar : "");
    const trimmed = String(name || "").trim();
    if (!trimmed) return "?";
    return trimmed.charAt(0).toUpperCase();
  };

  const hasValidImage = (uri) =>
    typeof uri === "string" &&
    uri.trim().length > 0 &&
    /^(https?:\/\/|file:|data:image\/)/i.test(uri.trim());

  return (
    <View style={styles.avatarRow}>
      {avatars.map((avatar, index) => {
        const uri = getAvatarUri(avatar);
        const useImage = hasValidImage(uri);

        return useImage ? (
          <Image
            key={`${uri}-${index}`}
            source={{ uri: uri.trim() }}
            style={[
              styles.stackedAvatar,
              {
                width: size,
                height: size,
                borderRadius: size / 2,
                marginLeft: index === 0 ? 0 : overlap,
              },
            ]}
          />
        ) : (
          <View
            key={`initial-${index}`}
            style={[
              styles.initialAvatar,
              {
                width: size,
                height: size,
                borderRadius: size / 2,
                marginLeft: index === 0 ? 0 : overlap,
              },
            ]}
          >
            <Text style={styles.initialText}>{getInitial(avatar)}</Text>
          </View>
        );
      })}
      {countText ? (
        <View
          style={[
            styles.avatarCounter,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              marginLeft: overlap,
            },
          ]}
        >
          <Text style={styles.avatarCounterText}>{countText}</Text>
        </View>
      ) : null}
    </View>
  );
};
const styles = StyleSheet.create({
  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  stackedAvatar: {
    borderWidth: 1.5,
    borderColor: "#131A24",
  },
  initialAvatar: {
    borderWidth: 1.5,
    borderColor: "#131A24",
    backgroundColor: "#27354A",
    alignItems: "center",
    justifyContent: "center",
  },
  initialText: {
    color: "#EAF7FF",
    fontSize: rw(3.2),
    fontWeight: "700",
  },
  avatarCounter: {
    backgroundColor: "#2A3341",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarCounterText: {
    color: "#F6FBFF",
    fontSize: rw(3.5),
    fontWeight: "600",
  },
});

export default AvatarStack;
