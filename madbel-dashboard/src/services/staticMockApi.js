const now = Date.now();
const dayMs = 24 * 60 * 60 * 1000;

const toIsoDaysAgo = (days) => new Date(now - days * dayMs).toISOString();
const toIsoDaysFromNow = (days) => new Date(now + days * dayMs).toISOString();

const sampleUsers = Array.from({ length: 24 }, (_, index) => {
  const id = `user-${index + 1}`;
  const blocked = index % 7 === 0;
  return {
    id,
    fullName: `User ${index + 1}`,
    name: `User ${index + 1}`,
    email: `user${index + 1}@example.com`,
    avatarUrl: `https://i.pravatar.cc/100?img=${(index % 68) + 1}`,
    createdAt: toIsoDaysAgo(40 - index),
    joinedAt: toIsoDaysAgo(40 - index),
    status: blocked ? "blocked" : "active",
    isBlocked: blocked,
    phone: `+1 555 010 ${String(index + 1).padStart(2, "0")}`,
    contactNo: `+1 555 010 ${String(index + 1).padStart(2, "0")}`,
    address: `${100 + index} Main St, Seattle, WA`,
  };
});

let notifications = Array.from({ length: 14 }, (_, index) => ({
  id: `notif-${index + 1}`,
  title: `System Notice ${index + 1}`,
  message:
    index % 2 === 0
      ? "New user registration requires review."
      : "Weekly metrics report is now ready.",
  body:
    index % 2 === 0
      ? "New user registration requires review."
      : "Weekly metrics report is now ready.",
  createdAt: toIsoDaysAgo(index),
  isRead: index > 4,
  read: index > 4,
}));

const reports = Array.from({ length: 14 }, (_, index) => {
  const from = sampleUsers[(index + 2) % sampleUsers.length];
  const to = sampleUsers[(index + 9) % sampleUsers.length];
  return {
    id: `report-${index + 1}`,
    reportFrom: {
      id: from.id,
      fullName: from.fullName,
      name: from.name,
    },
    reportTo: {
      id: to.id,
      fullName: to.fullName,
      name: to.name,
      status: index % 3 === 0 ? "blocked" : "active",
    },
    reason: index % 2 === 0 ? "Harassment in chat" : "Inappropriate content",
    status: "open",
    createdAt: toIsoDaysAgo(index + 1),
  };
});

const categories = [
  { id: "cat-1", categoryName: "Sports", isActive: true },
  { id: "cat-2", categoryName: "Music", isActive: true },
  { id: "cat-3", categoryName: "Food", isActive: true },
  { id: "cat-4", categoryName: "Technology", isActive: true },
  { id: "cat-5", categoryName: "Workshops", isActive: true },
  { id: "cat-6", categoryName: "Health", isActive: true },
  { id: "cat-7", categoryName: "Art", isActive: true },
  { id: "cat-8", categoryName: "Gaming", isActive: true },
  { id: "cat-9", categoryName: "Business", isActive: true },
];

const subscriptions = Array.from({ length: 18 }, (_, index) => {
  const user = sampleUsers[index % sampleUsers.length];
  const isYearly = index % 3 === 0;
  const active = index % 4 !== 0;
  return {
    id: `sub-${index + 1}`,
    sId: index + 1,
    user: {
      name: user.fullName,
      fullName: user.fullName,
      email: user.email,
      avatarUrl: user.avatarUrl,
    },
    email: user.email,
    plan: isYearly ? "yearly" : "monthly",
    status: active ? "active" : "expired",
    expirationDate: toIsoDaysFromNow(active ? 30 + index : -(index + 1)),
  };
});

let subscriptionFees = {
  subscriptionMonthlyPrice: 29,
  subscriptionYearlyPrice: 299,
};

