export const featureSlides = [
  {
    id: "assistant",
    title: "Meet Your AI Assistant",
    highlightedWord: "AI Assistant",
    description:
      "Automate your business, invoices, and scheduling with the power of AI.",
    image: require("../../assets/images/img1.png"),
  },
  {
    id: "invoice",
    title: "Smart Invoicing",
    description:
      "Create, send, and track invoices effortlessly with AI-powered data entry.",
    image: require("../../assets/images/img2.png"),
  },
  {
    id: "payment",
    title: "Secure Payment",
    description:
      "Integrated Stripe, Apple Pay, and Google Pay for fast and secure transactions.",
    image: require("../../assets/images/img3.png"),
  },
];

export const activities = [
  {
    id: 1,
    title: "Morning Run in Central Park",
    organizer: "Alex Johnson",
    organizerImage:
      "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face",
    heroImage:
      "https://images.unsplash.com/photo-1551632811-561732d1e306?w=400&h=200&fit=crop",
    distance: "0.8 miles away",
    date: "Dec 15",
    time: "7:00 AM",
    type: "Running",
    price: 0,
    description:
      "Start your day with an energizing 5K run through Central Park's scenic trails. Perfect for all fitness levels, we'll maintain a steady pace and enjoy the beautiful morning atmosphere.",
    participants: [
      {
        id: 1,
        image:
          "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=100&h=100&fit=crop&crop=face",
      },
      {
        id: 2,
        image:
          "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
      },
      {
        id: 3,
        image:
          "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face",
      },
    ],
    maxParticipants: 5,
  },
  {
    id: 2,
    title: "Evening Yoga Session",
    organizer: "Sarah Wilson",
    organizerImage:
      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face",
    heroImage:
      "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400&h=200&fit=crop",
    distance: "1.2 miles away",
    date: "Dec 16",
    time: "6:00 PM",
    type: "Yoga",
    price: 15,
    description:
      "Unwind after a long day with our gentle evening yoga flow. This session focuses on stretching, breathing, and relaxation techniques to help you find balance and peace.",
    participants: [
      {
        id: 1,
        image:
          "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
      },
      {
        id: 2,
        image:
          "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face",
      },
    ],
    maxParticipants: 8,
  },
  {
    id: 3,
    title: "Weekend Cycling Group",
    organizer: "Mike Chen",
    organizerImage:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
    heroImage:
      "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=400&h=200&fit=crop",
    distance: "2.5 miles away",
    date: "Dec 17",
    time: "9:00 AM",
    type: "Cycling",
    price: 0,
    description:
      "Join our weekend cycling adventure through scenic routes! We'll cover 15-20 miles at a moderate pace. Bring your own bike and helmet - all skill levels welcome!",
    participants: [
      {
        id: 1,
        image:
          "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=100&h=100&fit=crop&crop=face",
      },
      {
        id: 2,
        image:
          "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face",
      },
      {
        id: 3,
        image:
          "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&h=100&fit=crop&crop=face",
      },
      {
        id: 4,
        image:
          "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face",
      },
    ],
    maxParticipants: 6,
  },
  {
    id: 4,
    title: "Sunrise Meditation",
    organizer: "Emily Davis",
    organizerImage:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face",
    heroImage:
      "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=200&fit=crop",
    distance: "0.5 miles away",
    date: "Dec 15",
    time: "6:30 AM",
    type: "Meditation",
    price: 10,
    description:
      "Greet the day with peaceful meditation as the sun rises. This guided session will help you set positive intentions and find inner calm to carry through your entire day.",
    participants: [
      {
        id: 1,
        image:
          "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face",
      },
    ],
    maxParticipants: 10,
  },
  {
    id: 5,
    title: "Basketball Pickup Game",
    organizer: "James Rodriguez",
    organizerImage:
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&h=100&fit=crop&crop=face",
    heroImage:
      "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=400&h=200&fit=crop",
    distance: "1.8 miles away",
    date: "Dec 16",
    time: "5:00 PM",
    type: "Basketball",
    price: 5,
    description:
      "Friendly basketball pickup games at the community court. We play half-court games with rotating teams. All skill levels encouraged - just bring your energy and sportsmanship!",
    participants: [
      {
        id: 1,
        image:
          "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=100&h=100&fit=crop&crop=face",
      },
      {
        id: 2,
        image:
          "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
      },
      {
        id: 3,
        image:
          "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face",
      },
      {
        id: 4,
        image:
          "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face",
      },
      {
        id: 5,
        image:
          "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face",
      },
      {
        id: 6,
        image:
          "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&h=100&fit=crop&crop=face",
      },
    ],
    maxParticipants: 10,
  },
  {
    id: 6,
    title: "Hiking Trail Adventure",
    organizer: "Jessica Brown",
    organizerImage:
      "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=100&h=100&fit=crop&crop=face",
    heroImage:
      "https://images.unsplash.com/photo-1551632811-561732d1e306?w=400&h=200&fit=crop",
    distance: "3.2 miles away",
    date: "Dec 18",
    time: "8:00 AM",
    type: "Hiking",
    price: 0,
    description:
      "Explore beautiful mountain trails on this moderate 4-mile hike. We'll encounter stunning viewpoints, diverse wildlife, and enjoy a picnic lunch at the summit. Wear sturdy shoes!",
    participants: [
      {
        id: 1,
        image:
          "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
      },
      {
        id: 2,
        image:
          "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face",
      },
      {
        id: 3,
        image:
          "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face",
      },
      {
        id: 4,
        image:
          "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face",
      },
    ],
    maxParticipants: 8,
  },
  {
    id: 7,
    title: "Swimming Lessons",
    organizer: "David Miller",
    organizerImage:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
    heroImage:
      "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=200&fit=crop",
    distance: "1.5 miles away",
    date: "Dec 17",
    time: "4:00 PM",
    type: "Swimming",
    price: 25,
    description:
      "Professional swimming instruction for adults looking to improve their technique or learn from scratch. Our certified instructor focuses on proper form, breathing, and water safety.",
    participants: [
      {
        id: 1,
        image:
          "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=100&h=100&fit=crop&crop=face",
      },
      {
        id: 2,
        image:
          "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&h=100&fit=crop&crop=face",
      },
    ],
    maxParticipants: 6,
  },
  {
    id: 8,
    title: "Zumba Fitness Class",
    organizer: "Maria Garcia",
    organizerImage:
      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face",
    heroImage:
      "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=400&h=200&fit=crop",
    distance: "0.9 miles away",
    date: "Dec 16",
    time: "7:00 PM",
    type: "Dance",
    price: 12,
    description:
      "High-energy Zumba class combining Latin rhythms with easy-to-follow dance moves. Burn calories while having fun! No dance experience needed - just bring your enthusiasm and water.",
    participants: [
      {
        id: 1,
        image:
          "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face",
      },
      {
        id: 2,
        image:
          "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
      },
      {
        id: 3,
        image:
          "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face",
      },
      {
        id: 4,
        image:
          "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=100&h=100&fit=crop&crop=face",
      },
      {
        id: 5,
        image:
          "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&h=100&fit=crop&crop=face",
      },
      {
        id: 6,
        image:
          "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face",
      },
      {
        id: 7,
        image:
          "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face",
      },
    ],
    maxParticipants: 12,
  },
  {
    id: 9,
    title: "Rock Climbing Session",
    organizer: "Chris Thompson",
    organizerImage:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face",
    heroImage:
      "https://images.unsplash.com/photo-1545212585-1e7a37271ff4?w=400&h=200&fit=crop",
    distance: "2.1 miles away",
    date: "Dec 19",
    time: "3:00 PM",
    type: "Climbing",
    price: 20,
    description:
      "Indoor rock climbing session at our state-of-the-art facility. All equipment provided. Perfect for beginners and experienced climbers alike. Challenge yourself and build strength!",
    participants: [
      {
        id: 1,
        image:
          "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
      },
      {
        id: 2,
        image:
          "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=100&h=100&fit=crop&crop=face",
      },
    ],
    maxParticipants: 5,
  },
  {
    id: 10,
    title: "Beach Volleyball",
    organizer: "Amanda Lee",
    organizerImage:
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&h=100&fit=crop&crop=face",
    heroImage:
      "https://images.unsplash.com/photo-1598488031602-e3ceae919b17?w=400&h=200&fit=crop",
    distance: "4.0 miles away",
    date: "Dec 20",
    time: "2:00 PM",
    type: "Volleyball",
    price: 0,
    description:
      "Fun beach volleyball games on the sandy courts! We'll set up multiple nets for different skill levels. Bring sunscreen and beach gear - perfect way to enjoy the ocean breeze!",
    participants: [
      {
        id: 1,
        image:
          "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face",
      },
      {
        id: 2,
        image:
          "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
      },
      {
        id: 3,
        image:
          "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face",
      },
      {
        id: 4,
        image:
          "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face",
      },
      {
        id: 5,
        image:
          "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=100&h=100&fit=crop&crop=face",
      },
    ],
    maxParticipants: 8,
  },
  {
    id: 11,
    title: "Premium Personal Training",
    organizer: "Ryan Cooper",
    organizerImage:
      "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=100&h=100&fit=crop&crop=face",
    heroImage:
      "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=200&fit=crop",
    distance: "1.0 miles away",
    date: "Dec 18",
    time: "8:00 AM",
    type: "Personal Training",
    price: 50,
    description:
      "One-on-one personal training session tailored to your fitness goals. Includes customized workout plan, nutrition guidance, and progress tracking.",
    participants: [
      {
        id: 1,
        image:
          "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face",
      },
    ],
    maxParticipants: 1,
  },
  {
    id: 12,
    title: "Boxing Fundamentals",
    organizer: "Marcus Lee",
    organizerImage:
      "https://images.unsplash.com/photo-1568602471122-7832951cc4c5?w=100&h=100&fit=crop&crop=face",
    heroImage:
      "https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?w=400&h=200&fit=crop",
    distance: "2.3 miles away",
    date: "Dec 19",
    time: "6:00 PM",
    type: "Boxing",
    price: 18,
    description:
      "Learn boxing fundamentals in a supportive group environment. Focus on proper technique, footwork, and combinations. All equipment provided.",
    participants: [
      {
        id: 1,
        image:
          "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
      },
      {
        id: 2,
        image:
          "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face",
      },
      {
        id: 3,
        image:
          "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=100&h=100&fit=crop&crop=face",
      },
    ],
    maxParticipants: 8,
  },
];
export const types = [
  { label: "Room Type", value: "default" },
  { label: "Studio Apartment", value: "studio" },
  { label: "1 Bedroom", value: "1bhk" },
  { label: "2 Bedroom Apartment", value: "2bhk" },
  { label: "3 Bedroom Apartment", value: "3bhk" },
  { label: "Penthouse", value: "penthouse" },
  { label: "Loft", value: "loft" },
  { label: "Duplex", value: "duplex" },
  { label: "Villa", value: "villa" },
  { label: "Shared Room", value: "shared-room" },
  { label: "Private Room", value: "private-room" },
  { label: "Serviced Apartment", value: "serviced-apartment" },
];
export const genderTypes = [
  { label: "Gender Type", value: "default" },
  { label: "Male", value: "male" },
  { label: "Female", value: "female" },
];

export const conversations = [
  {
    id: 1,
    name: "John Smith",
    lastMessage: "Hello, are you here?",
    time: "9:30 AM",
    unread: true,
    avatar:
      "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face",
  },
  {
    id: 2,
    name: "Cameron Williamson",
    lastMessage: "That sounds exciting! 🌟 Which festival are you going to?",
    time: "10:15 AM",
    unread: false,
    avatar:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
  },
  {
    id: 3,
    name: "Sarah Wilson",
    lastMessage: "See you at the running session tomorrow!",
    time: "Yesterday",
    unread: true,
    avatar:
      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face",
  },
  {
    id: 4,
    name: "Mike Chen",
    lastMessage: "Thanks for joining the cycling group!",
    time: "Yesterday",
    unread: false,
    avatar:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face",
  },
  {
    id: 5,
    name: "Emily Davis",
    lastMessage: "The yoga session was amazing!",
    time: "2 days ago",
    unread: false,
    avatar:
      "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=100&h=100&fit=crop&crop=face",
  },
];
