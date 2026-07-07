import React, { useState } from "react";
import { useAppLanguage } from "../context/LanguageContext";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import {
  responsiveHeight,
  responsiveWidth,
} from "react-native-responsive-dimensions";
import { Controller } from "react-hook-form";

const parseNumericText = (text) => text.replace(/[^0-9.]/g, "");

const PriceSelectorView = ({
  label,
  selectedPriceType,
  ticketPrice,
  discountPercentage,
  onPriceTypeChange,
  onTicketPriceChange,
  onDiscountChange,
  disabled,
  errorMessage,
}) => {
  const { t } = useAppLanguage();

  const [isModalVisible, setIsModalVisible] = useState(false);

  const handlePriceTypeSelect = (type) => {
    if (disabled) return;
    onPriceTypeChange(type);
    if (type === "paid") {
      setIsModalVisible(true);
    }
  };

  const handleSavePrice = () => {
    setIsModalVisible(false);
  };

  return (
    <View
      className="bg-white "
      style={{
        gap: responsiveHeight(2),
      }}
    >
      <Text className="text-lg font-bold text-black">{label}</Text>

      <View
        className="flex-row  "
        style={{
          gap: responsiveWidth(4),
        }}
      >
        <TouchableOpacity
          className={`flex-1 py-3 px-4 rounded-xl border-2 ${
            selectedPriceType === "free"
              ? "bg-primary border-primary"
              : "bg-gray-50 border-gray-300"
          }`}
          onPress={() => handlePriceTypeSelect("free")}
          disabled={disabled}
        >
          <Text
            className={`text-center font-semibold text-base ${
              selectedPriceType === "free" ? "text-white" : "text-gray-600"
            }`}
          >{t("free")}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          className={`flex-1 py-3 px-4 rounded-xl border-2 ${
            selectedPriceType === "paid"
              ? "bg-primary border-primary"
              : "bg-gray-50 border-gray-300"
          }`}
          onPress={() => handlePriceTypeSelect("paid")}
          disabled={disabled}
        >
          <Text
            className={`text-center font-semibold text-base ${
              selectedPriceType === "paid" ? "text-white" : "text-gray-600"
            }`}
          >{t("paid")}</Text>
        </TouchableOpacity>
      </View>

      {selectedPriceType === "paid" && ticketPrice && (
        <View className="bg-blue-50 border border-blue-200 rounded-xl p-3">
          <Text className="text-blue-700 text-center font-medium">
            Ticket Price: ${ticketPrice}
            {discountPercentage && ` (${discountPercentage}% off)`}
          </Text>
        </View>
      )}
      {errorMessage ? <Text className="text-red-500">{errorMessage}</Text> : null}

      <Modal
        visible={isModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1 justify-center items-center bg-black/50"
        >
          <View className="bg-white rounded-2xl mx-4 w-11/12 max-w-md">
            <View className="p-5 border-b border-gray-200">
              <Text className="text-xl font-bold text-gray-900">{t("set_ticket_price")}</Text>
            </View>

            <ScrollView className="p-5">
              <View className="mb-6">
                <Text className="text-lg font-semibold text-gray-900 mb-2">{t("ticket_price")}</Text>
                <View className="flex-row items-center border border-gray-300 rounded-xl px-4 py-3 bg-white">
                  <Text className="text-gray-500 mr-2 text-lg">$</Text>
                  <TextInput
                    className="flex-1 text-gray-900 text-lg"
                    placeholder={t("enter_ticket_price")}
                    placeholderTextColor="#9CA3AF"
                    keyboardType="decimal-pad"
                    value={ticketPrice}
                    onChangeText={(text) =>
                      onTicketPriceChange(parseNumericText(text))
                    }
                    editable={!disabled}
                  />
                </View>
              </View>

              <View className="mb-6">
                <Text className="text-lg font-semibold text-gray-900 mb-2">{t("discount")}</Text>
                <View className="flex-row items-center border border-gray-300 rounded-xl px-4 py-3 bg-white">
                  <TextInput
                    className="flex-1 text-gray-900 text-lg"
                    placeholder={t("discount")}
                    placeholderTextColor="#9CA3AF"
                    keyboardType="decimal-pad"
                    value={discountPercentage}
                    onChangeText={(text) =>
                      onDiscountChange(parseNumericText(text))
                    }
                    editable={!disabled}
                  />
                  <Text className="text-gray-500 ml-2 text-lg">%</Text>
                </View>
              </View>
            </ScrollView>

            <View className="flex-row border-t border-gray-200 p-4">
              <TouchableOpacity
                className="flex-1 py-3 px-4 bg-gray-100 rounded-xl mr-2"
                onPress={() => setIsModalVisible(false)}
              >
                <Text className="text-gray-700 text-center font-semibold text-base">{t("cancel")}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="flex-1 py-3 px-4 bg-blue-600 rounded-xl ml-2"
                onPress={handleSavePrice}
                disabled={disabled}
              >
                <Text className="text-white text-center font-semibold text-base">{t("save")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const PriceSelector = ({
  label = "Price",
  control,
  priceTypeName = "priceType",
  ticketPriceName = "ticketPrice",
  discountName = "discountPercentage",
  rules,
  value,
  onChange,
  disabled = false,
  errorMessage,
}) => {
  const shouldUseForm = Boolean(
    !onChange &&
      value === undefined &&
      control &&
      priceTypeName &&
      ticketPriceName &&
      discountName,
  );

  if (shouldUseForm) {
    return (
      <Controller
        name={priceTypeName}
        control={control}
        rules={rules}
        defaultValue="free"
        render={({ field: priceTypeField, fieldState: priceTypeState }) => (
          <Controller
            name={ticketPriceName}
            control={control}
            defaultValue=""
            render={({ field: ticketPriceField }) => (
              <Controller
                name={discountName}
                control={control}
                defaultValue=""
                render={({ field: discountField }) => (
                  <PriceSelectorView
                    label={label}
                    selectedPriceType={priceTypeField.value || "free"}
                    ticketPrice={ticketPriceField.value || ""}
                    discountPercentage={discountField.value || ""}
                    onPriceTypeChange={(nextType) => {
                      priceTypeField.onChange(nextType);
                      if (nextType === "free") {
                        ticketPriceField.onChange("");
                        discountField.onChange("");
                      }
                    }}
                    onTicketPriceChange={ticketPriceField.onChange}
                    onDiscountChange={discountField.onChange}
                    disabled={disabled}
                    errorMessage={errorMessage || priceTypeState?.error?.message}
                  />
                )}
              />
            )}
          />
        )}
      />
    );
  }

  const externalValue = value || {};
  const selectedPriceType = externalValue.priceType || "free";
  const ticketPrice = externalValue.ticketPrice || "";
  const discountPercentage = externalValue.discountPercentage || "";

  const safeOnChange = onChange || (() => undefined);
  const patchValue = (next) => {
    safeOnChange({
      priceType: selectedPriceType,
      ticketPrice,
      discountPercentage,
      ...next,
    });
  };

  return (
    <PriceSelectorView
      label={label}
      selectedPriceType={selectedPriceType}
      ticketPrice={ticketPrice}
      discountPercentage={discountPercentage}
      onPriceTypeChange={(nextType) => {
        patchValue(
          nextType === "free"
            ? { priceType: nextType, ticketPrice: "", discountPercentage: "" }
            : { priceType: nextType },
        );
      }}
      onTicketPriceChange={(nextPrice) => patchValue({ ticketPrice: nextPrice })}
      onDiscountChange={(nextDiscount) =>
        patchValue({ discountPercentage: nextDiscount })
      }
      disabled={disabled}
      errorMessage={errorMessage}
    />
  );
};

export default PriceSelector;
