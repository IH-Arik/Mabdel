export const getApiList = (response, keys = []) => {
  const data = response?.data?.data || response?.data || {};
  if (Array.isArray(data)) return data;

  for (const key of keys) {
    if (Array.isArray(data?.[key])) return data[key];
  }

  if (Array.isArray(data?.items)) return data.items;
  return [];
};

export const getCurrentUserId = (user) =>
  user?._id || user?.id || user?.user_id || user?.userId || null;

export const isHostedByUser = (item, userId) => {
  if (!item || !userId) return false;
  const normalizedUserId = String(userId);
  return [
    item?.hostUserId,
    item?.hostId,
    item?.organizerId,
    item?.creatorId,
    item?.createdBy,
    item?.userId,
    item?.organizer?._id,
    item?.organizer?.id,
  ]
    .filter(Boolean)
    .some((value) => String(value) === normalizedUserId);
};

export const formatEventDate = (item) => {
  const value = item?.date || item?.startDate || item?.start_date || item?.starts_at;
  if (!value) return '-';

  try {
    return new Date(value).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '-';
  }
};

export const getEventParticipantCount = (item) =>
  Number(item?.soldTickets || item?.sold_tickets || item?.participants?.length || item?.attendee_count || 0);

export const getEventCapacity = (item) =>
  Number(item?.maxParticipants || item?.max_participants || item?.capacity || 0);

export const getEventPrice = (item) =>
  Number(item?.ticketPrice || item?.price || item?.ticket_price || 0);
