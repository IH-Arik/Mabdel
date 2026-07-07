import React, { useState } from "react";
import { View, Text, TextInput, Pressable } from "react-native";
import { Star } from "lucide-react-native";
import { useAppLanguage } from "../context/LanguageContext";

const RatingCard = ({
  onSubmit,
  initialFeedback = [],
  initialComments = "",
  initialRating = 0,
  title,
  question,
  subtitle,
  commentsLabel,
  commentsPlaceholder,
  submitButtonText,
  submitButtonColor = "bg-blue-500",
  showStarRating = true,
  starRatingLabel,
}) => {
  const { t } = useAppLanguage();
  const [selectedFeedback, setSelectedFeedback] = useState(initialFeedback);
  const [comments, setComments] = useState(initialComments);
  const [rating, setRating] = useState(initialRating);

  const resolvedTitle = title || t("rate");
  const resolvedQuestion = question || t("how_was_your_workout_experience");
  const resolvedSubtitle = subtitle || t("quick_feedback_optional");
  const resolvedCommentsLabel = commentsLabel || t("additional_comments_optional");
  const resolvedCommentsPlaceholder =
    commentsPlaceholder || t("share_more_details_about_your_experience");
  const resolvedSubmitButtonText = submitButtonText || t("submit_rating");
  const resolvedStarRatingLabel = starRatingLabel || t("rate_your_experience");

  const feedbackOptions = [
    t("friendly"),
    t("on_time"),
    t("motivating"),
    t("professional"),
    t("not_punctual"),
    t("disrespectful"),
  ];

  const toggleFeedback = (option) => {
    if (selectedFeedback.includes(option)) {
      setSelectedFeedback(selectedFeedback.filter((item) => item !== option));
    } else {
      setSelectedFeedback([...selectedFeedback, option]);
    }
  };

  const handleStarPress = (starCount) => {
    setRating(starCount);
  };

  const handleSubmit = () => {
    if (onSubmit) {
      onSubmit({
        rating: rating,
        feedback: selectedFeedback,
        comments: comments,
      });
    }
  };

  return (
    <View className="mt-6 border-t border-gray-200 pt-6">
      <Text className="text-lg font-semibold text-gray-900 mb-2">{resolvedTitle}</Text>
      <Text className="text-lg font-semibold text-gray-900 mb-2">
        {resolvedQuestion}
      </Text>

      {/* Star Rating */}
      {showStarRating && (
        <View className="mb-6">
          <Text className="text-base text-gray-700 mb-3">
            {resolvedStarRatingLabel}
          </Text>
          <View className="flex-row justify-center space-x-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <Pressable
                key={star}
                onPress={() => handleStarPress(star)}
                className="p-1"
              >
                <Star
                  size={32}
                  color="#F59E0B"
                  fill={star <= rating ? "#F59E0B" : "none"}
                />
              </Pressable>
            ))}
          </View>
          {/* {rating > 0 && (
            <Text className="text-center text-gray-600 mt-2">
              {rating} star{rating !== 1 ? 's' : ''}
            </Text>
          )} */}
        </View>
      )}
      <Text className="text-base text-gray-500 mb-4">{resolvedSubtitle}</Text>
      {/* Feedback Options */}
      <View className="flex-row flex-wrap -mx-1 mb-6">
        {feedbackOptions.map((option, index) => (
          <Pressable
            key={option}
            className={`mx-1 mb-2 px-4 py-2 rounded-full border ${
              selectedFeedback.includes(option)
                ? "bg-blue-500 border-blue-500"
                : "bg-white border-gray-300"
            }`}
            onPress={() => toggleFeedback(option)}
          >
            <Text
              className={`text-sm ${
                selectedFeedback.includes(option)
                  ? "text-white"
                  : "text-gray-700"
              }`}
            >
              {option}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Additional Comments */}
      <Text className="text-base text-gray-500 mb-3">{resolvedCommentsLabel}</Text>
      <TextInput
        className="border border-gray-300 rounded-xl p-4 h-32 text-base text-gray-700 mb-6"
        placeholder={resolvedCommentsPlaceholder}
        placeholderTextColor="#9CA3AF"
        multiline={true}
        textAlignVertical="top"
        value={comments}
        onChangeText={setComments}
      />

      {/* Submit Button */}
      <Pressable
        className={`${submitButtonColor} rounded-xl py-4 mb-4`}
        onPress={handleSubmit}
      >
        <Text className="text-white text-center text-lg font-semibold">
          {resolvedSubmitButtonText}
        </Text>
      </Pressable>
    </View>
  );
};

export default RatingCard;
