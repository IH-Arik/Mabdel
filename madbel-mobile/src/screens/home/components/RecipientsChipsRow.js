import React from "react";
import { View, Text, Pressable, Image, ScrollView, ActivityIndicator } from "react-native";
import styles from "../CreateMeetingScheduleScreen.styles";

const RecipientsChipsRow = ({
  contacts,
  contactsFetching,
  selectedRecipientIds,
  onToggleRecipient,
}) => (
  <>
    <View style={[styles.row, styles.recipientsHead]}>
      <Text style={styles.sectionLabel}>
        RECIPIENTS ({selectedRecipientIds.length})
      </Text>
      {contactsFetching ? (
        <ActivityIndicator color="#11CDE8" size="small" />
      ) : null}
    </View>
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipsRow}
    >
      {contacts.map((contact) => {
        const selected = selectedRecipientIds.includes(contact.id);
        return (
          <Pressable
            key={contact.id}
            style={[styles.chip, selected && styles.chipSelected]}
            onPress={() => onToggleRecipient(contact.id)}
          >
            <View style={styles.chipAvatar}>
              {contact.avatar_url ? (
                <Image
                  source={{ uri: contact.avatar_url }}
                  style={styles.chipAvatarImage}
                />
              ) : (
                <Text style={styles.chipAvatarText}>
                  {String(contact.name || "NA")
                    .split(" ")
                    .map((v) => v[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </Text>
              )}
            </View>
            <Text style={styles.chipText}>{contact.name}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  </>
);

export default RecipientsChipsRow;
