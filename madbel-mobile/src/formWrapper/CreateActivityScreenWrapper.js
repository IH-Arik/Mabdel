import React from 'react';
import { useForm } from 'react-hook-form';
import { FormProvider } from 'react-hook-form';
import CreateActivityScreen from '../screens/home/CreateActivityScreen';

const CreateActivityScreenWrapper = () => {
  const methods = useForm({
    defaultValues: {
      activityTitle: '',
      activityDescription: '',
      acitivityMile: '',
      activityParticipantLimit: 25,
      activityMedia: [],
    },
    mode: 'onChange',
  });

  return (
    <FormProvider {...methods}>
      <CreateActivityScreen />
    </FormProvider>
  );
};

export default CreateActivityScreenWrapper;
