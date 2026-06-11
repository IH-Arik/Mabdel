import React from "react";
import { useForm } from "react-hook-form";
import { FormProvider } from "react-hook-form";
import ProfileEditScreen from "../screens/profile/ProfileEditScreen";

const ProfileEditScreenWrapper = () => {
  const methods = useForm({
    defaultValues: {
      profileImage: "",
      profileFullName: "",
      email: "",
      country: "",
    },
    mode: "onChange",
  });

  return (
    <FormProvider {...methods}>
      <ProfileEditScreen />
    </FormProvider>
  );
};

export default ProfileEditScreenWrapper;
