import { CreditCard } from "lucide-react-native";
import { useAppLanguage } from "../context/LanguageContext";
import React from "react";
import { View, Text, TouchableOpacity, Image } from "react-native";
import { responsiveWidth } from "react-native-responsive-dimensions";

const PaymentMethodCard = () => {
  const { t } = useAppLanguage();

  return (
    <View
      className="bg-white rounded-2xl  border border-gray-200"
      style={{
        padding: responsiveWidth(3),
      }}
    >
      {/* Header */}
      <Text className="text-lg font-bold text-gray-900 mb-4">{t("payment_method")}</Text>

      {/* Credit/Debit Card Option */}
      <TouchableOpacity className="flex-row items-center justify-between  border border-border rounded-xl p-4 ">
        <View className="flex-row items-center gap-2">
          {/* Card Icon */}
          <CreditCard />

          <Text className="text-gray-900 font-semibold text-base">{t("credit_debit_card")}</Text>
        </View>

        {/* Radio Button - Selected */}

        <View className="w-5 h-5 rounded-full bg-primary" />
      </TouchableOpacity>

      {/* Other Payment Methods */}
    </View>
  );
};

export default PaymentMethodCard;
