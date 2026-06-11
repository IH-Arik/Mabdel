import { Check } from "lucide-react-native";
import React, { useEffect } from "react";
import { Modal, View, Text, Pressable } from "react-native";
import { responsiveWidth } from "react-native-responsive-dimensions";

const SuccessModal = ({
  visible,
  onClose,
  title = "You Joined This Activity!",
  message = "Get ready to meet your fitness partner.",
  buttonText = "Great!",
  buttonColor = "bg-blue-500",
  autoClose = false, // New prop to enable auto-close
  autoCloseTime = 3000, // New prop to set auto-close time in milliseconds (default 3 seconds)
}) => {
  useEffect(() => {
    if (visible && autoClose) {
      const timer = setTimeout(() => {
        onClose();
      }, autoCloseTime);

      // Cleanup the timer when component unmounts or visible changes
      return () => clearTimeout(timer);
    }
  }, [visible, autoClose, autoCloseTime, onClose]);

  return (
    <Modal visible={visible} transparent={true} animationType="fade">
      <View className="flex-1 bg-black/50 justify-center items-center px-4">
        <View className="bg-white rounded-2xl p-6 w-full max-w-sm"
          style={{ gap: responsiveWidth(2) }}>
          <View
            className="bg-primary rounded-full"
            style={{ padding: responsiveWidth(5), alignSelf: "center" }}
          >
            <Check size={50} color={"white"} />
          </View>
          <Text className="text-xl font-bold text-center text-gray-900 mb-2">
            {title}
          </Text>
          <Text className="text-base text-center text-gray-600 mb-6">
            {message}
          </Text>
          {/* <Pressable
            className={`${buttonColor} rounded-xl py-3`}
            onPress={onClose}
          >
            <Text className="text-white text-center text-lg font-semibold">
              {buttonText}
            </Text>
          </Pressable> */}
        </View>
      </View>
    </Modal>
  );
};

export default SuccessModal;
