import React, { useEffect, useState } from "react";
import { useAppLanguage } from "../context/LanguageContext";
import { View, Text, TouchableOpacity, Modal, Pressable, StyleSheet, Dimensions } from "react-native";
import DatePicker from "react-native-date-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { responsiveHeight } from "react-native-responsive-dimensions";

const PICKER_WIDTH = Dimensions.get("window").width - 40;

const TimePickerComponent = ({
  visible,
  selectedTime,
  onConfirm,
  onCancel,
  title = "Select Time",
}) => {
  const { t } = useAppLanguage();
    const insets = useSafeAreaInsets();
  

  const [time, setTime] = useState(selectedTime || new Date());

  useEffect(() => {
    if (visible) {
      setTime(selectedTime || new Date());
    }
  }, [visible, selectedTime]);

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
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTap} onPress={onCancel} />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={onCancel} hitSlop={10}>
              <Text style={styles.cancelText}>{t("cancel")}</Text>
            </TouchableOpacity>
          </View>
          <View style={[styles.pickerWrap, { paddingTop: insets.top + responsiveHeight(1), paddingBottom: insets.bottom + responsiveHeight(1) }]}
>
            <DatePicker
              date={time}
              onDateChange={setTime}
              mode="time"
              androidVariant="iosClone"
              textColor="#FFFFFF"
              fadeToColor="#0B1118"
              style={styles.picker}
            />
               <TouchableOpacity
            onPress={handleConfirm}
            style={styles.confirmBtn}
            activeOpacity={0.85}
          >
            <Text style={styles.confirmText}>{t("confirm")}</Text>
          </TouchableOpacity>
          </View>

       
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(2, 6, 23, 0.68)",
    justifyContent: "flex-end",
  },
  backdropTap: {
    flex: 1,
  },
  sheet: {
    backgroundColor: "#0B1118",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 24,
    maxHeight: "82%",
  },
  handle: {
    alignSelf: "center",
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#263244",
    marginBottom: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  title: {
    color: "#F8FAFC",
    fontSize: 18,
    fontWeight: "700",
  },
  cancelText: {
    color: "#94A3B8",
    fontSize: 15,
    fontWeight: "600",
  },
  pickerWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
  },
  picker: {
    width: PICKER_WIDTH,
  },
  confirmBtn: {
    marginTop: 14,
    backgroundColor: "#11CDE8",
    borderRadius: 16,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  confirmText: {
    color: "#03141E",
    fontSize: 16,
    fontWeight: "700",
  },
});

export default TimePickerComponent;
