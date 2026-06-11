import React from "react";
import { View, Text, Pressable, Image } from "react-native";
import {
  responsiveHeight,
  responsiveWidth,
} from "react-native-responsive-dimensions";

const EventCard = ({ item, onPress }) => {
  return (
    <View className="bg-white rounded-2xl shadow-lg overflow-hidden  border border-gray-200">
      {/* Content Section - More compact like the image */}
      <Image
        source={{ uri: item?.heroImage }}
        className="w-full"
        style={{
          width: responsiveWidth(100),
          height: responsiveHeight(15),
        }}
      />
      <View className="p-5">
        {/* Header with Title and Free Badge */}

        <View className="flex-row justify-between items-start mb-3">
          <Text className="text-primary text-lg font-bold">{item?.type}</Text>
          <View
            className={`${item?.price ? " bg-yellow-600" : "bg-green-500"}   rounded-xl`}
            style={{
              paddingHorizontal: responsiveWidth(2),
              paddingVertical: responsiveWidth(1),
            }}
          >
            <Text className="text-white font-semibold text-sm">
              {item?.price ? `$${item?.price}` : "Free"}
            </Text>
          </View>
        </View>

        {/* Main Title */}
        <Text className="text-xl font-bold text-gray-900 mb-2">
          {item?.title}
        </Text>

        {/* Description - Two lines like in the image */}
        <Text className="text-gray-600 text-sm leading-5 mb-4">
         {item?.description}
        </Text>

        {/* Join Button - More prominent like the image */}
        <Pressable
          style={{
            padding: responsiveWidth(3),
          }}
          className="bg-primary rounded-lg"
          onPress={()=> onPress(item)}
        >
          <Text className="font-semibold text-lg text-center text-black">
            Join Event
          </Text>
        </Pressable>
      </View>
    </View>
  );
};

export default EventCard;
