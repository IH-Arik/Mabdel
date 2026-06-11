import React from "react";
import { useForm } from "react-hook-form";
import { FormProvider } from "react-hook-form";
import ProfileChangePasswordScreen from "../screens/profile/ProfileChangePasswordScreen";

const ProfileChangePasswordScreenWrapper = () => {
  const methods = useForm({
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
    mode: "onChange",
  });

  return (
    <FormProvider {...methods}>
      <ProfileChangePasswordScreen />
    </FormProvider>
  );
};

export default ProfileChangePasswordScreenWrapper;
