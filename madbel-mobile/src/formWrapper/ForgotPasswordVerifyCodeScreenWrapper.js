import React from 'react';
import { useForm } from 'react-hook-form';
import { FormProvider } from 'react-hook-form';
import ForgotPasswordVerifyCodeScreen from '../screens/auth/ForgotPasswordVerifyCodeScreen';
const ForgotPasswordVerifyCodeScreenWrapper = () => {
  const methods = useForm({
    defaultValues: {
      email: '',
      otp: '',
    },
    mode: 'onChange',
  });

  return (
    <FormProvider {...methods}>
      <ForgotPasswordVerifyCodeScreen />
    </FormProvider>
  );
};

export default ForgotPasswordVerifyCodeScreenWrapper;
