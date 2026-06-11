import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Clock } from 'lucide-react-native';
import TimePickerComponent from './TimePickerComponent';

const TimeSlotInput = ({ label, value, onChange }) => {
  const [showPicker, setShowPicker] = useState(false);

  const formatTime = date => {
    if (!date) return 'Select time';
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const handleConfirm = selectedTime => {
    console.log('LINE AT 190', selectedTime);

    // onChange(formatTime(selectedTime));
    onChange((selectedTime));
    setShowPicker(false);
  };

  return (
    <View className="mb-4">
      {label && (
        <Text className="text-base font-medium text-black mb-2">{label}</Text>
      )}

      <TouchableOpacity
        onPress={() => setShowPicker(true)}
        className="flex-row items-center bg-white border border-border rounded-xl px-4 py-3"
      >
        <Clock size={20} color="#6B7280" />
        <Text className="text-base text-gray-900 ml-3 flex-1">
          {formatTime(value)}
        </Text>
      </TouchableOpacity>

      <TimePickerComponent
        visible={showPicker}
        selectedTime={value}
        onConfirm={handleConfirm}
        onCancel={() => setShowPicker(false)}
        title={label || 'Select Time'}
      />
    </View>
  );
};

export default TimeSlotInput;