const earningTransactions = Array.from({ length: 22 }, (_, index) => {
  const user = sampleUsers[index % sampleUsers.length];
  const amount = 49 + index * 3;
  return {
    id: `txn-${index + 1}`,
    transactionId: `TRX-${10000 + index}`,
    payer: {
      fullName: user.fullName,
      email: user.email,
      avatarUrl: user.avatarUrl,
      accountNumberMasked: "**** **** **** 5454",
    },
    plan: index % 3 === 0 ? "Annual Pro" : "Monthly Pro",
    amount,
    adminEarning: Number((amount * 0.2).toFixed(2)),
    currency: "USD",
    date: toIsoDaysAgo(index + 1),
  };
});

const eventCreators = Array.from({ length: 15 }, (_, index) => ({
  id: `creator-${index + 1}`,
  creatorId: `creator-${index + 1}`,
  sId: index + 1,
  creatorName: `Creator ${index + 1}`,
  creatorAvatarUrl: `https://i.pravatar.cc/100?img=${(index + 20) % 68}`,
  totalEvents: 3 + (index % 6),
  ticketSold: 120 + index * 14,
  totalEarnings: 3000 + index * 550,
  paymentStatus: index % 2 === 0 ? "pending" : "complete",
}));

const activities = Array.from({ length: 8 }, (_, index) => ({
  id: `activity-${index + 1}`,
  entityType: "activity",
  title: `Morning Fitness Session ${index + 1}`,
  hostName: sampleUsers[index].fullName,
  hostAvatarUrl: sampleUsers[index].avatarUrl,
  status: index % 4 === 0 ? "completed" : "upcoming",
  description: "Community fitness and stretching session.",
  imageUrl: "https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=900&q=60",
  startAt: toIsoDaysFromNow(index + 1),
  endAt: toIsoDaysFromNow(index + 1.1),
  location: "Central Park",
  participantLimit: 40 + index * 5,
  type: "Fitness",
  createdAt: toIsoDaysAgo(index + 2),
}));

const events = Array.from({ length: 8 }, (_, index) => ({
  id: `event-${index + 1}`,
  entityType: "event",
  title: `City Music Night ${index + 1}`,
  hostName: sampleUsers[index + 4].fullName,
  hostAvatarUrl: sampleUsers[index + 4].avatarUrl,
  status: index % 3 === 0 ? "ongoing" : "upcoming",
  description: "Live band performances and food stalls.",
  imageUrl: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=900&q=60",
  startAt: toIsoDaysFromNow(index + 2),
  endAt: toIsoDaysFromNow(index + 2.2),
  location: "Downtown Arena",
  participantLimit: 300 + index * 25,
  type: "Music",
  createdAt: toIsoDaysAgo(index + 1),
}));

const products = Array.from({ length: 10 }, (_, index) => ({
  id: `product-${index + 1}`,
  name: `Promo Product ${index + 1}`,
  category: ["Protein", "Accessories", "Supplements"][index % 3],
  description: "Marketing banner product for campaign testing.",
  price: 25 + index * 5,
  destinationUrl: "https://example.com/product",
  ctaUrl: "https://example.com/product",
  imageUrl: `https://picsum.photos/seed/ad-${index + 1}/640/360`,
  isActive: index % 2 === 0,
  createdAt: toIsoDaysAgo(index),
}));

const aboutContent = {
  "about-us":
    "<h2>About GoCustify</h2><p>GoCustify Dashboard is used to manage users, subscriptions, reports, and communications from one place.</p>",
  "privacy-policy":
    "<h2>Privacy Policy</h2><p>Data shown in this environment is dummy content for UI testing only.</p>",
  "terms-and-conditions":
    "<h2>Terms & Conditions</h2><p>Using this test dashboard implies acceptance of non-production sample data behavior.</p>",
};

