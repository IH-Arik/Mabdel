import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { responsiveHeight, responsiveWidth } from "react-native-responsive-dimensions";
import { LinearGradient } from "expo-linear-gradient";
import ShimmerPlaceHolder from "react-native-shimmer-placeholder";

const rw = (value) => responsiveWidth(value);
const rh = (value) => responsiveHeight(value);

const Shimmer = ({ width, height, radius, style }) => (
  <ShimmerPlaceHolder
    visible={false}
    LinearGradient={LinearGradient}
    width={width}
    height={height}
    shimmerStyle={[
      {
        borderRadius: radius,
        backgroundColor: "#151D28",
      },
      style,
    ]}
    shimmerColors={["#151D28", "#1E2937", "#151D28"]}
  />
);

const HomeScreenSkeleton = () => (
  <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <View style={styles.header}>
      <Shimmer width={rw(52)} height={rh(4)} radius={10} />
      <View style={styles.headerRight}>
        <Shimmer width={rw(16)} height={rh(4.6)} radius={20} />
        <Shimmer width={rh(4.6)} height={rh(4.6)} radius={999} />
      </View>
    </View>

    <Shimmer width={rw(91)} height={rh(8.2)} radius={rw(5.2)} />
    <Shimmer width={rw(91)} height={rh(19)} radius={rw(5.2)} />

    <View style={styles.gridWrap}>
      <Shimmer width={rw(44)} height={rh(35)} radius={rw(5.2)} />
      <View style={styles.rightCol}>
        <Shimmer width={rw(44)} height={rh(16.5)} radius={rw(5.2)} />
        <Shimmer width={rw(44)} height={rh(16.5)} radius={rw(5.2)} />
      </View>
    </View>

    <Shimmer width={rw(91)} height={rh(23)} radius={rw(5.2)} />
    <Shimmer width={rw(91)} height={rh(27)} radius={rw(5.2)} />
  </ScrollView>
);

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: rw(4.5),
    paddingTop: rh(1.5),
    paddingBottom: rh(17),
    gap: rh(1.5),
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: rh(0.4),
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: rw(2.2),
  },
  gridWrap: {
    flexDirection: "row",
    gap: rw(2.8),
  },
  rightCol: {
    flex: 1,
    gap: rw(2.8),
  },
});

export default HomeScreenSkeleton;
