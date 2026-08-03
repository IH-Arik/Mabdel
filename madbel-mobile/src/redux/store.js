import AsyncStorage from '@react-native-async-storage/async-storage';
import { combineReducers, configureStore, createListenerMiddleware } from '@reduxjs/toolkit';
import authReducer, { clearAuth, setCredentials, setToken } from './reducers/authReducer.js';
import { baseApi } from './baseApi.js';
import { clearStoredAuthTokens, saveStoredAuthTokens } from './authStorage.js';
import './slices/madbelApiSlice.js';
// import { errorMiddleware } from './middleware/errorMiddleware.js';

import {
  FLUSH,
  PAUSE,
  PERSIST,
  persistReducer,
  persistStore,
  PURGE,
  REGISTER,
  REHYDRATE,
} from 'redux-persist';
import { createTransform } from 'redux-persist';

import { setupListeners } from '@reduxjs/toolkit/query';

const authPersistTransform = createTransform(
  (inboundState) => {
    if (!inboundState || typeof inboundState !== 'object') return inboundState;
    const {
      token,
      accessToken,
      refreshToken,
      isAuthenticated,
      ...safeState
    } = inboundState;
    return {
      ...safeState,
      isAuthenticated: false,
    };
  },
  (outboundState) => ({
    ...outboundState,
    token: null,
    accessToken: null,
    refreshToken: null,
    isAuthenticated: false,
  }),
  { whitelist: ['auth'] },
);

const persistedConfig = {
  key: 'root',
  version: 1,
  storage: AsyncStorage,
  whitelist: ['auth'],
  transforms: [authPersistTransform],
};

const combinedReducer = combineReducers({
  auth: authReducer,
  [baseApi.reducerPath]: baseApi.reducer,
});

const persistedReducer = persistReducer(persistedConfig, combinedReducer);

const authStorageListener = createListenerMiddleware();

authStorageListener.startListening({
  actionCreator: setCredentials,
  effect: async (action) => {
    const { accessToken, refreshToken } = action.payload || {};
    await saveStoredAuthTokens({ accessToken, refreshToken });
  },
});

authStorageListener.startListening({
  actionCreator: setToken,
  effect: async (action) => {
    await saveStoredAuthTokens({ accessToken: action.payload });
  },
});

authStorageListener.startListening({
  actionCreator: clearAuth,
  effect: async () => {
    await clearStoredAuthTokens();
  },
});

export const store = configureStore({
  reducer: persistedReducer,
  middleware: getDefaultMiddleware =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    })
      .concat(authStorageListener.middleware)
      .concat(baseApi.middleware),
      // .concat(errorMiddleware),
});

export const persistor = persistStore(store);

setupListeners(store.dispatch);
