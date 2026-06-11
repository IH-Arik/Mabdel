import AsyncStorage from "@react-native-async-storage/async-storage";
import { createSlice } from "@reduxjs/toolkit";

const authReducer = createSlice({
  name: "auth",
  initialState: {
    token: null,
    user: null,
    accessToken: null,
    refreshToken: null,
    isAuthenticated: false,
    forgotEmail: null,
    forgotOtp: null,
  },
  reducers: {
    setToken: (state, action) => {
      state.token = action.payload;
      state.accessToken = action.payload;
      state.isAuthenticated =
        typeof action.payload === "string" && action.payload.trim().length > 0;
    },
    setUser: (state, action) => {
      state.user = action.payload;
      state.isAuthenticated = Boolean(state.accessToken || state.token || action.payload);
    },

    setCredentials: (state, action) => {
      const { accessToken, refreshToken, user } = action.payload;

      if (typeof accessToken === "string" && accessToken.trim().length > 0) {
        state.accessToken = accessToken;
        state.token = accessToken;
        AsyncStorage.setItem("accessToken", accessToken);
      }

      if (typeof refreshToken === "string" && refreshToken.trim().length > 0) {
        state.refreshToken = refreshToken;
        AsyncStorage.setItem("refreshToken", refreshToken);
      }

      if (user !== undefined) {
        state.user = user;
      }

      state.isAuthenticated = Boolean(state.accessToken || state.user);

      if (user) {
        AsyncStorage.setItem("user", JSON.stringify(user));
      }
    },

    setResetEmail: (state, action) => {
      state.forgotEmail = action.payload;
    },

    setResetOtp: (state, action) => {
      state.forgotOtp = action.payload;
    },

    clearResetData: (state) => {
      ((state.forgotEmail = null), (state.forgotOtp = null));
    },

    clearAuth: (state) => {
      state.token = null;
      state.user = null;
      state.accessToken = null;
      state.refreshToken = null;
      state.isAuthenticated = false;
      state.player_type = null;
      AsyncStorage.removeItem("accessToken");
      AsyncStorage.removeItem("refreshToken");
      AsyncStorage.removeItem("user");
    },
  },
});

export const {
  setToken,
  setUser,
  clearAuth,
  setCredentials,
  setResetEmail,
  setResetOtp,
  clearResetData,
} = authReducer.actions;

export default authReducer.reducer;
