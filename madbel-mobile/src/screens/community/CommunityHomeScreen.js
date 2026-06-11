import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  ActivityIndicator,
} from "react-native";
import React from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  responsiveHeight,
  responsiveWidth,
} from "react-native-responsive-dimensions";
import { Search, SlidersHorizontal } from "lucide-react-native";
import CategorySelector from "../../components/CategorySelector";
import EventCard from "../../components/EventCard";
import { useCommunityLogic } from "./hooks/useCommunityLogic";

const CommunityHomeScreen = () => {
  const {
    events,
    isLoading,
    isError,
    error,
    isFetching,
    isRefreshing,
    hasMore,
    handleJoinEvent,
    handleLoadMore,
    handleRefresh,
    handleRetry,
    handleSearchChange,
    handleCategoryChange,
    searchText,
  } = useCommunityLogic();

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#D6EB69" />
        <Text className="text-gray-500 mt-3">Loading events...</Text>
      </SafeAreaView>
    );
  }

  if (isError && !events.length) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center px-6">
        <Text className="text-black text-lg font-semibold text-center">
          Failed to load events
        </Text>
        <Text className="text-gray-500 text-center mt-2">
          {error?.data?.message || "Please check your connection and try again."}
        </Text>
        <Pressable
          onPress={handleRetry}
          className="bg-primary rounded-xl mt-4"
          style={{ paddingHorizontal: responsiveWidth(6), paddingVertical: responsiveHeight(1.5) }}
        >
          <Text className="text-black font-bold">Retry</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      className="flex-1 justify-center bg-white"
      style={{
        paddingTop: responsiveWidth(5),
        paddingHorizontal: responsiveWidth(5),
        gap: responsiveHeight(2),
      }}
    >
      <FlatList
        data={events}
      
        renderItem={({ item }) => (
          <EventCard item={item} onPress={handleJoinEvent} />
        )}
        onEndReachedThreshold={0.4}
        onEndReached={handleLoadMore}
        refreshing={isRefreshing}
        onRefresh={handleRefresh}
        ListFooterComponent={
          isFetching && hasMore ? (
            <View className="py-4 items-center">
              <ActivityIndicator size="small" color="#D6EB69" />
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View className="py-10 items-center">
            <Text className="text-gray-500">No events found.</Text>
          </View>
        }
        ListHeaderComponent={
          <View style={{ gap: responsiveHeight(2) }}>
            <View
              className="flex-row items-center"
              style={{
                gap: responsiveWidth(1),
              }}
            >
              <View
                className="flex-row items-center bg-white rounded-lg border border-primary"
                style={{
                  width: responsiveWidth(80),
                  paddingHorizontal: responsiveWidth(3),
                }}
              >
    
                <Search size={20} color="#6B7280" />

        
                <TextInput
                  className="flex-1 ml-2 text-gray-900 text-base p-2"
                  placeholder="Search activities or users"
                  placeholderTextColor="#9CA3AF"
                  returnKeyType="search"
                  value={searchText}
                  onChangeText={handleSearchChange}
                />


              </View>
              <Pressable className="p-2 border border-black rounded-full">
     
                <SlidersHorizontal size={22} color={"black"} />
              </Pressable>
            </View>
            <CategorySelector
              categories={[
                "All",
                "Walking",
                "Running",
                "Cycling",
                "Swimming",
                "Workout",
                "Related",
              ]}
              initialCategory="All"
              onCategoryChange={handleCategoryChange}
            />
          </View>
        }
        showsVerticalScrollIndicator={false}
        keyExtractor={(item, index) =>
          String(item?.id || item?._id || `event-${index}`)
        }
        contentContainerStyle={{ gap: responsiveHeight(2) }}
      />
    </SafeAreaView>
  );
};

export default CommunityHomeScreen;
