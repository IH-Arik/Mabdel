/* eslint-disable react-native/no-inline-styles */
import React, { useState, useEffect } from "react";
import { Dimensions } from "react-native";
import { useAppLanguage } from "../context/LanguageContext";
import { Modal, View, Pressable, Text } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";

const PICKER_WIDTH = Dimensions.get("window").width - 40;

const SystemCalendarModal = ({ visible, onClose, selectedDate, onSelectDate }) => {
  const { t } = useAppLanguage();

  const normalizeDate = (value) => {
    if (!value) return new Date();
    const parsed = value instanceof Date ? value : new Date(value);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  };

  const [tempDate, setTempDate] = useState(() => normalizeDate(selectedDate));

  useEffect(() => {
    setTempDate(normalizeDate(selectedDate));
  }, [selectedDate]);

  const toDateString = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const handleConfirm = () => {
    onSelectDate(toDateString(tempDate));
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.2)",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <View
          style={{
            backgroundColor: "#1D1D21",
            borderRadius: 12,
            padding: 20,
            width: "100%",
            alignItems: "center",
          }}
        >
          <DateTimePicker
            value={tempDate}
            onChange={(_, date) => {
              if (date) {
                setTempDate(date);
              }
            }}
            mode="date"
            display="spinner"
            themeVariant="dark"
            style={{
              width: PICKER_WIDTH,
              backgroundColor: "#1D1D21",
              borderRadius: 12,
              padding: 20,
            }}
          />
          <Pressable
            style={{
              marginTop: 16,
              paddingVertical: 10,
              paddingHorizontal: 24,
              backgroundColor: "#00adf5",
              borderRadius: 8,
            }}
            onPress={handleConfirm}
          >
            <Text style={{ color: "#fff", fontWeight: "bold" }}>{t("close")}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

export default SystemCalendarModal;