const threads = [
  {
    _id: "thread-1",
    directPeer: {
      id: "user-7",
      fullName: "Alex Turner",
      role: "event_creator",
      profileImage: "https://i.pravatar.cc/100?img=12",
    },
    unreadCount: 2,
    updatedAt: toIsoDaysAgo(0.2),
    lastMessage: { type: "text", text: "Can you review my payout request?" },
  },
  {
    _id: "thread-2",
    directPeer: {
      id: "user-11",
      fullName: "Sarah Jones",
      role: "user",
      profileImage: "https://i.pravatar.cc/100?img=24",
    },
    unreadCount: 0,
    updatedAt: toIsoDaysAgo(0.5),
    lastMessage: { type: "text", text: "Thanks for resolving the report." },
  },
];

const messagesByThread = {
  "thread-1": [
    {
      _id: "msg-1",
      senderUserId: "user-7",
      type: "text",
      text: "Hi admin, I requested a payout yesterday.",
      createdAt: toIsoDaysAgo(1),
    },
    {
      _id: "msg-2",
      senderUserId: "admin-001",
      type: "text",
      text: "Received. We are checking your account.",
      createdAt: toIsoDaysAgo(0.9),
    },
  ],
  "thread-2": [
    {
      _id: "msg-3",
      senderUserId: "user-11",
      type: "text",
      text: "Thanks for your help.",
      createdAt: toIsoDaysAgo(0.8),
    },
  ],
};

let profile = {
  id: "admin-001",
  name: "Stone Admin",
  fullName: "Stone Admin",
  email: "admin@stoneacademy.test",
  phone: "+1 555 111 2233",
  contactNo: "+1 555 111 2233",
  address: "Seattle, WA",
  role: "admin",
  profilePhoto: "https://i.pravatar.cc/120?img=32",
};

const toPositiveInt = (value, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
};

const paginate = (items, query = {}) => {
  const page = toPositiveInt(query.page, 1);
  const limit = toPositiveInt(query.limit ?? query.pageSize, 10);
  const start = (page - 1) * limit;
  return {
    page,
    limit,
    total: items.length,
    totalPages: Math.max(1, Math.ceil(items.length / limit)),
    items: items.slice(start, start + limit),
  };
};

const includesText = (value, keyword) =>
  String(value || "").toLowerCase().includes(String(keyword || "").toLowerCase());

const getPathWithoutQuery = (path) => String(path || "").split("?")[0];

const response = (data, meta) => ({
  success: true,
  message: "Static mode mock response",
  data,
  ...(meta ? { meta } : {}),
});

const findUserById = (id) => sampleUsers.find((item) => String(item.id) === String(id));

const extractId = (path, prefix) => decodeURIComponent(path.slice(prefix.length));

const handleUsers = (path, method, query = {}) => {
  if (path === "/admin/users" && method === "GET") {
    const keyword = query.search || query.query || query.q || "";
    const filtered = keyword
      ? sampleUsers.filter(
          (user) =>
            includesText(user.fullName, keyword) ||
            includesText(user.email, keyword)
        )
      : sampleUsers;
    const pageData = paginate(filtered, query);
    return response(
      { items: pageData.items, users: pageData.items, total: pageData.total },
      {
        page: pageData.page,
        totalPages: pageData.totalPages,
        totalItems: pageData.total,
      }
    );
  }

  if (path === "/admin/users/blocked") {
    const blockedUsers = sampleUsers.filter((item) => item.status === "blocked");
    const keyword = query.search || query.query || query.q || "";
    const filtered = keyword
      ? blockedUsers.filter(
          (user) =>
            includesText(user.fullName, keyword) ||
            includesText(user.email, keyword)
        )
      : blockedUsers;
    const pageData = paginate(filtered, query);
    return response(
      { items: pageData.items, users: pageData.items, total: pageData.total },
      {
        page: pageData.page,
        totalPages: pageData.totalPages,
        totalItems: pageData.total,
      }
    );
  }

  if (path.startsWith("/admin/users/")) {
    const id = extractId(path, "/admin/users/");

    if (id.endsWith("/block") || id.endsWith("/ban")) {
      return response({ ok: true });
    }
    if (id.endsWith("/unblock") || id.endsWith("/unban")) {
      return response({ ok: true });
    }
    if (id.endsWith("/status") || id.endsWith("/notes")) {
      return response({ ok: true });
    }

    const user = findUserById(id);
    return response(user || sampleUsers[0]);
  }

  return null;
};

