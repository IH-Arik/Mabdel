import { useCallback, useMemo, useState, useEffect } from "react";
import { useNavigation } from "@react-navigation/native";
import { useInfiniteEvents } from "./useInfiniteEvents";

const formatEventForCard = (event) => {
  const startDate = event?.startAt ? new Date(event.startAt) : null;

  return {
    ...event,
    id: event?.id || event?._id,
    title: event?.name || "Untitled Event",
    type: event?.type || "Event",
    organizer: event?.creatorName || event?.creatorUsername || "Unknown Host",
    description: event?.description || "No description available.",
    heroImage:
      event?.imageUrl ||
      "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=400&h=200&fit=crop",
    price: event?.price || 0,
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
    joinedCount: event?.joinedCount || 0,
    maxParticipants: event?.participantLimit || 0,
    participants: [],
  };
};

export const useCommunityLogic = () => {
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
    events,
    isLoading,
    isFetching,
    isError,
    error,
    hasMore,
    loadNextPage,
    refresh,
    isRefreshing,
  } = useInfiniteEvents({
    pageSize: 10,
    initialPage: 1,
    filters,
  });

  const formattedEvents = useMemo(
    () => (events || []).map((event) => formatEventForCard(event)),
    [events],
  );

  const handleJoinEvent = useCallback(
    (item) => {
      navigation.navigate("JoinEvent", { item });
    },
    [navigation],
  );

  const handleRefresh = useCallback(() => {
    refresh();
  }, [refresh]);

  const handleLoadMore = useCallback(() => {
    if (hasMore && !isFetching) {
      loadNextPage();
    }
  }, [hasMore, isFetching, loadNextPage]);

  const handleRetry = useCallback(() => {
    refresh();
  }, [refresh]);

  const handleSearchChange = useCallback((value) => {
    setSearchText(value);
  }, []);

  const handleCategoryChange = useCallback((category) => {
    setSelectedCategory(category || "All");
  }, []);

  return {
    events: formattedEvents,
    isLoading,
    isError,
    error,
    hasMore,
    isFetching,
    isRefreshing,
    handleJoinEvent,
    handleRefresh,
    handleLoadMore,
    handleRetry,
    handleSearchChange,
    handleCategoryChange,
    searchText,
    selectedCategory,
  };
};
