import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
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

    // onChange(formatTime(selectedTime));
    onChange((selectedTime));
    setShowPicker(false);
  };

  return (
    <View className="mb-4 w-full">
      {label && (
        <Text style={{ marginBottom: 4, fontSize: 12, fontWeight: '500', color: '#677181' }}>
          {label}
        </Text>
      )}

      <Pressable
        onPress={() => setShowPicker(true)}
        activeOpacity={0.85}
        // className="w-full flex-row items-center rounded-[18px] border-2 border-red-500 bg-[#1D1D21] px-4"
        style={{ minHeight: 56 , backgroundColor: '#1D1D21', borderRadius: 18, borderWidth: 1, borderColor: '#2A3442', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 }}
      >
        <Clock size={16} color="#677181" />
        <Text style={{ marginLeft: 12, flex: 1, fontSize: 15, fontWeight: '500', color: '#677181' }}>
          {formatTime(value)}
        </Text>
      </Pressable>

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
