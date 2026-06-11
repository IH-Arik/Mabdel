import React, { useState } from "react";
import { View, Text, Pressable, FlatList } from "react-native";
import {
  Activity,
  Bike,
  Dumbbell,
  Footprints,
  Link2,
  ListFilter,
  PersonStanding,
  Waves,
} from "lucide-react-native";
import {
  responsiveHeight,
  responsiveWidth,
} from "react-native-responsive-dimensions";

const CATEGORY_ICON_MAP = {
  all: ListFilter,
  walking: PersonStanding,
  running: Footprints,
  cycling: Bike,
  swimming: Waves,
  workout: Dumbbell,
  gym: Dumbbell,
  yoga: PersonStanding,
  related: Link2,
};

const CategorySelector = ({
  categories = [
    "Walking",
    "Running",
    "Cycling",
    "Swimming",
    "Yoga",
    "Gym",
    "Related",
  ],
  initialCategory = "Walking",
  onCategoryChange,
  containerClass = "px-4 py-3",
}) => {
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);

  const handleCategoryPress = (category) => {
    setSelectedCategory(category);
    onCategoryChange?.(category);
  };

  const renderCategoryItem = ({ item }) => {
    const isSelected = selectedCategory === item;
    const normalizedItem = String(item || "").trim().toLowerCase();
    const IconComponent = CATEGORY_ICON_MAP[normalizedItem] || Activity;
    const textColor = isSelected ? "#FFFFFF" : "#374151";

    return (
      <Pressable
        className={`rounded-full ${isSelected ? "bg-primary" : "bg-gray-200"}`}
        style={{
          paddingVertical: responsiveHeight(1),
          paddingHorizontal: responsiveWidth(5),
          marginRight: responsiveWidth(2),
        }}
        onPress={() => handleCategoryPress(item)}
      >
        <View
          className="flex-row items-center"
          style={{ gap: responsiveWidth(1.5) }}
        >
          <IconComponent size={14} color={textColor} />
          <Text
            className={`text-center font-medium text-sm ${isSelected ? "text-white" : "text-gray-700"}`}
          >
            {item}
          </Text>
        </View>
      </Pressable>
    );
  };

  return (
    <View>
      <FlatList
        data={categories}
        renderItem={renderCategoryItem}
        keyExtractor={(item) => item}
        horizontal
        showsHorizontalScrollIndicator={false}
        // contentContainerStyle={{ paddingHorizontal: 4 }}
      />
    </View>
  );
};

export default CategorySelector;
