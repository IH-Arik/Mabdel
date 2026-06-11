import React from "react";
import { View, Text, Pressable, Image } from "react-native";
import { responsiveWidth } from "react-native-responsive-dimensions";

const ActivityCard = ({
  title = "Morning Run in Central Park",
  organizer = "Alex Johnson",
  organizerImage = "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face",
  distance = "0.8 miles away",
  date = "Dec 15",
  time = "7:00 AM",
  participants = [
    {
      id: 1,
      image:
        "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=100&h=100&fit=crop&crop=face",
    },
    {
      id: 2,
      image:
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
    },
    {
      id: 3,
      image:
        "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face",
    },
  ],
  maxParticipants = 5,
  item,
  onPress,
  joined = false,
  actionLabel,
  actionDisabled,
  heroImage = "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=400&h=200&fit=crop",
}) => {
  const joinedCount = participants.length;
  const remaining = maxParticipants - joinedCount;
  const showImages = participants.slice(0, 3); // Show max 3 images
  const overlapOffset = 8; // Adjust overlap amount
  const imgSize = responsiveWidth(8);
  const isDisabled = typeof actionDisabled === "boolean" ? actionDisabled : joined;
  const buttonText = actionLabel || (joined ? "Joined" : "Join Activity");
  return (
    <View
      className="bg-white rounded-2xl   border border-border"
      style={{ padding: responsiveWidth(4) }}
    >
      {/* Header with Organizer Image */}

      <Text className="text-lg font-bold text-gray-900 mb-1">{title}</Text>
      <View className="flex-row items-center justify-between">
        <View
          className="flex-row items-center"
          style={{ gap: responsiveWidth(2) }}
        >
          <Image
            source={require("../../assets/images/profile.png")}
            style={{
              width: imgSize,
              height: imgSize,
              borderRadius: imgSize / 2,
              resizeMode: "cover",
            }}
          />
          <View className="">
            <Text className="text-base text-gray-700 font-medium">
              {organizer}
            </Text>
            <View className="flex-row items-center mb-3">
              <Text className="text-sm text-gray-500">
                {date} • {time}
              </Text>
            </View>
          </View>
        </View>

        <Text className="text-sm text-gray-500 mr-4">{distance}</Text>
      </View>

      {/* Footer with Overlapping Images */}

      {/* Overlapping Participant Images */}
      <View className="flex-row items-center">
        <View className="flex-row mr-3">
          {showImages.map((participant, index) => (
            <View
              key={participant.id}
              className="w-8 h-8 rounded-full border-2 border-white bg-gray-200 overflow-hidden shadow-sm"
              style={{
                marginLeft: index === 0 ? 0 : -overlapOffset,
                zIndex: showImages.length - index, // Higher zIndex for later items
              }}
            >
              <Image
                source={{ uri: participant.image }}
                className="w-full h-full"
              />
            </View>
          ))}
          {remaining > 0 && (
            <View
              className="w-8 h-8 rounded-full border-2 border-white bg-gray-100 flex items-center justify-center shadow-sm"
              style={{ marginLeft: -overlapOffset }}
            >
              <Text className="text-xs font-bold text-gray-600">
                +{remaining}
              </Text>
            </View>
          )}
        </View>
        <Text className="text-sm text-gray-600">
          {joinedCount}/{maxParticipants} joined
        </Text>
      </View>
      <Image
        source={{ uri: heroImage }}
        style={{
          width: "100%",
          height: 150,
          borderRadius: 12,
          marginVertical: 10,
        }}
      />
      {/* Join Button */}
      <Pressable
        className={`rounded-xl ${isDisabled ? "bg-gray-300" : "bg-primary "} `}
        onPress={()=> onPress(item)}
        disabled={isDisabled}
        style={{
          padding: responsiveWidth(3),
        }}
      >
        <Text
          className={`font-semibold text-lg text-center ${
            isDisabled ? "text-gray-600" : "text-black"
          }`}
        >
          {buttonText}
        </Text>
      </Pressable>
    </View>
  );
};

export default ActivityCard;
