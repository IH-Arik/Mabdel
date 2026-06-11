// import React from 'react';
// import { View, Text, Image } from 'react-native';

// const MessageBubble = ({ 
//   message, 
//   isMe, 
//   showAvatar = true,
//   avatar 
// }) => {
//   return (
//     <View
//       className={`flex-row mb-4 ${
//         isMe ? 'justify-end' : 'justify-start'
//       }`}
//     >
//       {!isMe && showAvatar && (
//         <Image
//           source={{ uri: avatar }}
//           className="w-8 h-8 rounded-full mr-2"
//         />
//       )}
      
//       {!isMe && !showAvatar && (
//         <View className="w-8 h-8 mr-2" />
//       )}
      
//       <View
//         className={`max-w-[80%] rounded-2xl px-4 py-3 ${
//           isMe
//             ? 'bg-blue-500 rounded-br-none'
//             : 'bg-gray-200 rounded-bl-none'
//         }`}
//       >
//         <Text
//           className={`text-base ${
//             isMe ? 'text-white' : 'text-gray-900'
//           }`}
//         >
//           {message.text}
//         </Text>
//         <Text
//           className={`text-xs mt-1 ${
//             isMe ? 'text-blue-200' : 'text-gray-500'
//           }`}
//         >
//           {message.time}
//         </Text>
//       </View>

//     </View>
//   );
// };

// export default MessageBubble;




// components/MessageBubble.js
import React from 'react';
import { View, Text, Image } from 'react-native';

const MessageBubble = ({ 
  message, 
  isMe, 
  showAvatar = true,
  showSenderName = false,
  avatar,
  senderName
}) => {
  return (
    <View
      className={`flex-row mb-4 ${
        isMe ? 'justify-end' : 'justify-start'
      }`}
    >
      {/* Avatar for other users */}
      {!isMe && showAvatar && (
        <Image
          source={{ uri: avatar }}
          className="w-8 h-8 rounded-full mr-2 self-end"
        />
      )}
      
      {/* Spacer for alignment when no avatar */}
      {!isMe && !showAvatar && (
        <View className="w-10" />
      )}
      
      <View className={`max-w-[75%] ${isMe ? 'items-end' : 'items-start'}`}>
        {/* Sender name for group chats */}
        {!isMe && showSenderName && (
          <Text className="text-xs text-gray-500 mb-1 ml-1">
            {senderName}
          </Text>
        )}
        
        {/* Message bubble */}
        <View
          className={`rounded-2xl px-4 py-3 ${
            isMe
              ? 'bg-blue-500 rounded-br-none'
              : 'bg-gray-200 rounded-bl-none'
          }`}
        >
          <Text
            className={`text-base ${
              isMe ? 'text-white' : 'text-gray-900'
            }`}
          >
            {message.text}
          </Text>
        </View>
        
        {/* Time */}
        <Text
          className={`text-xs mt-1 ${
            isMe ? 'text-blue-200' : 'text-gray-500'
          }`}
        >
          {message.time}
        </Text>
      </View>
    </View>
  );
};

export default MessageBubble;