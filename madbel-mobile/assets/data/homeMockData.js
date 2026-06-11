export const HOME_AVATARS = [
  "https://i.pravatar.cc/80?img=5",
  "https://i.pravatar.cc/80?img=12",
  "https://i.pravatar.cc/80?img=20",
  "https://i.pravatar.cc/80?img=23",
  "https://i.pravatar.cc/80?img=31",
  "https://i.pravatar.cc/80?img=41",
];

export const HOME_DOC_ITEMS = [
  { id: "agreement", title: "Agreement", iconKey: "file", route: "AgreementList" },
  { id: "invoice", title: "Invoice", iconKey: "receipt", route: "InvoiceList" },
  { id: "lease", title: "Lease", iconKey: "bot", route: "LeaseList" },
  { id: "post", title: "Create Post", iconKey: "plus", route: "CreatePost" },
];

export const HOME_SOCIAL_BADGES = [
  { id: "instagram", label: "IG", backgroundColor: "#EA4C89", color: "#FFFFFF" },
  { id: "facebook", label: "f", backgroundColor: "#1877F2", color: "#FFFFFF" },
  { id: "x", label: "X", backgroundColor: "#FFFFFF", color: "#000000" },
];

export const HOME_ANALYTICS_STATS = [
  { id: "total", label: "Total Calls", value: "128", accent: false },
  { id: "saved", label: "Minutes Saved", value: "450", accent: true },
];

export const HOME_ANALYTICS_CALLS = [
  {
    id: "sarah",
    iconKey: "phoneCall",
    iconColor: "#11D1ED",
    muted: false,
    name: "Sarah Jenkins",
    subtitle: "Scheduled: Tomorrow 10:00 AM",
    rightType: "badge",
    rightText: "AI Ready",
  },
  {
    id: "unknown",
    iconKey: "phoneMissed",
    iconColor: "#8D9CB1",
    muted: true,
    name: "Unknown Prospect",
    subtitle: "Missed Call • 2h ago",
    rightType: "link",
    rightText: "Callback",
  },
];
