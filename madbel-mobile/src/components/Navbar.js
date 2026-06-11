import { View, Text, Pressable } from "react-native";
import React from "react";
import {  Bell, ChevronLeft } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import { responsiveWidth } from "react-native-responsive-dimensions";

const Navbar = ({ title }) => {
  const navigation = useNavigation();
  return (
    <View className="w-full flex-row items-center justify-between ">
      <Pressable onPress={() => navigation.goBack()} className="p-2 border rounded-full">
        <ChevronLeft color={"#222"} size={22} />
      </Pressable>
      <Text className="text-lg font-bold text-center">{title}</Text>
      <View style={{ width: responsiveWidth(5) }} />
    </View>
  );
};

export default Navbar;
