import React from 'react';
import { useForm } from 'react-hook-form';
import { FormProvider } from 'react-hook-form';
import LoginScreen from '../screens/auth/LoginScreen';

const LoginScreenWrapper = () => {
  const methods = useForm({
    defaultValues: {
      loginEmail: '',
      loginPassword: '',
    },
    mode: 'onChange',
  });

  return (
    <FormProvider {...methods}>
      <LoginScreen />
    </FormProvider>
  );
};

export default LoginScreenWrapper;
