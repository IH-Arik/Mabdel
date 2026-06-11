import { View, Text, Pressable } from "react-native";
import React from "react";
import { responsiveWidth } from "react-native-responsive-dimensions";
import { ChevronRight } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";

const ProfileRedirectCard = ({ title, path }) => {
  const navigation = useNavigation();
  return (
    <Pressable
      onPress={() => navigation.navigate(path)}
      className="flex-row justify-between items-center border border-border rounded-xl"
      style={{
        padding: responsiveWidth(2),
      }}
    >
      <Text>{title}</Text>

      <ChevronRight size={22} color={"black"} />
    </Pressable>
  );
};

export default ProfileRedirectCard;