const handleReports = (path, method, query = {}) => {
  if ((path === "/admin/reports" || path === "/reports/admin") && method === "GET") {
    const pageData = paginate(reports, query);
    return response(
      { reports: pageData.items, items: pageData.items, total: pageData.total },
      {
        page: pageData.page,
        totalPages: pageData.totalPages,
        totalItems: pageData.total,
      }
    );
  }

  if (
    path.startsWith("/admin/reports/") ||
    path.startsWith("/reports/admin/")
  ) {
    return response({ ok: true });
  }

  return null;
};

const handleDashboard = (path) => {
  if (path === "/admin/dashboard/overview" || path === "/dashboard/overview") {
    return response({
      totalUsers: sampleUsers.length,
      totalRevenue: 128940,
      usersGrowth: 11.2,
      revenueGrowth: 8.7,
      subscriptionRevenue: 48320,
      eventPlatformFeeRevenue: 80620,
    });
  }

  if (path === "/admin/dashboard/analytics" || path === "/dashboard/analytics") {
    return response({
      monthlyUsers: [
        { month: "Jan", users: 140 },
        { month: "Feb", users: 180 },
        { month: "Mar", users: 210 },
        { month: "Apr", users: 240 },
        { month: "May", users: 275 },
        { month: "Jun", users: 300 },
        { month: "Jul", users: 340 },
        { month: "Aug", users: 380 },
        { month: "Sep", users: 420 },
        { month: "Oct", users: 470 },
        { month: "Nov", users: 520 },
        { month: "Dec", users: 560 },
      ],
    });
  }

  if (path === "/admin/dashboard/recent-users") {
    return response({ items: sampleUsers.slice(0, 5), users: sampleUsers.slice(0, 5) });
  }

  if (path === "/admin/dashboard/notifications/preview") {
    return response({ items: notifications.slice(0, 4) });
  }

  return null;
};

const handleSubscriptions = (path, method, query = {}, body = {}) => {
  if (path === "/admin/subscriptions" && method === "GET") {
    const keyword = query.search || query.q || "";
    const filtered = keyword
      ? subscriptions.filter(
          (item) =>
            includesText(item.user?.name, keyword) ||
            includesText(item.email, keyword)
        )
      : subscriptions;
    const pageData = paginate(filtered, query);
    return response(
      { items: pageData.items, total: pageData.total },
      {
        page: pageData.page,
        totalPages: pageData.totalPages,
        totalItems: pageData.total,
      }
    );
  }

  if (path === "/admin/subscriptions/fees" && method === "GET") {
    return response(subscriptionFees);
  }
  if (path === "/admin/subscriptions/fees" && (method === "PATCH" || method === "PUT")) {
    subscriptionFees = {
      subscriptionMonthlyPrice:
        Number(body?.subscriptionMonthlyPrice) || subscriptionFees.subscriptionMonthlyPrice,
      subscriptionYearlyPrice:
        Number(body?.subscriptionYearlyPrice) || subscriptionFees.subscriptionYearlyPrice,
    };
    return response(subscriptionFees);
  }
  if (path.startsWith("/admin/subscriptions/")) {
    return response(subscriptions[0]);
  }
  if (path === "/admin/subscriptions/search") {
    return response({ items: subscriptions.slice(0, 8), total: subscriptions.length });
  }

  return null;
};

