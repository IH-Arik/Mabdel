import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import DatePicker from 'react-native-date-picker';

const TimePickerComponent = ({ 
  visible, 
  selectedTime, 
  onConfirm, 
  onCancel,
  title = "Select Time" 
}) => {
  const [time, setTime] = useState(selectedTime || new Date());

  const handleConfirm = () => {
    onConfirm(time);
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onCancel}
    >
      <View className="flex-1 bg-black/50 justify-end">
        <View className="bg-white rounded-t-3xl p-6">
          {/* Header */}
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-lg font-semibold text-gray-900">
              {title}
            </Text>
            <TouchableOpacity onPress={onCancel}>
              <Text className="text-base text-gray-500">Cancel</Text>
            </TouchableOpacity>
          </View>

          {/* Date Picker */}
          <DatePicker
            date={time}
            onDateChange={setTime}
            mode="time"
            androidVariant="nativeAndroid"
            textColor="#000000"
            fadeToColor="white"
          />

          {/* Confirm Button */}
          <TouchableOpacity
            onPress={handleConfirm}
            className="bg-black rounded-2xl py-4 mt-4 items-center"
            activeOpacity={0.8}
          >
            <Text className="text-white font-medium text-base">
              Confirm
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default TimePickerComponent;