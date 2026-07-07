"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var _react = require("react");

var _react2 = _interopRequireDefault(_react);

var _reactNative = require("react-native");

var _reactNativeResponsiveDimensions = require("react-native-responsive-dimensions");

var ActivityCard = function ActivityCard(_ref) {
  var _ref$title = _ref.title;
  var title = _ref$title === undefined ? "Morning Run in Central Park" : _ref$title;
  var _ref$organizer = _ref.organizer;
  var organizer = _ref$organizer === undefined ? "Alex Johnson" : _ref$organizer;
  var _ref$organizerImage = _ref.organizerImage;
  var organizerImage = _ref$organizerImage === undefined ? "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face" : _ref$organizerImage;
  var _ref$distance = _ref.distance;
  var distance = _ref$distance === undefined ? "0.8 miles away" : _ref$distance;
  var _ref$date = _ref.date;
  var date = _ref$date === undefined ? "Dec 15" : _ref$date;
  var _ref$time = _ref.time;
  var time = _ref$time === undefined ? "7:00 AM" : _ref$time;
  var _ref$participants = _ref.participants;
  var participants = _ref$participants === undefined ? [{
    id: 1,
    image: "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=100&h=100&fit=crop&crop=face"
  }, {
    id: 2,
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face"
  }, {
    id: 3,
    image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face"
  }] : _ref$participants;
  var _ref$maxParticipants = _ref.maxParticipants;
  var maxParticipants = _ref$maxParticipants === undefined ? 5 : _ref$maxParticipants;
  var item = _ref.item;
  var onPress = _ref.onPress;
  var _ref$joined = _ref.joined;
  var joined = _ref$joined === undefined ? false : _ref$joined;
  var actionLabel = _ref.actionLabel;
  var actionDisabled = _ref.actionDisabled;
  var _ref$heroImage = _ref.heroImage;
  var heroImage = _ref$heroImage === undefined ? "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=400&h=200&fit=crop" : _ref$heroImage;

  var joinedCount = participants.length;
  var remaining = maxParticipants - joinedCount;
  var showImages = participants.slice(0, 3); // Show max 3 images
  var overlapOffset = 8; // Adjust overlap amount
  var imgSize = (0, _reactNativeResponsiveDimensions.responsiveWidth)(8);
  var isDisabled = typeof actionDisabled === "boolean" ? actionDisabled : joined;
  var buttonText = actionLabel || (joined ? "Joined" : "Join Activity");
  return _react2["default"].createElement(
    _reactNative.View,
    {
      className: "bg-white rounded-2xl   border border-border",
      style: { padding: (0, _reactNativeResponsiveDimensions.responsiveWidth)(4) }
    },
    _react2["default"].createElement(
      _reactNative.Text,
      { className: "text-lg font-bold text-gray-900 mb-1" },
      title
    ),
    _react2["default"].createElement(
      _reactNative.View,
      { className: "flex-row items-center justify-between" },
      _react2["default"].createElement(
        _reactNative.View,
        {
          className: "flex-row items-center",
          style: { gap: (0, _reactNativeResponsiveDimensions.responsiveWidth)(2) }
        },
        _react2["default"].createElement(_reactNative.Image, {
          source: require("../../assets/images/profile.png"),
          style: {
            width: imgSize,
            height: imgSize,
            borderRadius: imgSize / 2,
            resizeMode: "cover"
          }
        }),
        _react2["default"].createElement(
          _reactNative.View,
          { className: "" },
          _react2["default"].createElement(
            _reactNative.Text,
            { className: "text-base text-gray-700 font-medium" },
            organizer
          ),
          _react2["default"].createElement(
            _reactNative.View,
            { className: "flex-row items-center mb-3" },
            _react2["default"].createElement(
              _reactNative.Text,
              { className: "text-sm text-gray-500" },
              date,
              " • ",
              time
            )
          )
        )
      ),
      _react2["default"].createElement(
        _reactNative.Text,
        { className: "text-sm text-gray-500 mr-4" },
        distance
      )
    ),
    _react2["default"].createElement(
      _reactNative.View,
      { className: "flex-row items-center" },
      _react2["default"].createElement(
        _reactNative.View,
        { className: "flex-row mr-3" },
        showImages.map(function (participant, index) {
          return _react2["default"].createElement(
            _reactNative.View,
            {
              key: participant.id,
              className: "w-8 h-8 rounded-full border-2 border-white bg-gray-200 overflow-hidden shadow-sm",
              style: {
                marginLeft: index === 0 ? 0 : -overlapOffset,
                zIndex: showImages.length - index }
            },
            _react2["default"].createElement(_reactNative.Image, {
              source: { uri: participant.image },
              className: "w-full h-full"
            })
          );
        }),
        remaining > 0 && _react2["default"].createElement(
          _reactNative.View,
          {
            className: "w-8 h-8 rounded-full border-2 border-white bg-gray-100 flex items-center justify-center shadow-sm",
            style: { marginLeft: -overlapOffset }
          },
          _react2["default"].createElement(
            _reactNative.Text,
            { className: "text-xs font-bold text-gray-600" },
            "+",
            remaining
          )
        )
      ),
      _react2["default"].createElement(
        _reactNative.Text,
        { className: "text-sm text-gray-600" },
        joinedCount,
        "/",
        maxParticipants,
        " joined"
      )
    ),
    _react2["default"].createElement(_reactNative.Image, {
      source: { uri: heroImage },
      style: {
        width: "100%",
        height: 150,
        borderRadius: 12,
        marginVertical: 10
      }
    }),
    _react2["default"].createElement(
      _reactNative.Pressable,
      {
        className: "rounded-xl " + (isDisabled ? "bg-gray-300" : "bg-primary ") + " ",
        onPress: function () {
          return onPress(item);
        },
        disabled: isDisabled,
        style: {
          padding: (0, _reactNativeResponsiveDimensions.responsiveWidth)(3)
        }
      },
      _react2["default"].createElement(
        _reactNative.Text,
        {
          className: "font-semibold text-lg text-center " + (isDisabled ? "text-gray-600" : "text-black")
        },
        buttonText
      )
    )
  );
};

exports["default"] = ActivityCard;
module.exports = exports["default"];
/* Header with Organizer Image */ /* Footer with Overlapping Images */ /* Overlapping Participant Images */ // Higher zIndex for later items
/* Join Button */