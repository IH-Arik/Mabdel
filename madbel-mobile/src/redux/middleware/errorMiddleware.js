import { isRejectedWithValue } from '@reduxjs/toolkit';
import { Alert } from 'react-native';

const ERROR_MESSAGES = {
  AUTH_USER_NOT_FOUND: 'User not found',
  AUTH_INVALID_CREDENTIALS: 'Invalid email or password',
  AUTH_EMAIL_ALREADY_EXISTS: 'Email already exists',
  AUTH_TOKEN_INVALID: 'Session expired. Please login again',
  AUTH_TOKEN_NOT_FOUND: 'Authentication required',
  VALIDATION_ERROR: 'Please check your input',
  RESOURCE_NOT_FOUND: 'Resource not found',
  ACCESS_UNAUTHORIZED: 'You do not have permission',
  INTERNAL_SERVER_ERROR: 'Something went wrong. Please try again',
};

export const errorMiddleware = api => next => action => {
  if (isRejectedWithValue(action)) {
    const error = action.payload;

    console.warn('API Error:', {
      status: error.status,
      data: error.data,
    });

    let errorMessage = 'An error occurred';

    if (error.data) {
      // Handle your backend error format
      const { message, errorCode, errors } = error.data;

      if (errorCode && ERROR_MESSAGES[errorCode]) {
        errorMessage = ERROR_MESSAGES[errorCode];
      } else if (message) {
        errorMessage = message;
      }

      // Handle validation errors
      if (errors && Array.isArray(errors)) {
        errorMessage = errors
          .map(err => `${err.field}: ${err.message}`)
          .join('\n');
      }
    } else if (error.error) {
      errorMessage = error.error;
    }

    // Show error alert (you can replace with Toast)
    Alert.alert('Error', errorMessage);
  }

  return next(action);
};
