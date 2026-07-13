import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, Mail, MessageCircle, MessageSquare, Trash2 } from 'lucide-react';
import { smartflowApi } from '../api/services';

const FILTER_OPTIONS = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'email', label: 'Email' },
  { key: 'sms', label: 'SMS' },
];

function getChannelBadgeConfig(channelValue) {
  const channel = String(channelValue || '').toLowerCase();

  if (channel.includes('whatsapp')) {
    return {
      Icon: MessageCircle,
      backgroundColor: '#25D366',
    };
  }

  if (channel.includes('email')) {
    return {
      Icon: Mail,
      backgroundColor: '#4D9CFF',
    };
  }

  return {
    Icon: MessageSquare,
    backgroundColor: '#8A94A8',
  };
}

function mapNotifications(apiResponse) {
  const rawItems = apiResponse?.data?.data?.items || apiResponse?.data?.items || [];

  return rawItems.map((item) => {
    let channel = 'system';

    if (item.type === 'message') {
      channel = item.metadata?.channel || 'whatsapp';
    } else if (item.type === 'missed_call' || item.type === 'scheduled_call') {
      channel = 'sms';
    } else if (item.type === 'daily_digest') {
      channel = 'email';
    }

    let avatar = item.metadata?.avatar;
    if (!avatar) {
      if (item.type === 'message' && item.title) {
        avatar = `https://robohash.org/${encodeURIComponent(item.title)}.png`;
      } else {
        avatar = `https://robohash.org/${encodeURIComponent(item.type || 'bell')}.png`;
      }
    }

    return {
      id: item.id || item._id || `${item.type}-${item.created_at}`,
      title: item.title || 'Notification',
      description: item.body || '',
      isNew: Boolean(item.unread),
      avatar,
      channel,
    };
  });
}

export default function Notifications() {
  const [activeFilter, setActiveFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);

  const fetchNotifications = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await smartflowApi.getNotifications({
        page: 1,
        page_size: 100,
      });
      setNotifications(mapNotifications(response));
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      setNotifications([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkAllAsRead = async () => {
    try {
      await smartflowApi.markAllNotificationsRead();
      setNotifications((prev) => prev.map((item) => ({ ...item, isNew: false })));
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

  const handleDelete = async (id) => {
    const previous = notifications;
    setNotifications((prev) => prev.filter((item) => item.id !== id));

    try {
      await smartflowApi.deleteNotification(id);
    } catch (error) {
      console.error('Failed to delete notification:', error);
      setNotifications(previous);
    }
  };

  const filteredNotifications = useMemo(() => {
    return notifications.filter((item) => {
      if (activeFilter === 'unread' && !item.isNew) return false;
      if (['whatsapp', 'email', 'sms'].includes(activeFilter) && item.channel !== activeFilter) {
        return false;
      }
      return true;
    });
  }, [activeFilter, notifications]);

  const newCount = notifications.filter((item) => item.isNew).length;

  return (
    <div className="max-w-5xl mx-auto pb-12 text-white">
      <div className="flex items-center justify-between gap-4 mb-5">
        <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
        <button
          type="button"
          onClick={handleMarkAllAsRead}
          className="text-sm font-semibold text-[#11C7E5] hover:text-[#6BE7FF] transition-colors cursor-pointer"
        >
          Mark All As Read
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        {FILTER_OPTIONS.map((option) => {
          const active = option.key === activeFilter;
          return (
            <button
              key={option.key}
              type="button"
              onClick={() => setActiveFilter(option.key)}
              className={`px-4 py-2 rounded-full border text-sm font-semibold transition-colors cursor-pointer ${
                active
                  ? 'bg-[#16CBEA]/15 border-[#16CBEA]/40 text-[#DDFBFF]'
                  : 'bg-[#0D131D] border-[#243041] text-[#A4B0B7] hover:text-white hover:border-[#324359]'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {newCount > 0 && activeFilter === 'all' ? (
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#0D1A23] border border-[#17485A] mb-5">
          <Bell size={16} className="text-[#16CBEA]" />
          <span className="text-sm font-semibold text-[#D9F8FF]">
            {newCount} {newCount > 1 ? 'new notifications' : 'new notification'}
          </span>
        </div>
      ) : null}

      {isLoading ? (
        <div className="min-h-[320px] rounded-[26px] border border-[#243041] bg-[#131A24] flex items-center justify-center">
          <p className="text-[#A4B0B7] text-sm">Loading notifications</p>
        </div>
      ) : filteredNotifications.length > 0 ? (
        <div className="space-y-3">
          {filteredNotifications.map((item, index) => {
            const channelBadge = getChannelBadgeConfig(item.channel);
            const showHighlight = index === 0 && activeFilter === 'all' && item.isNew;

            return (
              <div
                key={item.id}
                className={`rounded-[24px] border p-4 md:p-5 flex items-center justify-between gap-4 ${
                  showHighlight
                    ? 'bg-[#101C25] border-[#17485A]'
                    : 'bg-[#131A24] border-[#243041]'
                }`}
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="relative shrink-0">
                    <img
                      src={item.avatar}
                      alt={item.title}
                      className="w-14 h-14 rounded-2xl object-cover border border-[#243041]"
                    />
                    <div
                      className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-2 border-[#131A24] flex items-center justify-center"
                      style={{ backgroundColor: channelBadge.backgroundColor }}
                    >
                      <channelBadge.Icon size={11} color="#F8FBFF" />
                    </div>
                    {item.isNew ? (
                      <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-[#16CBEA] border-2 border-[#131A24]" />
                    ) : null}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-base font-bold text-white truncate">{item.title}</p>
                      {item.isNew ? <div className="w-2 h-2 rounded-full bg-[#16CBEA] shrink-0" /> : null}
                    </div>
                    <p className="text-sm text-[#A4B0B7] mt-1 line-clamp-2">{item.description}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleDelete(item.id)}
                  className="w-11 h-11 rounded-2xl shrink-0 border border-[#3A2430] bg-[#241017] text-rose-300 hover:text-white hover:border-rose-500/40 transition-colors flex items-center justify-center cursor-pointer"
                  aria-label="Delete notification"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="min-h-[320px] rounded-[26px] border border-[#243041] bg-[#131A24] flex flex-col items-center justify-center text-center px-6">
          <Bell size={48} className="text-[#2A313C]" />
          <p className="text-white font-semibold mt-4">No notifications</p>
          <p className="text-[#A4B0B7] text-sm mt-1">You&apos;re all caught up</p>
        </div>
      )}
    </div>
  );
}
