import React, { useState, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { ChevronLeft, Star, MessageSquare, Trash2, ChevronDown } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import {
  useMadbelListGoogleBusinessAccountsQuery,
  useLazyMadbelListGoogleReviewsQuery,
  useMadbelReplyGoogleReviewMutation,
  useMadbelDeleteGoogleReviewReplyMutation,
  useMadbelSyncGoogleReviewsToInboxMutation,
} from "../../redux/slices/madbelSmartflowSlice";

const STAR_COLORS = {
  ONE: "#FF6B6B",
  TWO: "#FFA94D",
  THREE: "#FFD43B",
  FOUR: "#A9E34B",
  FIVE: "#69DB7C",
};

const ratingToNumber = (rating) => {
  const map = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
  return map[rating] || 0;
};

const StarRating = ({ rating }) => {
  const count = ratingToNumber(rating);
  const color = STAR_COLORS[rating] || "#9BA7BB";
  return (
    <View style={{ flexDirection: "row", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={14}
          color={color}
          fill={i <= count ? color : "transparent"}
        />
      ))}
    </View>
  );
};

const GoogleReviewsScreen = () => {
  const navigation = useNavigation();

  const { data: accountsResp, isLoading: loadingAccounts, isError: accountsError } =
    useMadbelListGoogleBusinessAccountsQuery();

  const accounts = accountsResp?.data || [];

  const [selectedAccount, setSelectedAccount] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);
  const [locationDropdownOpen, setLocationDropdownOpen] = useState(false);

  const [fetchReviews, { data: reviewsResp, isFetching: loadingReviews }] =
    useLazyMadbelListGoogleReviewsQuery();

  const [replyMutation, { isLoading: isReplying }] = useMadbelReplyGoogleReviewMutation();
  const [deleteReplyMutation, { isLoading: isDeletingReply }] = useMadbelDeleteGoogleReviewReplyMutation();
  const [syncToInbox, { isLoading: isSyncing }] = useMadbelSyncGoogleReviewsToInboxMutation();

  const [replyModal, setReplyModal] = useState({ visible: false, review: null });
  const [replyText, setReplyText] = useState("");

  const accountId = selectedAccount?.name?.split("/").pop();
  const locationId = selectedLocation?.name?.split("/").pop();
  const reviews = reviewsResp?.data || [];

  const locations = selectedAccount?.locations || [];

  const handleSelectAccount = useCallback(async (account) => {
    setSelectedAccount(account);
    setSelectedLocation(null);
    setAccountDropdownOpen(false);
  }, []);

  const handleSelectLocation = useCallback((location) => {
    setSelectedLocation(location);
    setLocationDropdownOpen(false);
    const accId = selectedAccount?.name?.split("/").pop();
    const locId = location?.name?.split("/").pop();
    if (accId && locId) {
      fetchReviews({ account_id: accId, location_id: locId });
    }
  }, [selectedAccount, fetchReviews]);

  const openReplyModal = (review) => {
    setReplyModal({ visible: true, review });
    setReplyText(review.reviewReply?.comment || "");
  };

  const closeReplyModal = () => {
    setReplyModal({ visible: false, review: null });
    setReplyText("");
  };

  const handleSyncToInbox = async () => {
    if (!accountId || !locationId) {
      Alert.alert("Select Location", "Please select an account and location first.");
      return;
    }
    try {
      const res = await syncToInbox({ account_id: accountId, location_id: locationId }).unwrap();
      Alert.alert("Synced!", `${res?.data?.synced || 0} review(s) added to Messages inbox.`);
    } catch (err) {
      Alert.alert("Error", err?.data?.message || "Sync failed.");
    }
  };

  const handleSubmitReply = async () => {
    if (!replyText.trim()) {
      Alert.alert("Error", "Reply cannot be empty.");
      return;
    }
    const reviewId = replyModal.review?.reviewId;
    try {
      await replyMutation({
        account_id: accountId,
        location_id: locationId,
        review_id: reviewId,
        comment: replyText.trim(),
      }).unwrap();
      closeReplyModal();
      fetchReviews({ account_id: accountId, location_id: locationId });
      Alert.alert("Success", "Reply posted successfully.");
    } catch (err) {
      Alert.alert("Error", err?.data?.message || "Failed to post reply.");
    }
  };

  const handleDeleteReply = (review) => {
    Alert.alert("Delete Reply", "Are you sure you want to delete this reply?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteReplyMutation({
              account_id: accountId,
              location_id: locationId,
              review_id: review.reviewId,
            }).unwrap();
            fetchReviews({ account_id: accountId, location_id: locationId });
            Alert.alert("Success", "Reply deleted.");
          } catch (err) {
            Alert.alert("Error", err?.data?.message || "Failed to delete reply.");
          }
        },
      },
    ]);
  };

  const renderReview = ({ item }) => {
    const hasReply = !!item.reviewReply?.comment;
    const date = item.createTime
      ? new Date(item.createTime).toLocaleDateString()
      : "";
    return (
      <View style={styles.reviewCard}>
        <View style={styles.reviewHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.reviewerName}>
              {item.reviewer?.displayName || "Anonymous"}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
              <StarRating rating={item.starRating} />
              {date ? <Text style={styles.dateText}>{date}</Text> : null}
            </View>
          </View>
        </View>

        {item.comment ? (
          <Text style={styles.reviewComment}>{item.comment}</Text>
        ) : null}

        {hasReply && (
          <View style={styles.replyBox}>
            <Text style={styles.replyLabel}>Your Reply</Text>
            <Text style={styles.replyText}>{item.reviewReply.comment}</Text>
            <View style={styles.replyActions}>
              <Pressable
                style={styles.editReplyBtn}
                onPress={() => openReplyModal(item)}
              >
                <MessageSquare size={14} color="#16CDE9" />
                <Text style={styles.editReplyText}>Edit</Text>
              </Pressable>
              <Pressable
                style={styles.deleteReplyBtn}
                onPress={() => handleDeleteReply(item)}
              >
                <Trash2 size={14} color="#FF6B6B" />
                <Text style={styles.deleteReplyText}>Delete</Text>
              </Pressable>
            </View>
          </View>
        )}

        {!hasReply && (
          <Pressable
            style={styles.replyBtn}
            onPress={() => openReplyModal(item)}
          >
            <MessageSquare size={16} color="#03141E" />
            <Text style={styles.replyBtnText}>Reply</Text>
          </Pressable>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ChevronLeft size={36} color="#F1F7FF" />
          </Pressable>
          <Text style={styles.title}>Google Reviews</Text>
          <View style={styles.backBtn} />
        </View>

        {loadingAccounts ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#16CDE9" />
            <Text style={styles.stateText}>Loading accounts...</Text>
          </View>
        ) : accountsError ? (
          <View style={styles.center}>
            <Text style={styles.stateText}>Failed to load Google Business accounts.</Text>
            <Text style={styles.hintText}>
              {accountsResp?.error?.data?.message || accountsError?.data?.message || accountsError?.error || JSON.stringify(accountsError)}
            </Text>
          </View>
        ) : accounts.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.stateText}>No Google Business accounts found.</Text>
          </View>
        ) : (
          <>
            {/* Account selector */}
            <Pressable
              style={styles.dropdown}
              onPress={() => setAccountDropdownOpen((v) => !v)}
            >
              <Text style={styles.dropdownText} numberOfLines={1}>
                {selectedAccount?.accountName || "Select Business Account"}
              </Text>
              <ChevronDown size={18} color="#9BA7BB" />
            </Pressable>
            {accountDropdownOpen && (
              <View style={styles.dropdownList}>
                {accounts.map((acc) => (
                  <Pressable
                    key={acc.name}
                    style={styles.dropdownItem}
                    onPress={() => handleSelectAccount(acc)}
                  >
                    <Text style={styles.dropdownItemText}>{acc.accountName}</Text>
                  </Pressable>
                ))}
              </View>
            )}

            {/* Location selector */}
            {selectedAccount && (
              <>
                <Pressable
                  style={[styles.dropdown, { marginTop: 10 }]}
                  onPress={() => setLocationDropdownOpen((v) => !v)}
                >
                  <Text style={styles.dropdownText} numberOfLines={1}>
                    {selectedLocation?.title || selectedLocation?.locationName || selectedLocation?.name || "Select Location"}
                  </Text>
                  <ChevronDown size={18} color="#9BA7BB" />
                </Pressable>
                {locationDropdownOpen && (
                  <View style={styles.dropdownList}>
                    {locations.length === 0 ? (
                      <Text style={[styles.dropdownItemText, { padding: 12 }]}>
                        No locations found
                      </Text>
                    ) : (
                      locations.map((loc) => (
                        <Pressable
                          key={loc.name}
                          style={styles.dropdownItem}
                          onPress={() => handleSelectLocation(loc)}
                        >
                          <Text style={styles.dropdownItemText}>
                            {loc.title || loc.locationName || loc.name}
                          </Text>
                        </Pressable>
                      ))
                    )}
                  </View>
                )}
              </>
            )}

            {/* Sync button */}
            {selectedLocation && (
              <Pressable
                style={styles.syncBtn}
                onPress={handleSyncToInbox}
                disabled={isSyncing}
              >
                {isSyncing ? (
                  <ActivityIndicator size="small" color="#03141E" />
                ) : (
                  <Text style={styles.syncBtnText}>Sync Reviews to Messages</Text>
                )}
              </Pressable>
            )}

            {/* Reviews list */}
            {selectedLocation && (
              loadingReviews ? (
                <View style={styles.center}>
                  <ActivityIndicator size="large" color="#16CDE9" />
                  <Text style={styles.stateText}>Loading reviews...</Text>
                </View>
              ) : reviews.length === 0 ? (
                <View style={styles.center}>
                  <Text style={styles.stateText}>No reviews found.</Text>
                </View>
              ) : (
                <FlatList
                  data={reviews}
                  keyExtractor={(item) => item.reviewId}
                  renderItem={renderReview}
                  contentContainerStyle={{ gap: 12, paddingBottom: 32, paddingTop: 14 }}
                  showsVerticalScrollIndicator={false}
                />
              )
            )}
          </>
        )}
      </View>

      {/* Reply Modal */}
      <Modal
        visible={replyModal.visible}
        transparent
        animationType="fade"
        onRequestClose={closeReplyModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {replyModal.review?.reviewReply ? "Edit Reply" : "Write Reply"}
            </Text>
            <Text style={styles.modalReviewer}>
              {replyModal.review?.reviewer?.displayName || "Anonymous"}
            </Text>
            {replyModal.review?.comment ? (
              <Text style={styles.modalReviewText} numberOfLines={3}>
                "{replyModal.review.comment}"
              </Text>
            ) : null}
            <TextInput
              style={styles.replyInput}
              placeholder="Write your reply..."
              placeholderTextColor="#70829B"
              value={replyText}
              onChangeText={setReplyText}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <View style={styles.modalBtnRow}>
              <Pressable style={styles.modalBtnCancel} onPress={closeReplyModal}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.modalBtnSubmit}
                onPress={handleSubmitReply}
                disabled={isReplying}
              >
                {isReplying ? (
                  <ActivityIndicator size="small" color="#03141E" />
                ) : (
                  <Text style={styles.modalSubmitText}>Post Reply</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#020406" },
  container: { flex: 1, backgroundColor: "#020406", paddingHorizontal: 18, paddingTop: 8 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { color: "#F3F9FF", fontSize: 20, fontWeight: "700", flex: 1, textAlign: "center" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 10 },
  stateText: { color: "#9BA7BB", fontSize: 16, textAlign: "center" },
  hintText: { color: "#556070", fontSize: 13, textAlign: "center" },
  dropdown: {
    backgroundColor: "#1D1D21",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#2B3442",
    paddingHorizontal: 16,
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dropdownText: { color: "#F3F8FF", fontSize: 15, flex: 1 },
  dropdownList: {
    backgroundColor: "#1D1D21",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#2B3442",
    marginTop: 4,
    overflow: "hidden",
  },
  dropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#2B3442",
  },
  dropdownItemText: { color: "#F3F8FF", fontSize: 15 },
  reviewCard: {
    backgroundColor: "#1D1D21",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#2B3442",
    padding: 16,
    gap: 10,
  },
  reviewHeader: { flexDirection: "row", alignItems: "flex-start" },
  reviewerName: { color: "#F3F8FF", fontSize: 16, fontWeight: "600" },
  dateText: { color: "#556070", fontSize: 12 },
  reviewComment: { color: "#C5CDD8", fontSize: 14, lineHeight: 22 },
  replyBox: {
    backgroundColor: "#0C0E12",
    borderRadius: 12,
    padding: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: "#2B3442",
  },
  replyLabel: { color: "#16CDE9", fontSize: 12, fontWeight: "600" },
  replyText: { color: "#9BA7BB", fontSize: 14, lineHeight: 20 },
  replyActions: { flexDirection: "row", gap: 12, marginTop: 4 },
  editReplyBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  editReplyText: { color: "#16CDE9", fontSize: 13, fontWeight: "600" },
  deleteReplyBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  deleteReplyText: { color: "#FF6B6B", fontSize: 13, fontWeight: "600" },
  syncBtn: {
    backgroundColor: "#16CDE9",
    borderRadius: 14,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    marginBottom: 4,
  },
  syncBtnText: {
    color: "#03141E",
    fontSize: 15,
    fontWeight: "700",
  },
  replyBtn: {
    backgroundColor: "#16CDE9",
    borderRadius: 12,
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  replyBtnText: { color: "#03141E", fontSize: 15, fontWeight: "600" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "92%",
    backgroundColor: "#1D1D21",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#2B3442",
    padding: 22,
    gap: 12,
  },
  modalTitle: { color: "#F3F9FF", fontSize: 20, fontWeight: "700" },
  modalReviewer: { color: "#9BA7BB", fontSize: 14, fontWeight: "600" },
  modalReviewText: { color: "#556070", fontSize: 13, fontStyle: "italic", lineHeight: 20 },
  replyInput: {
    backgroundColor: "#0C0E12",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2B3442",
    color: "#F8FAFC",
    fontSize: 15,
    padding: 14,
    minHeight: 110,
  },
  modalBtnRow: { flexDirection: "row", gap: 12 },
  modalBtnCancel: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    backgroundColor: "#2B3442",
    alignItems: "center",
    justifyContent: "center",
  },
  modalBtnSubmit: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    backgroundColor: "#16CDE9",
    alignItems: "center",
    justifyContent: "center",
  },
  modalCancelText: { color: "#F8FAFC", fontSize: 15, fontWeight: "600" },
  modalSubmitText: { color: "#03141E", fontSize: 15, fontWeight: "600" },
});

export default GoogleReviewsScreen;
