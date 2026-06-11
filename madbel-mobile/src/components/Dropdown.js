import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  TouchableWithoutFeedback,
  Animated,
  TextInput,
} from 'react-native';
import { ChevronDown, Check, Search, X } from 'lucide-react-native';
import { responsiveHeight } from 'react-native-responsive-dimensions';

const Dropdown = ({
  data = [],
  placeholder = 'Select an option',
  selectedValue,
  onValueChange,
  style,
  dropdownStyle,
  itemStyle,
  textStyle,
  placeholderStyle,
  iconColor = '#6B7280',
  disabled = false,
  searchable = false,
  searchPlaceholder = 'Search...',
  emptySearchText = 'No options found',
  label,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState(selectedValue);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredData, setFilteredData] = useState(data);
  const searchInputRef = useRef(null);
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setFilteredData(data);
  }, [data]);

  useEffect(() => {
    if (searchQuery) {
      const filtered = data.filter(item =>
        item.label.toLowerCase().includes(searchQuery.toLowerCase()),
      );
      setFilteredData(filtered);
    } else {
      setFilteredData(data);
    }
  }, [searchQuery, data]);

  const toggleDropdown = () => {
    if (disabled) return;

    if (isVisible) {
      closeDropdown();
    } else {
      openDropdown();
    }
  };

  const openDropdown = () => {
    setIsVisible(true);
    setSearchQuery('');
    Animated.timing(animatedValue, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      if (searchable && searchInputRef.current) {
        searchInputRef.current.focus();
      }
    });
  };

  const closeDropdown = () => {
    setSearchQuery('');
    Animated.timing(animatedValue, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setIsVisible(false);
    });
  };

  const handleSelect = item => {
    setSelectedItem(item.value);
    onValueChange?.(item.value, item);
    closeDropdown();
  };

  const clearSearch = () => {
    setSearchQuery('');
  };

  const getSelectedLabel = () => {
    const selected = data.find(item => item.value === selectedItem);
    return selected ? selected.label : placeholder;
  };

  const rotateAnimation = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const opacityAnimation = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const scaleAnimation = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.95, 1],
  });

  const renderSearchHeader = () => {
    if (!searchable) return null;

    return (
      <View className="px-4 py-3 border-b border-gray-200 bg-gray-50">
        <View className="flex-row items-center bg-white rounded-lg px-3 py-2 border border-gray-300">
          <Search size={18} color="#6B7280" />
          <TextInput
            ref={searchInputRef}
            className="flex-1 ml-2 text-base text-gray-800"
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#9CA3AF"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={clearSearch}>
              <X size={18} color="#6B7280" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      className={`px-4 py-3 border-b border-gray-200 ${
        selectedItem === item.value ? 'bg-pink-50' : 'bg-white'
      }`}
      style={itemStyle}
      onPress={() => handleSelect(item)}
    >
      <View className="flex-row items-center justify-between">
        <Text
          className={`text-base ${
            selectedItem === item.value
              ? 'text-pink-600 font-medium'
              : 'text-gray-800'
          }`}
          style={textStyle}
        >
          {item.label}
        </Text>
        {selectedItem === item.value && <Check size={18} color="#FF69B4" />}
      </View>
    </TouchableOpacity>
  );

  const renderEmptyComponent = () => (
    <View className="py-8 items-center justify-center">
      <Text className="text-gray-500 text-base">{emptySearchText}</Text>
    </View>
  );

  return (
    <View className="w-full" >
      <Text
        className="text-base font-medium text-black"
        style={{
          marginBottom: responsiveHeight(1),
        }}
      >
        {label}
      </Text>
      <TouchableOpacity
        className={`flex-row items-center justify-between px-4 py-3 border border-border rounded-xl bg-white 
        `}
        onPress={toggleDropdown}
        disabled={disabled}
      >
        <Text
          className={`text-base flex-1 ${
            selectedItem ? 'text-gray-800' : 'text-gray-500'
          }`}
          style={selectedItem ? textStyle : placeholderStyle}
          numberOfLines={1}
        >
          {getSelectedLabel()}
        </Text>
        <Animated.View style={{ transform: [{ rotate: rotateAnimation }] }}>
          <ChevronDown size={20} color={iconColor} />
        </Animated.View>
      </TouchableOpacity>

      <Modal
        visible={isVisible}
        transparent
        animationType="none"
        onRequestClose={closeDropdown}
      >
        <TouchableWithoutFeedback onPress={closeDropdown}>
          <View className="flex-1 bg-black/50 justify-center">
            <TouchableWithoutFeedback>
              <Animated.View
                className="mx-4 bg-white rounded-lg max-h-80 "
                style={[
                  dropdownStyle,
                  {
                    opacity: opacityAnimation,
                    transform: [{ scale: scaleAnimation }],
                  },
                ]}
              >
                {renderSearchHeader()}
                <FlatList
                  data={filteredData}
                  renderItem={renderItem}
                  keyExtractor={item => item.value.toString()}
                  showsVerticalScrollIndicator={false}
                  nestedScrollEnabled
                  ListEmptyComponent={renderEmptyComponent}
                  keyboardShouldPersistTaps="handled"
                />
              </Animated.View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
};

export default Dropdown;
