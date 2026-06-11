import { Controller } from "react-hook-form";
import { TextInput, View, Text, Pressable } from "react-native";

import {
  responsiveHeight,
  responsiveWidth,
} from "react-native-responsive-dimensions";

const ControllerTextAreaInput = ({
  label,
  placeholder,
  name,
  control,
  error,
  numberOfLines = 4,
  height = responsiveHeight(15),
  ...props
}) => {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field: { onChange, value, onBlur } }) => (
        <View className="relative w-full">
          {label && (
            <Text className="text-base font-medium text-black mb-2">
              {label}
            </Text>
          )}
          <TextInput
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            placeholder={placeholder}
            placeholderTextColor={"#999"}
            multiline={true}
            numberOfLines={numberOfLines}
            style={{
              textAlignVertical: "top", // very important for textarea behavior
              minHeight: height,
            }}
            className={` px-4 py-2 rounded-xl font-SemiBold border border-border ${
              error ? "border-red-500" : ""
            }`}
            {...props}
          />
          {error && (
            <Text className="text-red-500 text-xs font-Regular mt-1">
              {error}
            </Text>
          )}
        </View>
      )}
    />
  );
};

export default ControllerTextAreaInput;
