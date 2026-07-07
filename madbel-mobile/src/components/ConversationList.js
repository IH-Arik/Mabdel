import React from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  TextInput,
  Image,
} from "react-native";
import { CheckCheckIcon, Search } from "lucide-react-native";
import {
  responsiveHeight,
  responsiveWidth,
} from "react-native-responsive-dimensions";
import { useAppLanguage } from "../context/LanguageContext";

const ConversationList = ({
  conversations = [],
  onConversationPress,
  onNewMessagePress,
  showSearchBar = true,
  searchPlaceholder,
  emptyMessage,
}) => {
  const { t } = useAppLanguage();
  const resolvedSearchPlaceholder = searchPlaceholder || t("search_messages");
  const resolvedEmptyMessage = emptyMessage || t("no_conversations_yet");
  const renderConversationItem = ({ item }) => (
    <Pressable
      className="flex-row items-center  border border-border rounded-xl"
      style={{
        padding: responsiveWidth(2),
        gap: responsiveWidth(2)
      }}
      onPress={() => onConversationPress(item)}
    >
      <Image
        source={{ uri: item.avatar }}
        className="rounded-full"
        style={{
          width: responsiveWidth(10),
          height: responsiveWidth(10),
        }}
      />
      <View className="flex-1" style={{ gap: responsiveWidth(1) }}>
        <View className="flex-row justify-between items-center">
          <Text className="text-base font-semibold text-gray-900">
            {item.name}
          </Text>
          <Text className="text-sm text-gray-500">{item.time}</Text>
        </View>
        <Text
          className={`text-sm  ${
            item.unread ? "text-gray-900 font-medium" : "text-gray-500"
          }`}
          numberOfLines={1}
        >
          {item.lastMessage}
        </Text>
      </View>
      {item.unread && <CheckCheckIcon size={22} color={"#71ABE0"} />}
    </Pressable>
  );

  const renderEmptyComponent = () => (
    <View className="flex-1 justify-center items-center ">
      <Text className="text-gray-500 text-lg">{resolvedEmptyMessage}</Text>
    </View>
  );

  return (
    <View className="flex-1 bg-white"
    style={{
        marginTop: responsiveHeight(2),
        gap: responsiveHeight(2)
    }}
    >
      {/* Search Bar */}
      {showSearchBar && (
        <View className="">
          <View className="flex-row items-center bg-gray-100 rounded-lg px-3 py-2">
            <Search size={20} color="#6B7280" />
            <TextInput
              className="flex-1 ml-2 text-gray-900 text-base"
              placeholder={resolvedSearchPlaceholder}
              placeholderTextColor="#9CA3AF"
            />
          </View>
        </View>
      )}

      {/* Conversations List */}
      <FlatList
        data={conversations}
        renderItem={renderConversationItem}
        keyExtractor={(item) => item.id.toString()}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1, gap: responsiveHeight(2) }}
        ListEmptyComponent={renderEmptyComponent}
      />

      {/* New Message Floating Button */}
      
    </View>
  );
};

export default ConversationList;
