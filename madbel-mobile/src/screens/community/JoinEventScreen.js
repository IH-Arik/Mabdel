import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ChevronLeft,
  MapPin,
  Calendar,
  Clock,
  Users,
  Star,
  MessageCircle,
  Flag,
  LogOut,
  TicketIcon,
} from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import {
  responsiveHeight,
  responsiveWidth,
} from "react-native-responsive-dimensions";
import SuccessModal from "../../components/SuccessModal";
import RatingCard from "../../components/RatingCard";
import ReportModal from "../../components/ReportModal";
import ConfirmModal from "../../components/ConfirmModal";
import PaymentMethodCard from "../../components/PaymentMethodCard";

const imgSize = responsiveWidth(10);

const JoinEventScreen = ({ route }) => {
  const navigation = useNavigation();
  const { item } = route.params || {};
  const [joined, setJoined] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);

  const joinedParticipantCount =
    item?.joinedCount ?? item?.participants?.length ?? 0;
  const participantLimit = item?.participantLimit ?? item?.maxParticipants ?? 0;
  const locationText = item?.location || "Location not available";

  const handleJoinEvent = () => {
    setJoined(true);
    setShowSuccessModal(true);
  };

  const handleCloseSuccessModal = () => {
    setShowSuccessModal(false);
  };

  const handleSubmitRating = (ratingData) => {
    console.log("Rating Data:", ratingData);
    // navigation.goBack();
  };

  const handleReport = (reportReason) => {
    console.log("Report submitted:", reportReason);
    // Handle report submission logic here
  };

  const handleLeaveEvent = () => {
    console.log("Leaving Event...");
    setJoined(false);
    setShowLeaveModal(false);
    // Add your leave Event logic here
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <Image
        source={{ uri: item.heroImage }}
        className="w-full"
        resizeMode="cover"
        style={{
          height: responsiveHeight(20),
          width: responsiveWidth(100),
          borderBottomLeftRadius: 20,
          borderBottomRightRadius: 20,
        }}
      />

      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          padding: responsiveWidth(5),
          gap: responsiveHeight(2),
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Event Title */}
        <Text className="text-2xl font-bold text-black ">
          {item?.title || "Morning Running Session"}
        </Text>

        {/* Organizer and Rating */}
        <View
          className="flex-row items-center"
          style={{ gap: responsiveWidth(2) }}
        >
          <Image
            source={
              item?.creatorImage
                ? { uri: item.creatorImage }
                : require("../../../assets/images/profile.png")
            }
            style={{
              width: imgSize,
              height: imgSize,
              borderRadius: imgSize / 2,
              resizeMode: "cover",
            }}
          />
          <View>
            <Text className="text-base text-gray-700 mr-2">
              {item?.organizer || "Alex Martinez"}
            </Text>
            <View className="flex-row items-center">
              <Star size={16} color="#F59E0B" fill="#F59E0B" />
              <Text className="text-sm text-gray-600 ml-1">4.9</Text>
            </View>
          </View>
        </View>

        {/* Description */}
        <Text className="text-base text-gray-600 leading-6">
          {item?.description ||
            "Join me for an energizing morning run through the scenic riverside trail. Perfect for all fitness levels. We'll maintain a comfortable pace and enjoy the beautiful sunrise views together."}
        </Text>

        {/* Date and Time */}
        <View className="flex-row items-center">
          <Calendar size={20} color="#71ABE0" />
          <Text className="text-base text-gray-700 ml-3">{item.date}</Text>
        </View>

        <View className="flex-row items-center">
          <Clock size={20} color="#71ABE0" />
          <Text className="text-base text-gray-700 ml-3">{item.time}</Text>
        </View>

        {/* Location */}
        <View className="flex-row items-center">
          <MapPin size={20} color="#71ABE0" />
          <Text className="text-base text-gray-700 ml-3">{locationText}</Text>
        </View>

        {/* View Full Map */}
        <Image
          source={require("../../../assets/images/viewMap.webp")}
          resizeMode="cover"
          className="w-full rounded-xl"
        />
        <View
          className="bg-primary rounded-xl flex-row justify-between items-center"
          style={{
            padding: responsiveWidth(3),
          }}
        >
          <View className="gap-2">
            <Text className="text-white">Event Price</Text>
            <Text className="text-white text-xl font-bold">
              {item?.price ? `$${item?.price}` : "Free"}
            </Text>
          </View>
          <TicketIcon size={22} color={"white"} />
        </View>

        {/* Participants */}
        <View className="flex-row items-center">
          <Users size={20} color="#71ABE0" />
          <Text className="text-base text-gray-700 ml-3">
            {joinedParticipantCount}/{participantLimit} Participants Joined
          </Text>
        </View>

        <PaymentMethodCard />

        {/* Join Event Button */}
        {
          <Pressable
            onPress={handleJoinEvent}
            className="bg-primary rounded-xl"
            style={{
              padding: responsiveWidth(3),
            }}
          >
            <Text className="text-black text-center font-bold text-lg">
              {!joined ? "Join Event" : "Joined"}
            </Text>
          </Pressable>
        }

        <Pressable
          className="bg-white border border-primary rounded-xl flex-row justify-center items-center gap-2"
          style={{
            padding: responsiveWidth(2.5),
          }}
        >
          <MessageCircle size={18} color="#D6EB69" />
          <Text className="text-black text-center font-bold text-lg">
            Message Host
          </Text>
        </Pressable>

        {/* Action Buttons */}
        <View
          className="flex-row justify-center items-center"
          style={{ gap: responsiveWidth(4) }}
        >
          <Pressable
            className="flex-row items-center py-3"
            onPress={() => setShowReportModal(true)}
          >
            <Flag size={20} color="#6B7280" />
            <Text className="text-base text-gray-700 ml-3">Report</Text>
          </Pressable>

          {joined && (
            <Pressable
              className="flex-row items-center py-3"
              onPress={() => setShowLeaveModal(true)}
            >
              <LogOut size={20} color="#EF4444" />
              <Text className="text-base text-red-500 ml-3">Leave</Text>
            </Pressable>
          )}
        </View>

        {/* Rating Card - Shows after joining */}
        {joined && (
          <RatingCard
            onSubmit={handleSubmitRating}
            title="Rate"
            question="How was your workout experience?"
            subtitle="Quick feedback (optional)"
            commentsLabel="Additional comments (optional)"
            commentsPlaceholder="Share more details about your experience..."
            submitButtonText="Submit Rating"
            submitButtonColor="bg-blue-500"
            showStarRating={true}
            starRatingLabel="Rate your experience"
          />
        )}
      </ScrollView>

      {/* Success Modal */}
      <SuccessModal
        visible={showSuccessModal}
        onClose={handleCloseSuccessModal}
        title="You Joined This Event!"
        message="Get ready to meet your fitness partner."
        buttonText="Great!"
        buttonColor="bg-blue-500"
        autoClose={true}
        autoCloseTime={2000}
      />

      {/* Report Modal */}
      <ReportModal
        visible={showReportModal}
        onClose={() => setShowReportModal(false)}
        onReport={handleReport}
        title="Report Event"
        description="Please tell us why you're reporting this Event. Your report will be anonymous."
        placeholder="Describe the issue..."
        cancelButtonText="Cancel"
        submitButtonText="Submit Report"
        cancelButtonColor="bg-gray-500"
        submitButtonColor="bg-red-500"
      />

      {/* Leave Confirmation Modal */}
      <ConfirmModal
        visible={showLeaveModal}
        onClose={() => setShowLeaveModal(false)}
        onConfirm={handleLeaveEvent}
        title="Leave Event?"
        description="Are you sure you want to leave this Event? This action cannot be undone."
        cancelButtonText="Cancel"
        confirmButtonText="Leave"
        cancelButtonColor="bg-gray-500"
        confirmButtonColor="bg-red-500"
        type="warning"
      />
    </SafeAreaView>
  );
};

export default JoinEventScreen;
