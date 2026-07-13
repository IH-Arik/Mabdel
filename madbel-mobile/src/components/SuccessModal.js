import { Check } from "lucide-react-native";
import React, { useEffect } from "react";
import { Modal, View, Text, StyleSheet } from "react-native";
import { responsiveWidth } from "react-native-responsive-dimensions";

const SuccessModal = ({
  visible,
  onClose,
  title = "You Joined This Activity!",
  message = "Get ready to meet your fitness partner.",
  autoClose = false,
  autoCloseTime = 3000,
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
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconWrapper}>
            <Check size={50} color={"white"} />
          </View>
          <Text style={styles.title}>
            {title}
          </Text>
          <Text style={styles.message}>
            {message}
          </Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: responsiveWidth(4),
  },
  card: {
    width: "100%",
    maxWidth: responsiveWidth(85),
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: responsiveWidth(6),
  },
  iconWrapper: {
    alignSelf: "center",
    backgroundColor: "#0EA5E9",
    borderRadius: 999,
    padding: responsiveWidth(5),
    marginBottom: responsiveWidth(4),
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    color: "#111827",
    marginBottom: responsiveWidth(2),
  },
  message: {
    fontSize: 16,
    textAlign: "center",
    color: "#4B5563",
  },
});

export default SuccessModal;
