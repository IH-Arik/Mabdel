
import { launchImageLibrary } from 'react-native-image-picker';

export const useImagePicker = () => {
  const pickFromGallery = (onSuccess, onClose) => {
    const options = {
      mediaType: 'photo',
      maxWidth: 500,
      maxHeight: 500,
      quality: 0.8,
    };

    launchImageLibrary(options, (response) => {
      if (response.didCancel || response.errorCode) {
        console.log('Image picking cancelled or failed');
      } else {
        const uri = response.assets?.[0]?.uri;
        if (uri) {
          onSuccess(uri);    // update form
          onClose();         // close modal ✅
        }
      }
    });
  };

  return { pickFromGallery };
};
