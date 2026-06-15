import { Controller } from 'react-hook-form';
import { TextInput, View, Text, Pressable } from 'react-native';
import {
  responsiveHeight,
  responsiveWidth,
} from 'react-native-responsive-dimensions';

const INPUT_HEIGHT = responsiveHeight(6); // consistent input height

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
  type ,
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
      render={({ field: { onChange, value, onBlur } }) => {
        return (
          <View className="relative w-full" style={containerStyle}>
            {label && (
              <Text
                className="text-base font-medium text-[#F3F6F8] mb-2"
                style={labelStyle}
              >
                {label}
              </Text>
            )}
            <View
              style={[
                { position: 'relative', justifyContent: 'center' },
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
                onChangeText={text => onChange(text)}
                onBlur={onBlur}
                placeholder={placeholder}
                placeholderTextColor={placeholderTextColor}
                secureTextEntry={secureTextEntry}
                keyboardType={type}
                className={`bg-[#1D1F24] rounded-xl font-SemiBold  text-white ${
                  error && 'border border-red-500'
                }`}
                style={[
                  {
                    color: '#F3F6F8',
                    paddingLeft: leftIcon ? responsiveWidth(14) : responsiveWidth(2),
                    paddingRight: rightIcon ? responsiveWidth(14) : responsiveWidth(2),
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
            <Text className="text-red-500 text-xs font-regular" style={errorTextStyle}>
              {error && error}
            </Text>
          </View>
        );
      }}
    />
  );
};

export default ControllerTextInput;
