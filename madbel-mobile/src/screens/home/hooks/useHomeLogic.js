import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigation } from "@react-navigation/native";
import { useInfiniteActivities } from "./useInfiniteActivities";

const formatActivityForCard = (activity) => {
  const startDate = activity?.startAt ? new Date(activity.startAt) : null;

  return {
    ...activity,
    id: activity?.id || activity?._id,
    title: activity?.name || "Untitled Activity",
    type: activity?.type || "Activity",
    organizer: activity?.creatorName || activity?.creatorUsername || "Unknown Host",
    description: activity?.description || "No description available.",
    heroImage:
      activity?.imageUrl ||
      "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=400&h=200&fit=crop",
    date: startDate
      ? startDate.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "Date TBD",
    time: startDate
      ? startDate.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        })
      : "Time TBD",
    distance: activity?.distanceMilesAway
      ? `${Number(activity.distanceMilesAway).toFixed(1)} miles away`
      : "-",
    maxParticipants: activity?.participantLimit || 0,
    participants: [],
  };
};

export const useHomeLogic = () => {
  const navigation = useNavigation();
  const [searchText, setSearchText] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [debouncedSearchText, setDebouncedSearchText] = useState("");

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearchText(searchText.trim());
    }, 400);

    return () => clearTimeout(timeout);
  }, [searchText]);

  const filters = useMemo(() => {
    const nextFilters = {};

    if (debouncedSearchText) {
      nextFilters.search = debouncedSearchText;
    }

    if (selectedCategory && selectedCategory !== "All") {
      nextFilters.type = selectedCategory.toLowerCase();
    }

    return nextFilters;
  }, [debouncedSearchText, selectedCategory]);

  const {
    activities,
    isLoading,
    isFetching,
    isError,
    error,
    hasMore,
    loadNextPage,
    refresh,
    isRefreshing,
  } = useInfiniteActivities({
    pageSize: 10,
    initialPage: 1,
    filters,
  });

  const formattedActivities = useMemo(
    () => (activities || []).map((activity) => formatActivityForCard(activity)),
    [activities],
  );

  const handleJoinActivity = useCallback(
    (item) => {
      navigation.navigate("JoinActivity", { item });
    },
    [navigation],
  );

  const handleCreateActivity = useCallback(() => {
    navigation.navigate("CreateActivity");
  }, [navigation]);

  const handleCreateEvent = useCallback(() => {
    navigation.navigate("CreateEvent");
  }, [navigation]);

  const handleLoadMore = useCallback(() => {
    if (hasMore && !isFetching) {
      loadNextPage();
    }
  }, [hasMore, isFetching, loadNextPage]);

  const handleSearchChange = useCallback((value) => {
    setSearchText(value);
  }, []);

  const handleCategoryChange = useCallback((category) => {
    setSelectedCategory(category || "All");
  }, []);

  return {
    activities: formattedActivities,
    isLoading,
    isError,
    error,
    hasMore,
    isFetching,
    isRefreshing,
    handleJoinActivity,
    handleCreateActivity,
    handleCreateEvent,
    handleLoadMore,
    handleRefresh: refresh,
    handleRetry: refresh,
    handleSearchChange,
    handleCategoryChange,
    searchText,
  };
};
