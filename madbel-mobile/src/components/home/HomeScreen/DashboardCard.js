import React from "react";
import { Pressable, View } from "react-native";

const DashboardCard = ({ children, baseStyle, style, onPress }) => {
  if (onPress) {
    return (
      <Pressable style={[baseStyle, style]} onPress={onPress}>
        {children}
      </Pressable>
    );
  }

  return <View style={[baseStyle, style]}>{children}</View>;
};

export default DashboardCard;
