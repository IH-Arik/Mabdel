import {
  View,
  Text,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  ActivityIndicator,
} from "react-native";
import { useAppLanguage } from "../../context/LanguageContext";
import React, { useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import Navbar from "../../components/Navbar";
import {
  responsiveHeight,
  responsiveWidth,
} from "react-native-responsive-dimensions";
import ControllerTextInput from "../../components/ControllerTextInput";
import { useFormContext } from "react-hook-form";
import Dropdown from "../../components/Dropdown";
import { types } from "../../../assets/data/data";
import ControllerTextAreaInput from "../../components/ControllerTextAreaInput";
import { formatSelectedDate } from "../../utils/formatSelectedDate";
import { Calendar } from "lucide-react-native";
import TimeSlotInput from "../../components/TimeSlotInput";
import SystemCalendarModal from "../../components/SystemCalendarModal";
import ParticipantCounter from "../../components/ParticipantCounter";
import { useNavigation } from "@react-navigation/native";
import MediaUploader from "../../components/MediaUploader";
import LocationMapCard from "../../components/LocationMapCard";
import SuccessModal from "../../components/SuccessModal";
import VoiceFormFillCard from "../../components/VoiceFormFillCard";
import { useCreateActivityMutation } from "../../redux/slices/event/eventSlice";
const CreateActivityScreen = () => {
  const { t } = useAppLanguage();
  const navigation = useNavigation();
  const {
    control,
    formState: { errors },
    handleSubmit,
    // setValue,
    setError,
  } = useFormContext();
  const [selectedValue, setSelectedValue] = useState("");
  const [startTime, setStartTime] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [eventLocation, setEventLocation] = useState(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [createActivity, { isLoading: createActivityLoading }] =
    useCreateActivityMutation();

  const handleStatusChange = (value) => {
    setSelectedValue(value);
  };

  const handleCreateActivity = async (data) => {


    if (!selectedDate) {
      setError("root", {
        type: "createActivity",
        message: "Please select an activity date.",
      });
      return;
    }

    if (!startTime) {
      setError("root", {
        type: "createActivity",
        message: "Please select a start time.",
      });
      return;
    }

    if (
      !Array.isArray(data?.activityMedia) ||
      data.activityMedia.length === 0
    ) {
      setError("root", {
        type: "createActivity",
        message: "Please upload at least one image or video.",
      });
      return;
    }

    try {
      const payload = {
        title: data?.activityTitle?.trim(),
        description: data?.activityDescription?.trim(),
        type: data?.activityType?.trim(),
        date: selectedDate,
        startAt: startTime?.toISOString?.() || String(startTime),
        participantLimit: data?.activityParticipantLimit,
        distanceMiles: data?.acitivityMile?.trim(),
        mediaFiles: data?.activityMedia || [],
        location:
          eventLocation &&
          typeof eventLocation?.latitude === "number" &&
          typeof eventLocation?.longitude === "number"
            ? {
                latitude: eventLocation.latitude,
                longitude: eventLocation.longitude,
              }
            : undefined,
      };
      await createActivity(payload).unwrap();
      setShowSuccessModal(true);
    } catch (error) {
      setError("root", {
        type: "createActivity",
        message: error?.data?.message || "Failed to create activity.",
      });
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#fff" }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      //   keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <SafeAreaView
          className="flex-1 justify-center  bg-white"
          style={{
            paddingTop: responsiveWidth(5),
            paddingHorizontal: responsiveWidth(5),
          }}
        >
          <Navbar title={t("create_activity")} />
          <ScrollView
            contentContainerStyle={{
              flexGrow: 1,

              // justifyContent: "center",
              // alignItems: "center",
              gap: responsiveHeight(3),
            }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <ControllerTextInput
              name="activityTitle"
              control={control}
              error={errors?.activityTitle?.message}
              label={t("title")}
              placeholder={t("enter_your_title")}
              type="text"
              rules={{
                required: "Title is required",
              }}
            />
            {/* <Dropdown
              data={types}
              selectedValue={selectedValue}
              onValueChange={handleStatusChange}
              placeholder={t("select_type")}
              label={t("type")}
            /> */}

            <ControllerTextInput
              name="activityType"
              control={control}
              error={errors?.activityType?.message}
              label={t("type")}
              placeholder={t("enter_your_type")}
              type="text"
              rules={{
                required: "Type is required",
              }}
            />

            <ControllerTextAreaInput
              name="activityDescription"
              control={control}
              error={errors?.activityDescription?.message}
              label={t("description")}
              placeholder={t("enter_your_description")}
              type="text"
              rules={{
                required: "Description is required",
              }}
            />
            <View className="gap-2">
              <Text className="text-base font-medium text-black mb-2">{t("select_date")}</Text>
              <Pressable
                className="border border-border rounded-xl "
                style={{
                  padding: responsiveWidth(4),
                }}
                onPress={() => setModalVisible(true)}
                // disabled={isLoading}
              >
                <View className="flex-row items-center gap-3">
                  <Calendar size={20} color="#555" />
                  <Text className="text-black font-regular">
                    {formatSelectedDate(selectedDate)}
                  </Text>
                </View>
              </Pressable>
            </View>
            <TimeSlotInput
              label={t("start_time")}
              value={startTime}
              onChange={setStartTime}
              // disabled={isLoading}
            />

            <LocationMapCard
              label={t("location")}
              selectedLocation={eventLocation}
              onLocationChange={setEventLocation}
              disabled={createActivityLoading}
            />
            <ParticipantCounter
              name="activityParticipantLimit"
              min={1}
              max={100}
              rules={{
                required: "Participant limit is required",
              }}
            />
            <ControllerTextInput
              name="acitivityMile"
              control={control}
              error={errors?.acitivityMile?.message}
              label={t("mile")}
              placeholder={t("how_many_miles_do_you_want_to_walk")}
              type="text"
              rules={{
                required: "Mile is required",
              }}
            />
            <MediaUploader
              control={control}
              name="activityMedia"
              label={t("upload_photos_videos")}
              maxFiles={6}
              mediaType="mixed"
              disabled={createActivityLoading}
            />
            <VoiceFormFillCard
              label={t("activity")}
              workflowIntent="activity"
              sourceScreen="CreateActivity"
            />
          </ScrollView>
          <View style={{ marginTop: responsiveHeight(2) }}>
            <Pressable
              onPress={handleSubmit(handleCreateActivity)}
              className={`${
                createActivityLoading ? "bg-gray-500" : "bg-primary"
              } rounded-3xl`}
              style={{
                padding: responsiveWidth(3),
              }}
              disabled={createActivityLoading}
            >
              {createActivityLoading ? (
                <ActivityIndicator color={"#edbe9c"} size={20} />
              ) : (
                <Text className="text-white text-center font-bold text-lg">{t("create_activity")}</Text>
              )}
            </Pressable>
          </View>
          {errors?.root?.type === "createActivity" && (
            <Text className="text-red-500 text-center mt-2">
              {errors?.root?.message}
            </Text>
          )}
          <SystemCalendarModal
            visible={modalVisible}
            onClose={() => setModalVisible(false)}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />
          <SuccessModal
            visible={showSuccessModal}
            onClose={() => {
              setShowSuccessModal(false);
              navigation.goBack();
            }}
            title={t("activity_created")}
            message="Your activity has been created successfully."
            autoClose={true}
            autoCloseTime={1500}
          />
        </SafeAreaView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

export default CreateActivityScreen;