const handleNotifications = (path, method, query = {}) => {
  if (path === "/admin/notifications/unread-count") {
    const unreadCount = notifications.filter((item) => !item.isRead).length;
    return response({ count: unreadCount });
  }

  if (path === "/admin/notifications" && method === "GET") {
    const pageData = paginate(notifications, query);
    return response(
      {
        items: pageData.items,
        rows: pageData.items,
        notifications: pageData.items,
        total: pageData.total,
      },
      {
        page: pageData.page,
        totalPages: pageData.totalPages,
        totalItems: pageData.total,
      }
    );
  }

  if (path === "/admin/notifications/read-all") {
    notifications = notifications.map((item) => ({ ...item, isRead: true, read: true }));
    return response({ ok: true });
  }

  if (path.startsWith("/admin/notifications/") && path.endsWith("/read")) {
    const id = path.replace("/admin/notifications/", "").replace("/read", "");
    notifications = notifications.map((item) =>
      String(item.id) === String(id) ? { ...item, isRead: true, read: true } : item
    );
    return response({ ok: true });
  }

  if (path === "/admin/notifications/read") {
    return response({ ok: true });
  }

  return null;
};

const handleProfile = (path, method, body) => {
  if (
    (path === "/admin/profile" || path === "/admin/settings/profile") &&
    method === "GET"
  ) {
    return response(profile);
  }

  if (
    (path === "/admin/profile" || path === "/admin/settings/profile") &&
    (method === "PUT" || method === "PATCH")
  ) {
    if (body instanceof FormData) {
      return response({
        ...profile,
        profilePhoto: "https://i.pravatar.cc/120?img=53",
      });
    }
    profile = {
      ...profile,
      ...body,
      name: body?.fullName || body?.name || profile.name,
      fullName: body?.fullName || body?.name || profile.fullName,
      contactNo: body?.contactNo || body?.phone || profile.contactNo,
      phone: body?.phone || body?.contactNo || profile.phone,
    };
    return response(profile);
  }

  if (path === "/admin/settings/security") {
    return response({
      twoFactorEnabled: false,
      lastPasswordChangeAt: toIsoDaysAgo(30),
    });
  }

  return null;
};

const handleEarnings = (path, method, query = {}) => {
  if (
    (path === "/admin/earnings/transactions" || path === "/billing/admin/transactions") &&
    method === "GET"
  ) {
    const pageData = paginate(earningTransactions, query);
    return response(
      { items: pageData.items, total: pageData.total },
      {
        page: pageData.page,
        totalPages: pageData.totalPages,
        totalItems: pageData.total,
      }
    );
  }

  if (path.startsWith("/admin/earnings/transactions/") && path.endsWith("/invoice")) {
    const id = path.replace("/admin/earnings/transactions/", "").replace("/invoice", "");
    return response({ invoiceId: `INV-${id.toUpperCase()}` });
  }

  if (path.startsWith("/admin/earnings/transactions/")) {
    const id = path.replace("/admin/earnings/transactions/", "");
    const row = earningTransactions.find((item) => String(item.id) === String(id));
    return response(row || earningTransactions[0]);
  }

  return null;
};

