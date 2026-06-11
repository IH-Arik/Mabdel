import React from "react";
import { Pressable, Text, View } from "react-native";
import { responsiveWidth } from "react-native-responsive-dimensions";

const rw = (value) => responsiveWidth(value);

const AnalyticsCallRow = ({ item, styles }) => {
  const Icon = item.icon;

  return (
    <View style={styles.callRow}>
      <View style={[styles.callIconWrap, item.muted && styles.callIconMuted]}>
        <Icon size={rw(4.8)} color={item.iconColor} />
      </View>
      <View style={styles.callTextWrap}>
        <Text style={styles.callName}>{item.name}</Text>
        <Text style={styles.callSub}>{item.subtitle}</Text>
      </View>
      {item.rightType === "badge" ? (
        <View style={styles.readyBadge}>
          <Text style={styles.readyText}>{item.rightText}</Text>
        </View>
      ) : (
        <Pressable>
          <Text style={styles.callbackText}>{item.rightText}</Text>
        </Pressable>
      )}
    </View>
  );
};

export default AnalyticsCallRow;
