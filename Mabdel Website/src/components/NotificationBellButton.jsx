import { Bell } from 'lucide-react';

export default function NotificationBellButton({
  count = 0,
  active = false,
  onClick,
  size = 18,
  strokeWidth = 2,
  className = '',
  buttonClassName = '',
}) {
  const safeCount = Math.max(0, Number(count) || 0);
  const badgeLabel = safeCount > 99 ? '99+' : String(safeCount);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative ${buttonClassName}`.trim()}
      aria-label={`Notifications${safeCount ? ` (${badgeLabel} unread)` : ''}`}
    >
      <Bell size={size} strokeWidth={strokeWidth} className={className} />
      {safeCount > 0 ? (
        <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-[#11C7E5] text-[#041015] text-[10px] font-black flex items-center justify-center border border-[#0c101b]">
          {badgeLabel}
        </span>
      ) : null}
    </button>
  );
}
