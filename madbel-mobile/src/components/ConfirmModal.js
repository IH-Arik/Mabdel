// import React from "react";
// import { Modal, View, Text, Pressable } from "react-native";

// const ConfirmModal = ({
//   visible,
//   onClose,
//   onConfirm,
//   title = "Are you sure?",
//   description = "This action cannot be undone.",
//   cancelButtonText = "Cancel",
//   confirmButtonText = "Confirm",
//   cancelButtonColor = "bg-gray-500",
//   confirmButtonColor = "bg-red-500",
//   type = "warning", // 'warning', 'danger', 'info'
// }) => {
//   const getIconColor = () => {
//     switch (type) {
//       case "danger":
//         return "#EF4444";
//       case "info":
//         return "#3B82F6";
//       case "warning":
//       default:
//         return "#F59E0B";
//     }
//   };

//   console.log(
//     "LINE AT 28",
//     visible,
//     onClose,
//     onConfirm,
//     title,
//     description,
//     cancelButtonText,
//     confirmButtonText,
//     cancelButtonColor,
//     confirmButtonColor,
//     type,
//   );

//   return (
//     <Modal visible={visible} transparent={true} animationType="fade">
//       <View className="flex-1 bg-black/50 justify-center items-center px-4">
//         <View className="bg-[#020406] rounded-2xl p-6 w-full max-w-sm">
//           <Text className="text-xl font-bold text-center text-white mb-2">
//             {title}
//           </Text>
//           <Text className="text-base text-center text-gray-200 mb-6">
//             {description}
//           </Text>

//           <View className="flex-row gap-3">
//             <Pressable
//               className={`flex-1 ${confirmButtonColor} rounded-xl py-3`}
//               onPress={onConfirm}
//             >
//               <Text className="text-white text-center text-lg font-semibold">
//                 {confirmButtonText}
//               </Text>
//             </Pressable>

//             <Pressable
//               className={`flex-1 ${cancelButtonColor} rounded-xl py-3`}
//               onPress={onClose}
//             >
//               <Text className="text-white text-center text-lg font-semibold">
//                 {cancelButtonText}
//               </Text>
//             </Pressable>
//           </View>
//         </View>
//       </View>
//     </Modal>
//   );
// };

// export default ConfirmModal;

import React from "react";
import { useAppLanguage } from "../context/LanguageContext";
import { Modal, View, Text, Pressable, StyleSheet } from "react-native";

const ConfirmModal = ({
  visible,
  onClose,
  onConfirm,
  title,
  description,
  cancelButtonText,
  confirmButtonText,
  confirmBg = "#EF4444",
  cancelBg = "#6B7280",
}) => {
  const { t } = useAppLanguage();
  const resolvedTitle = title || t("are_you_sure");
  const resolvedDescription = description || t("this_action_cannot_be_undone");
  const resolvedCancelButtonText = cancelButtonText || t("cancel");
  const resolvedConfirmButtonText = confirmButtonText || t("confirm");

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{resolvedTitle}</Text>
          <Text style={styles.description}>{resolvedDescription}</Text>

          <View style={styles.row}>
            <Pressable
              style={[styles.button, { backgroundColor: confirmBg }]}
              onPress={onConfirm}
            >
              <Text style={styles.buttonText}>{resolvedConfirmButtonText}</Text>
            </Pressable>

            <Pressable
              style={[styles.button, { backgroundColor: cancelBg }]}
              onPress={onClose}
            >
              <Text style={styles.buttonText}>{resolvedCancelButtonText}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  card: {
    backgroundColor: "#020406",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 380,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    textAlign: "center",
    color: "#E5E7EB",
    marginBottom: 24,
  },
  row: { flexDirection: "row", gap: 12 },
  button: { flex: 1, borderRadius: 12, paddingVertical: 12 },
  buttonText: {
    color: "#FFFFFF",
    textAlign: "center",
    fontSize: 17,
    fontWeight: "600",
  },
});

export default ConfirmModal;
