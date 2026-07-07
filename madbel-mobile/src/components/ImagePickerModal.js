import React from 'react';
import { useAppLanguage } from "../context/LanguageContext";
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';

const ImagePickerModal = ({ visible, onClose, onPickGallery }) => {
  const { t } = useAppLanguage();

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.title}>{t("upload_photo")}</Text>

          <TouchableOpacity style={styles.option} onPress={onPickGallery}>
            <Text className="text-white">{t("choose_from_gallery")}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancel} onPress={onClose}>
            <Text>{t("cancel")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    width: 280,
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
  },
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  option: {
    backgroundColor: '#3498db',
    padding: 10,
    borderRadius: 5,
    width: '100%',
    alignItems: 'center',
    marginVertical: 5,
  },
  cancel: {
    marginTop: 10,
  },
});

export default ImagePickerModal;
