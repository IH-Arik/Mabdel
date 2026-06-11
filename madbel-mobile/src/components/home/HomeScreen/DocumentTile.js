import React from "react";
import { Pressable, Text, View } from "react-native";
import { responsiveWidth } from "react-native-responsive-dimensions";

const rw = (value) => responsiveWidth(value);

const DocumentTile = ({ item, onPress, cardStyle, iconWrapStyle, titleStyle }) => {
  const Icon = item.icon;

  return (
    <Pressable style={cardStyle} onPress={() => onPress(item.route)}>
      <View style={iconWrapStyle}>
        <Icon size={rw(5.8)} color="#12D2ED" />
      </View>
      <Text style={titleStyle} numberOfLines={2}>
        {item.title}
      </Text>
    </Pressable>
  );
};

export default DocumentTile;
