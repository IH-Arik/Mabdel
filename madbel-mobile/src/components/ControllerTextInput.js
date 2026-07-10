import { Controller } from 'react-hook-form';
import { TextInput, View, Text, Pressable } from 'react-native';
import {
  responsiveHeight,
  responsiveWidth,
} from 'react-native-responsive-dimensions';

const INPUT_HEIGHT = responsiveHeight(6);

const ControllerTextInput = ({
  label,
  placeholder,
  secureTextEntry,
  rightIcon,
  leftIcon,
  name,
  control,
  error,
  rules,
  type,
  validationRules = {},
  containerStyle,
  labelStyle,
  inputWrapperStyle,
  inputStyle,
  errorTextStyle,
  placeholderTextColor = '#999',
  ...props
}) => {
  return (
    <Controller
      name={name}
      control={control}
      rules={{ ...rules, ...validationRules }}
      render={({ field: { onChange, value, onBlur } }) => (
        <View style={[{ width: '100%' }, containerStyle]}>
          {label && (
            <Text
              style={[
                {
                  fontSize: 14,
                  fontWeight: '500',
                  color: '#F3F6F8',
                  marginBottom: 6,
                },
                labelStyle,
              ]}
            >
              {label}
            </Text>
          )}

          <View
            style={[
              {
                position: 'relative',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: error ? '#EF4444' : 'gray',
                borderRadius: 10,
              },
              inputWrapperStyle,
            ]}
          >
            {leftIcon && (
              <View
                style={{
                  position: 'absolute',
                  left: responsiveWidth(3),
                  height: INPUT_HEIGHT,
                  width: INPUT_HEIGHT,
                  justifyContent: 'center',
                  alignItems: 'center',
                  zIndex: 10,
                }}
              >
                {leftIcon}
              </View>
            )}

            <TextInput
              value={value}
              onChangeText={(text) => onChange(text)}
              onBlur={onBlur}
              placeholder={placeholder}
              placeholderTextColor={placeholderTextColor}
              secureTextEntry={secureTextEntry}
              keyboardType={type}
              style={[
                {
                  backgroundColor: '#1D1F24',
                  borderRadius: 10,
                  color: '#F3F6F8',
                  paddingLeft: leftIcon
                    ? responsiveWidth(14)
                    : responsiveWidth(3),
                  paddingRight: rightIcon
                    ? responsiveWidth(14)
                    : responsiveWidth(3),
                  height: props.multiline ? undefined : INPUT_HEIGHT,
                  paddingVertical: 0,
                },
                inputStyle,
              ]}
              {...props}
            />

            {rightIcon && (
              <Pressable
                onPress={props.onPressToggle}
                style={{
                  position: 'absolute',
                  right: responsiveWidth(3),
                  height: INPUT_HEIGHT,
                  width: INPUT_HEIGHT,
                  justifyContent: 'center',
                  alignItems: 'center',
                  zIndex: 10,
                }}
                hitSlop={10}
              >
                {rightIcon}
              </Pressable>
            )}
          </View>

          {error && (
            <Text
              style={[
                {
                  color: '#EF4444',
                  fontSize: 12,
                  marginTop: 4,
                },
                errorTextStyle,
              ]}
            >
              {error}
            </Text>
          )}
        </View>
      )}
    />
  );
};

export default ControllerTextInput;