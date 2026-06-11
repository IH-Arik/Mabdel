import React, { useState } from "react";
import { Modal, View, Text, TextInput, Pressable } from "react-native";

const ReportModal = ({
  visible,
  onClose,
  onReport,
  title = "Report Activity",
  description = "Please tell us why you're reporting this activity. Your report will be anonymous.",
  placeholder = "Describe the issue...",
  cancelButtonText = "Cancel",
  submitButtonText = "Submit Report",
  cancelButtonColor = "bg-gray-500",
  submitButtonColor = "bg-red-500",
}) => {
  const [reportReason, setReportReason] = useState("");

  const handleSubmit = () => {
    if (onReport) {
      onReport(reportReason);
    }
    setReportReason("");
    onClose();
  };

  const handleClose = () => {
    setReportReason("");
    onClose();
  };

  return (
    <Modal visible={visible} transparent={true} animationType="fade">
      <View className="flex-1 bg-black/50 justify-center items-center px-4">
        <View className="bg-white rounded-2xl p-6 w-full max-w-sm">
          <Text className="text-xl font-bold text-center text-gray-900 mb-2">
            {title}
          </Text>
          <Text className="text-base text-center text-gray-600 mb-4">
            {description}
          </Text>

          <TextInput
            className="border border-gray-300 rounded-xl p-4 h-32 text-base text-gray-700 mb-6"
            placeholder={placeholder}
            placeholderTextColor="#9CA3AF"
            multiline={true}
            textAlignVertical="top"
            value={reportReason}
            onChangeText={setReportReason}
          />

          <View className="flex-row gap-3">
            <Pressable
              className={`flex-1 ${cancelButtonColor} rounded-xl py-3`}
              onPress={handleClose}
            >
              <Text className="text-white text-center text-lg font-semibold">
                {cancelButtonText}
              </Text>
            </Pressable>

            <Pressable
              className={`flex-1 ${submitButtonColor} rounded-xl py-3`}
              onPress={handleSubmit}
              disabled={!reportReason.trim()}
            >
              <Text className="text-white text-center text-lg font-semibold">
                {submitButtonText}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default ReportModal;
