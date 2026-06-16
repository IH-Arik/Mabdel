import { View, Text, Image, Pressable, FlatList, ActivityIndicator, Alert } from "react-native";
import React from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { responsiveHeight, responsiveWidth } from "react-native-responsive-dimensions";
import { LinearGradient } from "expo-linear-gradient";
import { widthPercentageToDP } from "react-native-responsive-screen";
import { useMadbelListShopProductsQuery } from "../../redux/slices/madbelApiSlice";

const DEFAULT_IMAGE = "https://images.unsplash.com/photo-1593095948071-474c5cc2989d?w=400&h=300&fit=crop";

const ProductCard = ({ product, onAddToCart }) => {
  const imageUri = product.imageUrl || product.image || DEFAULT_IMAGE;
  const displayPrice = typeof product.price === "number" ? `$${product.price}` : (product.price || "$0");

  return (
    <View className="bg-white rounded-2xl p-4 shadow-sm h-72 justify-between">
      <View className="items-center mb-2">
        <Image
          source={{ uri: imageUri }}
          className="w-20 h-20 rounded-lg"
          resizeMode="contain"
        />
      </View>

      <View className="bg-gray-100 self-start px-3 py-1 rounded-full mb-2">
        <Text className="text-xs font-semibold text-gray-700 uppercase">{product.category || "General"}</Text>
      </View>

      <View className="flex-1">
        <Text className="text-lg font-semibold text-gray-900 mb-1" numberOfLines={1}>{product.name}</Text>
        <Text className="text-sm text-gray-600 mb-2" numberOfLines={2}>{product.description}</Text>
        <Text className="text-xl font-bold text-gray-900">{displayPrice}</Text>
      </View>

      <LinearGradient
        colors={["#9333ea", "#ec4899"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ borderRadius: widthPercentageToDP(2) }}
        className="py-3 mt-2"
      >
        <Pressable onPress={() => onAddToCart(product)}>
          <Text className="text-white text-center font-semibold text-base">Add to Cart</Text>
        </Pressable>
      </LinearGradient>
    </View>
  );
};

const renderProductItem = ({ item, index }, onAddToCart) => (
  <View className={`w-1/2 p-1.5 ${index % 2 === 0 ? "pl-3 pr-1.5" : "pl-1.5 pr-3"}`}>
    <ProductCard product={item} onAddToCart={onAddToCart} />
  </View>
);

const ShopScreen = () => {
  const { data: responseData, isLoading } = useMadbelListShopProductsQuery({ page: 1, limit: 100 });
  const products = responseData?.data || [];

  const handleAddToCart = (product) => {
    Alert.alert(
      "Added to Cart",
      `${product?.name || "Product"} has been added to your cart.`,
      [{ text: "OK" }]
    );
  };

  return (
    <SafeAreaView
      className="flex-1 bg-gray-50"
      style={{
        paddingTop: responsiveWidth(5),
      }}
    >
      <View
        className="px-5"
        style={{
          paddingBottom: responsiveHeight(1.5),
        }}
      >
        <Text className="text-2xl font-bold text-gray-900">Shop</Text>
        <Text className="text-gray-500 mt-1">All products</Text>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color="#9333ea" />
        </View>
      ) : (
        <FlatList
          data={products}
          renderItem={(info) => renderProductItem(info, handleAddToCart)}
          numColumns={2}
          keyExtractor={(item) => `product-${item.id || item._id}`}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 24 }}
          columnWrapperStyle={{ justifyContent: "space-between", marginBottom: 6 }}
        />
      )}
    </SafeAreaView>
  );
};

export default ShopScreen;
