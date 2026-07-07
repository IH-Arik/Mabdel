import React from "react";
import { useAppLanguage } from "../context/LanguageContext";
import { View, Text, TouchableOpacity } from "react-native";
import { responsiveWidth } from "react-native-responsive-dimensions";
import { Controller, useFormContext } from "react-hook-form";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const CounterView = ({
  label,
  min,
  max,
  step,
  value,
  onChange,
  disabled,
  errorMessage,
}) => {
  const { t } = useAppLanguage();

  const currentValue = typeof value === "number" ? value : Number(value || min) || min;
  const resolvedValue = clamp(currentValue, min, max);
  const resolvedOnChange = onChange || (() => undefined);

  const increment = () => {
    if (disabled) return;
    resolvedOnChange(clamp(resolvedValue + step, min, max));
  };

  const decrement = () => {
    if (disabled) return;
    resolvedOnChange(clamp(resolvedValue - step, min, max));
  };

  return (
    <View className=" flex-1 w-full">
      <Text className="mb-2 text-base font-medium text-black">{label}</Text>
      <View
        className="flex-1 flex-row bg-white items-center  justify-between border border-border rounded-xl"
        style={{ padding: responsiveWidth(3) }}
      >
        <Text className="text-base text-gray-600 ">Max Participants: {max}</Text>

        <View className="flex-row items-center justify-between gap-3  bg-white">
          <TouchableOpacity
            onPress={decrement}
            className="w-8 h-8 items-center justify-center bg-gray-200 rounded"
            disabled={disabled || resolvedValue <= min}
          >
            <Text
              className={`text-lg font-bold ${
                disabled || resolvedValue <= min ? "text-gray-400" : "text-gray-700"
              }`}
            >
              -
            </Text>
          </TouchableOpacity>

          <Text className="text-2xl font-normal text-primary">{resolvedValue}</Text>

          <TouchableOpacity
            onPress={increment}
            className="w-8 h-8 items-center justify-center bg-gray-200 rounded"
            disabled={disabled || resolvedValue >= max}
          >
            <Text
              className={`text-lg font-bold ${
                disabled || resolvedValue >= max ? "text-gray-400" : "text-gray-700"
              }`}
            >
              +
            </Text>
          </TouchableOpacity>
        </View>
      </View>
      {errorMessage ? <Text className="text-red-500 mt-1">{errorMessage}</Text> : null}
    </View>
  );
};

const ParticipantCounter = ({
  name = "participantLimit",
  control,
  label = "Participant Limit",
  min = 0,
  max = 25,
  step = 1,
  rules,
  value,
  onChange,
  disabled = false,
  errorMessage,
}) => {
  const formContext = useFormContext();
  const shouldUseForm = Boolean(
    !onChange && value === undefined && name && (control || formContext?.control),
  );

  if (shouldUseForm) {
    return (
      <Controller
        name={name}
        control={control || formContext?.control}
        rules={rules}
        defaultValue={min}
        render={({ field, fieldState }) => (
          <CounterView
            label={label}
            min={min}
            max={max}
            step={step}
            value={field.value}
            onChange={field.onChange}
            disabled={disabled}
            errorMessage={errorMessage || fieldState?.error?.message}
          />
        )}
      />
    );
  }

  return (
    <CounterView
      label={label}
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={onChange}
      disabled={disabled}
      errorMessage={errorMessage}
    />
  );
};

export default ParticipantCounter;
