import React from "react";
import { useForm } from "react-hook-form";
import { FormProvider } from "react-hook-form";
import NewPasswordScreen from "../screens/auth/NewPasswordScreen";

const NewPasswordScreenWrapper = () => {
  const methods = useForm({
    defaultValues: {
      newPassword: "",
      newConfirmPassword: "",
    },
    mode: "onChange",
  });

  return (
    <FormProvider {...methods}>
      <NewPasswordScreen />
    </FormProvider>
  );
};

export default NewPasswordScreenWrapper;
