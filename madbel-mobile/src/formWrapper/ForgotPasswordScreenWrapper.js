import React from 'react';
import { useForm } from 'react-hook-form';
import { FormProvider } from 'react-hook-form';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
const ForgotPasswordScreenWrapper = () => {
  const methods = useForm({
    defaultValues: {
      forgotEmail: '',
    },
    mode: 'onChange',
  });

  return (
    <FormProvider {...methods}>
      <ForgotPasswordScreen />
    </FormProvider>
  );
};

export default ForgotPasswordScreenWrapper;
