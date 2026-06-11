import React from 'react';
import { Modal, View, Text, Pressable } from 'react-native';

const ConfirmModal = ({
  visible,
  onClose,
  onConfirm,
  title = "Are you sure?",
  description = "This action cannot be undone.",
  cancelButtonText = "Cancel",
  confirmButtonText = "Confirm",
  cancelButtonColor = "bg-gray-500",
  confirmButtonColor = "bg-red-500",
  type = "warning", // 'warning', 'danger', 'info'
}) => {
  const getIconColor = () => {
    switch (type) {
      case 'danger':
        return '#EF4444';
      case 'info':
        return '#3B82F6';
      case 'warning':
      default:
        return '#F59E0B';
    }
  };

  return (
    <Modal visible={visible} transparent={true} animationType="fade">
      <View className="flex-1 bg-black/50 justify-center items-center px-4">
        <View className="bg-[#020406] rounded-2xl p-6 w-full max-w-sm">
          <Text className="text-xl font-bold text-center text-white mb-2">
            {title}
          </Text>
          <Text className="text-base text-center text-gray-200 mb-6">
            {description}
          </Text>

          <View className="flex-row gap-3">

<Pressable
              className={`flex-1 ${confirmButtonColor} rounded-xl py-3`}
              onPress={onConfirm}
            >
              <Text className="text-white text-center text-lg font-semibold">
                {confirmButtonText}
              </Text>
            </Pressable>

            <Pressable
              className={`flex-1 ${cancelButtonColor} rounded-xl py-3`}
              onPress={onClose}
            >
              <Text className="text-white text-center text-lg font-semibold">
                {cancelButtonText}
              </Text>
            </Pressable>
            
            
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default ConfirmModal;