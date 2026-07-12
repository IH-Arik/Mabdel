// /* eslint-disable react-native/no-inline-styles */
// import React from "react";
// import { useAppLanguage } from "../context/LanguageContext";
// import { Modal, View, Pressable, Text } from "react-native";
// import { Calendar } from "react-native-calendars";

// const SystemCalendarModal = ({ visible, onClose, selectedDate, onSelectDate }) => {
//   const { t } = useAppLanguage();

//   return (
//     <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
//       <View
//         style={{
//           flex: 1,
//           backgroundColor: "rgba(0,0,0,0.2)",
//           justifyContent: "center",
//           alignItems: "center",
//         }}
//       >
//         <View
//           style={{
//             backgroundColor: "#fff",
//             borderRadius: 12,
//             padding: 20,
//             width: "90%",
//             alignItems: "center",
//           }}
//         >
//           <Calendar
//             style={{ width: "100%" }}
//             theme={{
//               backgroundColor: "#ffffff",
//               calendarBackground: "#ffffff",
//               textSectionTitleColor: "#b6c1cd",
//               selectedDayBackgroundColor: "#00adf5",
//               selectedDayTextColor: "#ffffff",
//               todayTextColor: "#00adf5",
//               dayTextColor: "#2d4150",
//               textDisabledColor: "#dd99ee",
//             }}
//             onDayPress={(day) => {
//               onSelectDate(day.dateString);
//               onClose();
//             }}
//             markedDates={
//               selectedDate
//                 ? {
//                     [selectedDate]: {
//                       selected: true,
//                       selectedColor: "#00adf5",
//                     },
//                   }
//                 : {}
//             }
//           />
//           <Pressable
//             style={{
//               marginTop: 16,
//               paddingVertical: 10,
//               paddingHorizontal: 24,
//               backgroundColor: "#00adf5",
//               borderRadius: 8,
//             }}
//             onPress={onClose}
//           >
//             <Text style={{ color: "#fff", fontWeight: "bold" }}>{t("close")}</Text>
//           </Pressable>
//         </View>
//       </View>
//     </Modal>
//   );
// };

// export default SystemCalendarModal;


/* eslint-disable react-native/no-inline-styles */
import React, { useState, useEffect } from "react";
import { Dimensions } from "react-native";
import { useAppLanguage } from "../context/LanguageContext";
import { Modal, View, Pressable, Text } from "react-native";
import DatePicker from "react-native-date-picker";

const PICKER_WIDTH = Dimensions.get("window").width - 40;

const SystemCalendarModal = ({ visible, onClose, selectedDate, onSelectDate }) => {
  const { t } = useAppLanguage();

  // react-native-date-picker works with Date objects, not "YYYY-MM-DD" strings
  const [tempDate, setTempDate] = useState(
    selectedDate ? new Date(selectedDate) : new Date()
  );

  useEffect(() => {
    if (selectedDate) {
      setTempDate(new Date(selectedDate));
    }
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
          <DatePicker
            date={tempDate}
            onDateChange={setTempDate}
            mode="date"
            theme="dark"
            style={{ width: PICKER_WIDTH , backgroundColor: "#1D1D21", borderRadius: 12, padding: 20 }}
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
