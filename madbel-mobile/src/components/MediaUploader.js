import React from "react";
import { useAppLanguage } from "../context/LanguageContext";
import {
  Alert,
  Image,
  Pressable,
  Text,
  View,
} from "react-native";
import { responsiveHeight, responsiveWidth } from "react-native-responsive-dimensions";
import { Controller } from "react-hook-form";
import { ImagePlus, Trash2, Video } from "lucide-react-native";
import { launchImageLibrary } from "react-native-image-picker";

const isVideoAsset = (asset) => {
  const mimeType = asset?.type || "";
  if (mimeType.startsWith("video")) return true;
  const uri = asset?.uri || "";
  return /\.(mp4|mov|avi|mkv|webm)$/i.test(uri);
};

const normalizeAsset = (asset, fallbackIndex) => ({
  uri: asset?.uri,
  type: asset?.type || "application/octet-stream",
  fileName: asset?.fileName || `upload-${Date.now()}-${fallbackIndex}`,
});

const MediaUploaderView = ({
  label,
  value,
  onChange,
  disabled,
  maxFiles,
  mediaType,
  errorMessage,
}) => {
  const { t } = useAppLanguage();
  const mediaFiles = Array.isArray(value) ? value : [];

  const pickMedia = async () => {
    if (disabled) return;

    const remaining = Math.max(0, maxFiles - mediaFiles.length);
    if (remaining <= 0) {
      Alert.alert(t("limit_reached"), t("you_can_upload_up_to_files", { maxFiles }));
      return;
    }

    const response = await launchImageLibrary({
      mediaType,
      selectionLimit: remaining,
      quality: 0.8,
      includeBase64: false,
    });

    if (response?.didCancel) return;

    if (response?.errorCode) {
      Alert.alert(t("upload_failed"), response?.errorMessage || t("could_not_select_media"));
      return;
    }

    const pickedAssets = (response?.assets || [])
      .map((asset, index) => normalizeAsset(asset, index))
      .filter((asset) => asset.uri);

    if (!pickedAssets.length) return;

    onChange([...mediaFiles, ...pickedAssets].slice(0, maxFiles));
  };

  const removeFile = (indexToRemove) => {
    if (disabled) return;
    onChange(mediaFiles.filter((_, index) => index !== indexToRemove));
  };

  return (
    <View style={{ gap: responsiveHeight(1.5) }}>
      <Text className="text-base font-medium text-black">{label}</Text>

      <Pressable
        className="border border-border rounded-xl bg-white items-center justify-center"
        style={{ paddingVertical: responsiveHeight(2), paddingHorizontal: responsiveWidth(4) }}
        onPress={pickMedia}
        disabled={disabled}
      >
        <ImagePlus size={24} color="#666" />
        <Text className="text-gray-600 mt-2">
          {t("add_image_video", { count: mediaFiles.length, maxFiles })}
        </Text>
      </Pressable>

      {!!mediaFiles.length && (
        <View className="flex-row flex-wrap" style={{ gap: responsiveWidth(2) }}>
          {mediaFiles.map((file, index) => {
            const isVideo = isVideoAsset(file);
            return (
              <View
                key={`${file.uri}-${index}`}
                className="border border-border rounded-xl overflow-hidden bg-white"
                style={{ width: responsiveWidth(27) }}
              >
                {isVideo ? (
                  <View
                    className="items-center justify-center bg-gray-100"
                    style={{ height: responsiveWidth(27) }}
                  >
                    <Video size={20} color="#666" />
                    <Text className="text-xs text-gray-500 mt-1">{t("video")}</Text>
                  </View>
                ) : (
                  <Image
                    source={{ uri: file.uri }}
                    resizeMode="cover"
                    style={{ width: "100%", height: responsiveWidth(27) }}
                  />
                )}

                <Pressable
                  className="items-center justify-center py-2 border-t border-border"
                  onPress={() => removeFile(index)}
                >
                  <Trash2 size={16} color="#ef4444" />
                </Pressable>
              </View>
            );
          })}
        </View>
      )}

      {errorMessage ? <Text className="text-red-500">{errorMessage}</Text> : null}
    </View>
  );
};

const MediaUploader = ({
  label = undefined,
  control,
  name = "mediaFiles",
  rules,
  value,
  onChange,
  disabled = false,
  maxFiles = 5,
  mediaType = "mixed",
  errorMessage,
}) => {
  const { t } = useAppLanguage();
  const resolvedLabel = label || t("upload_media");
  const useFormMode = Boolean(control && name && !onChange && value === undefined);

  if (useFormMode) {
    return (
      <Controller
        name={name}
        control={control}
        rules={rules}
        defaultValue={[]}
        render={({ field, fieldState }) => (
          <MediaUploaderView
            label={resolvedLabel}
            value={field.value}
            onChange={field.onChange}
            disabled={disabled}
            maxFiles={maxFiles}
            mediaType={mediaType}
            errorMessage={errorMessage || fieldState?.error?.message}
          />
        )}
      />
    );
  }

  return (
    <MediaUploaderView
      label={resolvedLabel}
      value={value}
      onChange={onChange || (() => undefined)}
      disabled={disabled}
      maxFiles={maxFiles}
      mediaType={mediaType}
      errorMessage={errorMessage}
    />
  );
};

export default MediaUploader;