const handleEventCreators = (path, method, query = {}) => {
  if (
    (path === "/admin/event-creators" || path === "/admin/event-creators/premium") &&
    method === "GET"
  ) {
    const pageData = paginate(eventCreators, query);
    return response(
      { items: pageData.items, rows: pageData.items, total: pageData.total },
      {
        page: pageData.page,
        totalPages: pageData.totalPages,
        totalItems: pageData.total,
      }
    );
  }

  if (
    path.startsWith("/admin/event-creators/") ||
    path.startsWith("/admin/event-creators/premium/")
  ) {
    if (path.endsWith("/payout")) {
      return response({ ok: true });
    }

    const id = path
      .replace("/admin/event-creators/premium/", "")
      .replace("/admin/event-creators/", "");
    const base = eventCreators.find((item) => item.creatorId === id) || eventCreators[0];

    return response({
      creator: {
        id: base.creatorId,
        fullName: base.creatorName,
        email: `${base.creatorName.toLowerCase().replace(/\s+/g, ".")}@example.com`,
        avatarUrl: base.creatorAvatarUrl,
        status: "active",
      },
      metrics: {
        totalEarnings: base.totalEarnings,
        pendingAmount: base.paymentStatus === "pending" ? 460 : 0,
        totalPaidOut: Math.max(0, base.totalEarnings - 460),
        paymentStatus: base.paymentStatus,
      },
      events: [
        {
          id: `${base.creatorId}-e1`,
          title: "Summer Beats Festival",
          startAt: toIsoDaysAgo(8),
          ticketPrice: 45,
          status: "completed",
          stats: { joinedCount: 240 },
        },
        {
          id: `${base.creatorId}-e2`,
          title: "Weekend Food Carnival",
          startAt: toIsoDaysFromNow(6),
          ticketPrice: 30,
          status: "upcoming",
          stats: { joinedCount: 130 },
        },
      ],
    });
  }

  return null;
};

const handleActivityEvents = (path, method) => {
  if (path === "/admin/activities" && method === "GET") {
    return response(activities);
  }
  if (path === "/admin/events" && method === "GET") {
    return response(events);
  }
  if (
    path.startsWith("/admin/activities/") ||
    path.startsWith("/admin/events/")
  ) {
    return response({ ok: true });
  }
  return null;
};

const handleCategories = (path, method, query = {}, body = {}) => {
  if (path === "/admin/categories" && method === "GET") {
    const pageData = paginate(categories, query);
    return response(pageData.items, {
      page: pageData.page,
      totalPages: pageData.totalPages,
      totalItems: pageData.total,
    });
  }

  if (path === "/admin/categories" && method === "POST") {
    return response({
      id: `cat-${categories.length + 1}`,
      categoryName: body?.categoryName || "New Category",
      isActive: true,
    });
  }

  if (path.startsWith("/admin/categories/")) {
    return response({ ok: true });
  }

  return null;
};

const handleProducts = (path, method, query = {}) => {
  if (
    (path === "/shop/admin/products" || path === "/shop/admin/products/table") &&
    method === "GET"
  ) {
    const keyword = query.q || query.search || "";
    const category = query.category;
    const active = query.active;

    const filtered = products.filter((item) => {
      const keywordOk = keyword
        ? includesText(item.name, keyword) || includesText(item.description, keyword)
        : true;
      const categoryOk = category ? item.category === category : true;
      const activeFlag =
        active === undefined ? undefined : String(active).toLowerCase() === "true";
      const activeOk = activeFlag === undefined ? true : Boolean(item.isActive) === activeFlag;
      return keywordOk && categoryOk && activeOk;
    });

    return response(filtered);
  }

  if (path === "/shop/admin/products" && method === "POST") {
    return response({ ok: true, id: "product-new" });
  }

  if (path.startsWith("/shop/admin/products/")) {
    return response({ ok: true });
  }

  return null;
};

const handleCms = (path, method, body = {}) => {
  if (path === "/cms/about-us" || path === "/cms/pages/about-us") {
    return response({ content: aboutContent["about-us"] });
  }
  if (path === "/cms/privacy-policy" || path === "/cms/pages/privacy-policy") {
    return response({ content: aboutContent["privacy-policy"] });
  }
  if (
    path === "/cms/terms-and-conditions" ||
    path === "/cms/pages/terms-of-service"
  ) {
    return response({ content: aboutContent["terms-and-conditions"] });
  }
  if (path.startsWith("/cms/admin/") && (method === "PUT" || method === "POST")) {
    return response({ content: body?.content || "" });
  }
  return null;
};

