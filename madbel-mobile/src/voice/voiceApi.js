import { baseApi } from '../redux/baseApi';

export const voiceApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    mobileVoiceToken: builder.query({ query: () => '/api/v1/telnyx/voice/token', keepUnusedDataFor: 0 }),
    mobileVoiceRegistration: builder.mutation({
      query: (body) => ({ url: '/api/v1/telnyx/voice/registration', method: 'POST', body }),
    }),
  }),
});
