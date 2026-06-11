import React from "react";
import { Pressable, Text } from "react-native";

const ActionButton = ({ title, onPress, style, textStyle, baseStyle, baseTextStyle }) => (
  <Pressable style={[baseStyle, style]} onPress={onPress}>
    <Text style={[baseTextStyle, textStyle]}>{title}</Text>
  </Pressable>
);

export default ActionButton;
