import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  Image,
  ActivityIndicator,
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
} from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import { useSelector } from "react-redux";
import {
  responsiveHeight,
  responsiveWidth,
} from "react-native-responsive-dimensions";
import SuccessModal from "../../components/SuccessModal";
import RatingCard from "../../components/RatingCard";
import ReportModal from "../../components/ReportModal";
import ConfirmModal from "../../components/ConfirmModal";
import { useCreateChatMessagesMutation } from "../../redux/slices/chat/chatSlice";
import { useJoinActivityMutation } from "../../redux/slices/event/eventSlice";

const imgSize = responsiveWidth(10);

const JoinActivityScreen = ({ route }) => {
  const navigation = useNavigation();
  const { item } = route.params || {};
  const authUser = useSelector((state) => state?.auth?.user);
  const loggedUserId = authUser?._id || authUser?.id || authUser?.userId;
  const [joined, setJoined] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [createHostThread, { isLoading: creatingThread }] = useCreateChatMessagesMutation();
  const [joinActivity, { isLoading: joiningActivity }] = useJoinActivityMutation();

  const activityHostId =
    item?.hostUserId ||
    item?.hostId ||
    item?.organizerId ||
    item?.creatorId ||
    item?.createdBy ||
    item?.userId ||
    item?.organizer?._id ||
    item?.organizer?.id;

  const isActivityHost =
    Boolean(activityHostId) &&
    Boolean(loggedUserId) &&
    String(activityHostId) === String(loggedUserId);

  const handleJoinActivity = async () => {
    if (isActivityHost) return;
    const activityId = item?._id || item?.id;
    if (!activityId || joiningActivity) return;

    try {
      await joinActivity(String(activityId)).unwrap();
      setJoined(true);
      setShowSuccessModal(true);
    } catch (error) {
      Alert.alert("Failed", "Could not join this activity. Please try again.");
    }
  };

  const handleCloseSuccessModal = () => {
    setShowSuccessModal(false);
  };

  const handleSubmitRating = (ratingData) => {
    // navigation.goBack();
  };

  const handleReport = (reportReason) => {
    // Handle report submission logic here
  };

  const handleLeaveActivity = () => {
    setJoined(false);
    setShowLeaveModal(false);
    // Add your leave activity logic here
  };

  const handleMessageHost = async () => {
    try {
      const payload = {};
      const targetId = item?._id || item?.id;
      const hostUserId =
        item?.hostUserId || item?.hostId || item?.creatorId || item?.organizerId || null;

      if (hostUserId) {
        payload.hostUserId = String(hostUserId);
      } else if (targetId) {
        payload.targetId = String(targetId);
      } else {
        return;
      }

      const thread = await createHostThread(payload).unwrap();
      if (!thread?._id) return;

      const conversation = {
        id: thread._id,
        name:
          thread?.directPeer?.fullName ||
          thread?.directPeer?.name ||
          item?.organizer ||
          "Host",
        avatar:
          thread?.directPeer?.profileImage ||
          thread?.directPeer?.avatar ||
          "https://robohash.org/user.png",
      };

      const chatNavPayload = {
        screen: "SingleChat",
        params: {
          threadId: thread._id,
          conversation,
        },
      };

      try {
        navigation.navigate("Chat", chatNavPayload);
      } catch {
        const parent = navigation.getParent?.();
        if (parent) {
          parent.navigate("Chat", chatNavPayload);
        } else {
          navigation.navigate("BottomNavigator", {
            screen: "Chat",
            params: chatNavPayload,
          });
        }
      }
    } catch (error) {
    }
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
        {/* Activity Title */}
        <Text className="text-2xl font-bold text-black ">
          {item?.title || "Morning Running Session"}
        </Text>

        {/* Organizer and Rating */}
        <View
          className="flex-row items-center"
          style={{ gap: responsiveWidth(2) }}
        >
          <Image
            source={require("../../../assets/images/profile.png")}
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
          <Text className="text-base text-gray-700 ml-3">
            Riverside Trail, Central Park
          </Text>
        </View>

        {/* View Full Map */}
        <Image
          source={require("../../../assets/images/viewMap.webp")}
          resizeMode="cover"
          className="w-full rounded-xl"
        />

        {/* Participants */}
        <View className="flex-row items-center">
          <Users size={20} color="#71ABE0" />
          <Text className="text-base text-gray-700 ml-3">
            {item?.participants.length}/{item?.maxParticipants} Participants
            Joined
          </Text>
        </View>

        {/* Join Activity Button */}
        {
          <Pressable
            onPress={handleJoinActivity}
            disabled={joiningActivity || joined || isActivityHost}
            className="bg-primary rounded-xl"
            style={{
              padding: responsiveWidth(3),
            }}
          >
            <Text className="text-black text-center font-bold text-lg">
              {isActivityHost
                ? "Activity Host"
                : joiningActivity
                  ? "Joining..."
                  : !joined
                    ? "Join Activity"
                    : "Joined"}
            </Text>
          </Pressable>
        }

        <Pressable
          onPress={handleMessageHost}
          disabled={creatingThread}
          className="bg-white border border-primary rounded-xl flex-row justify-center items-center gap-2"
          style={{
            padding: responsiveWidth(2.5),
          }}
        >
          {creatingThread ? (
            <ActivityIndicator size="small" color="#D6EB69" />
          ) : (
            <MessageCircle size={18} color="#D6EB69" />
          )}
          <Text className="text-black text-center font-bold text-lg">
            {creatingThread ? "Opening chat..." : "Message Host"}
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
        title="You Joined This Activity!"
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
        title="Report Activity"
        description="Please tell us why you're reporting this activity. Your report will be anonymous."
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
        onConfirm={handleLeaveActivity}
        title="Leave Activity?"
        description="Are you sure you want to leave this activity? This action cannot be undone."
        cancelButtonText="Cancel"
        confirmButtonText="Leave"
        cancelButtonColor="bg-gray-500"
        confirmButtonColor="bg-red-500"
        type="warning"
      />
    </SafeAreaView>
  );
};

export default JoinActivityScreen;