const handleChat = (path, method, body = {}) => {
  if (path === "/admin/chats" && method === "GET") {
    return response(
      threads.map((thread) => ({
        id: thread._id,
        unread_count: thread.unreadCount,
        timestamp: thread.updatedAt,
        last_message: thread.lastMessage?.text || "",
        user_name: thread.directPeer?.fullName || "Unknown User",
        avatar_url: thread.directPeer?.profileImage || thread.directPeer?.avatar || "",
      }))
    );
  }

  if (path.startsWith("/admin/chats/") && path.endsWith("/messages") && method === "GET") {
    const id = path.replace("/admin/chats/", "").replace("/messages", "");
    const items = messagesByThread[id] || [];
    return response(
      items.map((message) => ({
        id: message._id,
        sender_id: message.senderUserId,
        message: message.text || "",
        image_url: message.imageUrl || "",
        timestamp: message.createdAt || null,
      }))
    );
  }

  if (path.startsWith("/admin/chats/") && path.endsWith("/messages") && method === "POST") {
    const id = path.replace("/admin/chats/", "").replace("/messages", "");
    const next = {
      _id: `msg-${Date.now()}`,
      senderUserId: "admin-001",
      type: body?.imageUrl ? "image" : "text",
      text: body?.text || "",
      imageUrl: body?.imageUrl || "",
      createdAt: new Date().toISOString(),
    };
    messagesByThread[id] = [...(messagesByThread[id] || []), next];
    return response({
      id: next._id,
      sender_id: next.senderUserId,
      message: next.text,
      image_url: next.imageUrl,
      timestamp: next.createdAt,
    });
  }

  if (path === "/chat/threads" && method === "GET") {
    return response(threads);
  }

  if (path === "/chat/threads/admin" && method === "POST") {
    return response(threads[0]);
  }

  if (path.startsWith("/chat/threads/") && path.endsWith("/messages") && method === "GET") {
    const id = path.replace("/chat/threads/", "").replace("/messages", "");
    return response({ messages: messagesByThread[id] || [] });
  }

  if (path.startsWith("/chat/threads/") && path.endsWith("/messages") && method === "POST") {
    const id = path.replace("/chat/threads/", "").replace("/messages", "");
    const next = {
      _id: `msg-${Date.now()}`,
      senderUserId: "admin-001",
      type: body?.type || "text",
      text: body?.text || "",
      createdAt: new Date().toISOString(),
    };
    messagesByThread[id] = [...(messagesByThread[id] || []), next];
    return response(next);
  }

  if (path.startsWith("/chat/threads/") && path.endsWith("/seen")) {
    return response({ ok: true });
  }

  return null;
};

const handleAuth = (path, method) => {
  if (
    (path.includes("/logout") && method !== "GET") ||
    path.includes("/password") ||
    path.includes("/security")
  ) {
    return response({ ok: true });
  }
  return null;
};

export const getStaticMockResponse = (path, options = {}) => {
  const method = String(options.method || "GET").toUpperCase();
  const query = options.query || {};
  const body = options.body || {};
  const normalizedPath = getPathWithoutQuery(path);

  const handlers = [
    () => handleDashboard(normalizedPath),
    () => handleUsers(normalizedPath, method, query),
    () => handleReports(normalizedPath, method, query),
    () => handleCategories(normalizedPath, method, query, body),
    () => handleSubscriptions(normalizedPath, method, query, body),
    () => handleNotifications(normalizedPath, method, query),
    () => handleProfile(normalizedPath, method, body),
    () => handleEarnings(normalizedPath, method, query),
    () => handleEventCreators(normalizedPath, method, query),
    () => handleActivityEvents(normalizedPath, method),
    () => handleProducts(normalizedPath, method, query),
    () => handleCms(normalizedPath, method, body),
    () => handleChat(normalizedPath, method, body),
    () => handleAuth(normalizedPath, method),
  ];

  for (const handler of handlers) {
    const result = handler();
    if (result) return result;
  }

  return response({
    note: "No specific mock for this endpoint yet.",
    path: normalizedPath,
    method,
  });
};
