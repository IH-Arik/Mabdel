import React from 'react';
import { useForm } from 'react-hook-form';
import { FormProvider } from 'react-hook-form';
import CreateEventScreen from '../screens/home/CreateEventScreen';

const CreateEventScreenWrapper = () => {
  const methods = useForm({
    defaultValues: {
      eventTitle: '',
      eventType: '',
      eventDescription: '',
      eventDuration: '',
      participantLimit: 25,
      priceType: 'free',
      ticketPrice: '',
      discountPercentage: '',
      eventMedia: [],
    },
    mode: 'onChange',
  });

  return (
    <FormProvider {...methods}>
      <CreateEventScreen />
    </FormProvider>
  );
};

export default CreateEventScreenWrapper;
