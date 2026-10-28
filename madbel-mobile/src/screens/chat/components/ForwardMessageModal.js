import React from "react";
import { View, Text, Modal, Pressable, FlatList } from "react-native";
import { responsiveHeight } from "react-native-responsive-dimensions";

const ForwardMessageModal = ({
  visible,
  onClose,
  insets,
  allThreads,
  threadId,
  onForwardTo,
  t,
}) => (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <Pressable
      style={{
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.6)",
        justifyContent: "flex-end",
      }}
      onPress={onClose}
    >
      <Pressable
        style={{
          backgroundColor: "#0D1520",
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          paddingTop: 16,
          paddingBottom: insets.bottom + responsiveHeight(2),
          maxHeight: responsiveHeight(60),
        }}
        onPress={(e) => e.stopPropagation()}
      >
        <Text
          style={{
            color: "#F8FAFC",
            fontSize: 17,
            fontWeight: "700",
            textAlign: "center",
            marginBottom: 14,
          }}
        >
          {t("forward_to")}
        </Text>
        <FlatList
          data={allThreads.filter((th) => (th._id || th.id) !== threadId)}
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
              onPress={() => onForwardTo(item._id || item.id)}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: "#1B2A3B",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{
                    color: "#17CBE8",
                    fontWeight: "700",
                    fontSize: 16,
                  }}
                >
                  {String(item.directPeer?.fullName || item.name || "?")[0].toUpperCase()}
                </Text>
              </View>
              <Text
                style={{
                  color: "#E8EFF7",
                  fontSize: 15,
                  fontWeight: "600",
                }}
              >
                {item.directPeer?.fullName || item.name || t("unknown_user")}
              </Text>
            </Pressable>
          )}
          ListEmptyComponent={
            <Text
              style={{
                color: "#5D6A7A",
                textAlign: "center",
                paddingVertical: 24,
              }}
            >
              {t("no_other_conversations")}
            </Text>
          }
        />
      </Pressable>
    </Pressable>
  </Modal>
);

export default ForwardMessageModal;
