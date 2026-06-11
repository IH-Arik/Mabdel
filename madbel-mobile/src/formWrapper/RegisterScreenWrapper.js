import React from 'react';
import { useForm } from 'react-hook-form';
import { FormProvider } from 'react-hook-form';
import RegisterScreen from '../screens/auth/RegisterScreen';

const RegisterScreenWrapper = () => {
  const methods = useForm({
    defaultValues: {
      fullName: '',
      regEmail: '',
      regPassword: '',
      confirmPassword: '',
    },
    mode: 'onChange',
  });

  return (
    <FormProvider {...methods}>
      <RegisterScreen />
    </FormProvider>
  );
};

export default RegisterScreenWrapper;
