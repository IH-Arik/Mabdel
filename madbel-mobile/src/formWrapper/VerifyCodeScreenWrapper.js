import React from 'react';
import { useForm } from 'react-hook-form';
import { FormProvider } from 'react-hook-form';
import VerifyCodeScreen from '../screens/auth/VerifyCodeScreen';
const VerifyCodeScreenWrapper = () => {
  const methods = useForm({
    defaultValues: {
      email: '',
      otp: '',
    },
    mode: 'onChange',
  });

  return (
    <FormProvider {...methods}>
      <VerifyCodeScreen />
    </FormProvider>
  );
};

export default VerifyCodeScreenWrapper;
