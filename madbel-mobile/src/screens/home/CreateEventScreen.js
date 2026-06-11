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
import React, { useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import Navbar from "../../components/Navbar";
import {
  responsiveHeight,
  responsiveWidth,
} from "react-native-responsive-dimensions";
import ControllerTextInput from "../../components/ControllerTextInput";
import { useFormContext } from "react-hook-form";
import ControllerTextAreaInput from "../../components/ControllerTextAreaInput";
import { formatSelectedDate } from "../../utils/formatSelectedDate";
import { Calendar } from "lucide-react-native";
import TimeSlotInput from "../../components/TimeSlotInput";
import SystemCalendarModal from "../../components/SystemCalendarModal";
import ParticipantCounter from "../../components/ParticipantCounter";
import { useNavigation } from "@react-navigation/native";
import PriceSelector from "../../components/PriceSelector";
import { useCreateEventMutation } from "../../redux/slices/event/eventSlice";
import MediaUploader from "../../components/MediaUploader";
import LocationMapCard from "../../components/LocationMapCard";
import SuccessModal from "../../components/SuccessModal";
import VoiceFormFillCard from "../../components/VoiceFormFillCard";
const CreateEventScreen = () => {
  const navigation = useNavigation();
  const {
    control,
    formState: { errors },
    handleSubmit,
    // setValue,
    setError,
  } = useFormContext();
  const [startTime, setStartTime] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [eventLocation, setEventLocation] = useState(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const [createEvent, { isLoading: createEventLoading }] =
    useCreateEventMutation();

  const handleCreateEvent = async (data) => {
    if (!selectedDate) {
      setError("root", {
        type: "createEvent",
        message: "Please select an event date.",
      });
      return;
    }

    if (!startTime) {
      setError("root", {
        type: "createEvent",
        message: "Please select a start time.",
      });
      return;
    }
    if (!Array.isArray(data?.eventMedia) || data.eventMedia.length === 0) {
      setError("root", {
        type: "createEvent",
        message: "Please upload at least one image or video.",
      });
      return;
    }
    if (data?.priceType === "paid" && !data?.ticketPrice) {
      setError("root", {
        type: "createEvent",
        message: "Please set a ticket price for paid events.",
      });
      return;
    }

    try {
      const ticketPriceNumber = data?.ticketPrice
        ? Number.parseFloat(data.ticketPrice)
        : null;
      const discountNumber = data?.discountPercentage
        ? Number.parseFloat(data.discountPercentage)
        : null;
      if (
        data?.priceType === "paid" &&
        (Number.isNaN(ticketPriceNumber) || ticketPriceNumber <= 0)
      ) {
        setError("root", {
          type: "createEvent",
          message: "Ticket price must be greater than 0.",
        });
        return;
      }
      if (
        discountNumber !== null &&
        (Number.isNaN(discountNumber) ||
          discountNumber < 0 ||
          discountNumber > 100)
      ) {
        setError("root", {
          type: "createEvent",
          message: "Discount must be between 0 and 100.",
        });
        return;
      }

      const payload = {
        title: data?.eventTitle?.trim(),
        description: data?.eventDescription?.trim(),
        type: data?.eventType?.trim(),
        date: selectedDate,
        startAt: startTime?.toISOString?.() || String(startTime),
        durationMinutes: data?.eventDuration?.trim(),
        participantLimit: data?.participantLimit,
        priceType: data?.priceType || "free",
        ticketPrice: data?.priceType === "paid" ? ticketPriceNumber : 0,
        discountPercentage: discountNumber,
        mediaFiles: data?.eventMedia || [],
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
      await createEvent(payload).unwrap();
      setShowSuccessModal(true);
    } catch (error) {
      setError("root", {
        type: "createEvent",
        message: error?.data?.message || "Failed to create event.",
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
          <Navbar title="Create Event" />
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
              name="eventTitle"
              control={control}
              error={errors?.eventTitle?.message}
              label="Title"
              placeholder="Enter your title"
              type="text"
              rules={{
                required: "Title is required",
              }}
            />
            <ControllerTextInput
              name="eventType"
              control={control}
              error={errors?.eventType?.message}
              label="Type"
              placeholder="Enter your type"
              type="text"
              rules={{
                required: "Type is required",
              }}
            />

            <ControllerTextAreaInput
              name="eventDescription"
              control={control}
              error={errors?.eventDescription?.message}
              label="Description"
              placeholder="Enter your description"
              type="text"
              rules={{
                required: "Description is required",
              }}
            />
            
            <View className="gap-2">
              <Text className="text-base font-medium text-black mb-2">
                Select Date
              </Text>
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
              label="Start Time"
              value={startTime}
              onChange={setStartTime}
              // disabled={isLoading}
            />
            <LocationMapCard
              label="Location"
              selectedLocation={eventLocation}
              onLocationChange={setEventLocation}
              disabled={createEventLoading}
            />
            <ParticipantCounter
              name="participantLimit"
              min={1}
              max={25}
              rules={{
                required: "Participant limit is required",
                min: {
                  value: 1,
                  message: "Participant limit must be at least 1",
                },
                max: {
                  value: 25,
                  message: "Participant limit must be 25 or less",
                },
              }}
            />

            <PriceSelector control={control} />

            <ControllerTextInput
              name="eventDuration"
              control={control}
              error={errors?.eventDuration?.message}
              label="Event Duration"
              placeholder="Share your event time duration."
              type="text"
              rules={{
                required: "Event Duration is required",
              }}
            />

            <MediaUploader
              control={control}
              name="eventMedia"
              label="Upload Photos/Videos"
              maxFiles={6}
              mediaType="mixed"
              disabled={createEventLoading}
            />
            <VoiceFormFillCard
              label="event"
              workflowIntent="event"
              sourceScreen="CreateEvent"
            />
          </ScrollView>
          <View style={{ marginTop: responsiveHeight(2) }}>
            <Pressable
              onPress={handleSubmit(handleCreateEvent)}
              className={`${createEventLoading ? "bg-gray-500" : "bg-primary"} rounded-3xl`}
              style={{
                padding: responsiveWidth(3),
              }}
              disabled={createEventLoading}
            >
              {createEventLoading ? (
                <ActivityIndicator color={"#edbe9c"} size={20} />
              ) : (
                <Text className="text-white text-center font-bold text-lg">
                  Create Event
                </Text>
              )}
            </Pressable>
          </View>
          {errors?.root?.type === "createEvent" && (
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
            title="Event Created"
            message="Your event has been created successfully."
            autoClose={true}
            autoCloseTime={1500}
          />
        </SafeAreaView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

export default CreateEventScreen;
