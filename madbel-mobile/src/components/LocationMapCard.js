import React, { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { responsiveHeight, responsiveWidth } from "react-native-responsive-dimensions";
import { MapPin } from "lucide-react-native";
import MapView, { Marker } from "react-native-maps";

const DEFAULT_REGION = {
  latitude: 40.785091,
  longitude: -73.968285,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

const LocationMapCard = ({
  label = "Location",
  selectedLocation,
  onLocationChange,
  disabled = false,
}) => {
  const [isMapModalVisible, setIsMapModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const mapRef = useRef(null);

  const markerCoordinate =
    selectedLocation &&
    typeof selectedLocation?.latitude === "number" &&
    typeof selectedLocation?.longitude === "number"
      ? {
          latitude: selectedLocation.latitude,
          longitude: selectedLocation.longitude,
        }
      : null;

  const region = markerCoordinate
    ? { ...markerCoordinate, latitudeDelta: 0.01, longitudeDelta: 0.01 }
    : DEFAULT_REGION;

  const updateLocation = (coordinate) => {
    if (!coordinate) return;
    onLocationChange?.({
      latitude: coordinate.latitude,
      longitude: coordinate.longitude,
    });
  };

  const handleMapPress = (event) => {
    if (disabled) return;
    const nextCoordinate = event?.nativeEvent?.coordinate;
    if (!nextCoordinate) return;
    updateLocation(nextCoordinate);
  };

  const handleSelectSearchResult = (result) => {
    const latitude = Number.parseFloat(result?.lat);
    const longitude = Number.parseFloat(result?.lon);
    if (Number.isNaN(latitude) || Number.isNaN(longitude)) return;

    const nextCoordinate = { latitude, longitude };
    updateLocation(nextCoordinate);
    setSearchResults([]);
    setSearchQuery(result?.display_name || "");
    mapRef.current?.animateToRegion(
      { ...nextCoordinate, latitudeDelta: 0.01, longitudeDelta: 0.01 },
      300,
    );
  };

  const handleSearchLocation = async () => {
    const query = searchQuery.trim();
    if (!query) return;

    setIsSearching(true);
    setSearchError("");

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=6`,
        {
          headers: {
            Accept: "application/json",
          },
        },
      );

      if (!response.ok) {
        throw new Error("Location search failed");
      }

      const data = await response.json();
      setSearchResults(Array.isArray(data) ? data : []);
    } catch (error) {
      setSearchResults([]);
      setSearchError("Unable to fetch locations. Please try again.");
    } finally {
      setIsSearching(false);
    }
  };

  const locationLabel = markerCoordinate
    ? `${markerCoordinate.latitude.toFixed(5)}, ${markerCoordinate.longitude.toFixed(5)}`
    : "Tap on map to set event location";

  const displayedRegion = useMemo(
    () =>
      markerCoordinate
        ? { ...markerCoordinate, latitudeDelta: 0.01, longitudeDelta: 0.01 }
        : DEFAULT_REGION,
    [markerCoordinate],
  );

  return (
    <View>
      <Text className="text-base font-medium text-black mb-2">{label}</Text>
      <Pressable
        className="rounded-xl overflow-hidden border border-border"
        onPress={() => !disabled && setIsMapModalVisible(true)}
        disabled={disabled}
      >
        <MapView
          style={{
            width: "100%",
            height: responsiveHeight(18),
          }}
          initialRegion={region}
          region={displayedRegion}
          pointerEvents="none"
        >
          {markerCoordinate ? <Marker coordinate={markerCoordinate} /> : null}
        </MapView>

        <View className="absolute left-0 right-0 bottom-0">
          <View
            className="bg-black/45 flex-row items-center"
            style={{
              paddingVertical: responsiveHeight(1),
              paddingHorizontal: responsiveWidth(3),
              gap: responsiveWidth(2),
            }}
          >
            <MapPin size={16} color="#fff" />
            <Text className="text-white flex-1">{locationLabel}</Text>
          </View>
        </View>
      </Pressable>

      <Modal
        visible={isMapModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsMapModalVisible(false)}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View
            className="bg-white rounded-t-3xl"
            style={{ padding: responsiveWidth(4), maxHeight: "92%" }}
          >
            <View className="flex-row items-center justify-between">
              <Text className="text-lg font-bold text-black">Select Location</Text>
              <Pressable onPress={() => setIsMapModalVisible(false)}>
                <Text className="text-primary font-semibold">Done</Text>
              </Pressable>
            </View>

            <View className="mt-3 flex-row items-center" style={{ gap: responsiveWidth(2) }}>
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search location"
                placeholderTextColor="#9CA3AF"
                className="flex-1 border border-border rounded-xl px-4 py-3 text-black"
                returnKeyType="search"
                onSubmitEditing={handleSearchLocation}
              />
              <Pressable
                onPress={handleSearchLocation}
                className="bg-primary rounded-xl"
                style={{ paddingHorizontal: responsiveWidth(4), paddingVertical: responsiveHeight(1.5) }}
              >
                <Text className="text-white font-semibold">Search</Text>
              </Pressable>
            </View>

            {isSearching ? (
              <View className="py-3 items-center">
                <ActivityIndicator color="#D6EB69" />
              </View>
            ) : null}

            {searchError ? (
              <Text className="text-red-500 mt-2">{searchError}</Text>
            ) : null}

            {!!searchResults.length && (
              <View
                className="border border-border rounded-xl mt-3"
                style={{ maxHeight: responsiveHeight(20) }}
              >
                <FlatList
                  data={searchResults}
                  keyExtractor={(item, index) => `${item?.place_id || "place"}-${index}`}
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item }) => (
                    <Pressable
                      className="px-3 py-3 border-b border-border"
                      onPress={() => handleSelectSearchResult(item)}
                    >
                      <Text numberOfLines={2} className="text-black">
                        {item?.display_name}
                      </Text>
                    </Pressable>
                  )}
                />
              </View>
            )}

            <View className="rounded-xl overflow-hidden border border-border mt-3">
              <MapView
                ref={mapRef}
                style={{
                  width: "100%",
                  height: responsiveHeight(40),
                }}
                initialRegion={region}
                region={displayedRegion}
                onPress={handleMapPress}
                scrollEnabled={!disabled}
                zoomEnabled={!disabled}
                rotateEnabled={!disabled}
                pitchEnabled={!disabled}
              >
                {markerCoordinate ? <Marker coordinate={markerCoordinate} /> : null}
              </MapView>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default LocationMapCard;
