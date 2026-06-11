import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IoIosArrowBack, IoIosArrowForward } from "react-icons/io";
import { Bell } from "lucide-react";
import {
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../../services/notificationsApi";

const PAGE_SIZE = 10;

const Notifications = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let mounted = true;

    const loadNotifications = async () => {
      try {
        const [listPayload, unreadPayload] = await Promise.all([
          listNotifications({ page, limit: PAGE_SIZE }),
          getUnreadNotificationCount(),
        ]);

        if (!mounted) return;

        const listData = listPayload?.data || listPayload;
        const items = listData?.notifications || listData?.items || listData?.rows || [];
        const totalCount =
          Number(listData?.total) ||
          Number(listData?.meta?.total) ||
          Number(listData?.pagination?.total) ||
          items.length;

        const unreadData = unreadPayload?.data || unreadPayload;
        const unread =
          Number(unreadData?.count) ||
          Number(unreadData?.unreadCount) ||
          Number(unreadData?.total) ||
          0;

        setNotifications(Array.isArray(items) ? items : []);
        setTotal(totalCount);
        setUnreadCount(unread);
        window.dispatchEvent(new CustomEvent("admin-notifications-updated"));
      } catch {
        if (mounted) {
          setNotifications([]);
          setTotal(0);
          setUnreadCount(0);
        }
      }
    };

    loadNotifications();
    return () => {
      mounted = false;
    };
  }, [page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const currentItems = useMemo(
    () =>
      notifications.map((item, index) => ({
        id: item?.id || item?._id || index + 1,
        message: item?.message || item?.title || "Notification",
        time: item?.createdAt
          ? new Date(item.createdAt).toLocaleString()
          : item?.time || "",
        isRead: Boolean(item?.isRead || item?.read),
      })),
    [notifications]
  );

  const markAsRead = async (id) => {
    try {
      await markNotificationRead({ id });
      setNotifications((prev) =>
        prev.map((item) => ((item.id || item._id) === id ? { ...item, isRead: true, read: true } : item))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      window.dispatchEvent(new CustomEvent("admin-notifications-updated"));
    } catch {
      // ignore failures and keep current state
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true, read: true })));
      setUnreadCount(0);
      window.dispatchEvent(new CustomEvent("admin-notifications-updated"));
    } catch {
      // ignore failures and keep current state
    }
  };

  return (
    <div className="flex items-center justify-center bg-gray-100">
      <div className="w-full bg-white shadow-lg rounded-xl">
        <div className="flex items-center justify-between gap-3 px-6 py-4 text-white bg-sky-600 rounded-t-xl">
          <div className="flex items-center gap-3">
            <IoIosArrowBack className="cursor-pointer" onClick={() => navigate(-1)} />
            <h2 className="text-lg font-semibold">All Notifications</h2>
            <span className="text-xs bg-white/20 px-2 py-1 rounded">Unread: {unreadCount}</span>
          </div>
          <button onClick={handleMarkAllRead} className="px-3 py-1 text-xs bg-white text-sky-600 rounded">Mark all read</button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto">
          {currentItems.map((notif) => (
            <button key={notif.id} className="flex items-start w-full gap-3 text-left" onClick={() => !notif.isRead && markAsRead(notif.id)}>
              <div className={`p-2 rounded-md ${notif.isRead ? "bg-gray-100" : "bg-blue-100"}`}>
                <Bell size={18} className={notif.isRead ? "text-gray-500" : "text-blue-500"} />
              </div>
              <div>
                <p className={`text-sm font-medium ${notif.isRead ? "text-gray-600" : "text-gray-800"}`}>{notif.message}</p>
                <p className="text-xs text-gray-500">{notif.time}</p>
              </div>
            </button>
          ))}
          {currentItems.length === 0 ? <p className="text-sm text-gray-500">No notifications found.</p> : null}
        </div>

        <div className="flex items-center justify-between p-4 border-t">
          <span className="text-sm text-gray-600">Showing {Math.min(page * PAGE_SIZE, total)} of {total}</span>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1 px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-40" onClick={() => setPage((p) => Math.max(p - 1, 1))} disabled={page === 1}>
              <IoIosArrowBack />
              Previous
            </button>

            {Array.from({ length: Math.min(3, totalPages) }, (_, idx) => {
              const start = Math.max(1, page - 1);
              const pNum = start + idx;
              if (pNum > totalPages) return null;
              return (
                <button
                  key={pNum}
                  className={`px-3 py-1 border rounded-full text-sm ${
                    page === pNum ? "bg-blue-600 text-white border-blue-600" : "border-gray-300 text-gray-700"
                  }`}
                  onClick={() => setPage(pNum)}
                >
                  {pNum}
                </button>
              );
            })}

            {totalPages > 3 && <span className="text-sm text-gray-400">... {totalPages}</span>}

            <button className="flex items-center gap-1 px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-40" onClick={() => setPage((p) => Math.min(p + 1, totalPages))} disabled={page === totalPages}>
              Next
              <IoIosArrowForward />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Notifications;
