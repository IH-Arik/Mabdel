import { channelMeta } from '../../constants/channels';

export default function ChannelIcon({ platform, size = 12, className = '' }) {
  const { Icon, color } = channelMeta(platform);
  return <Icon size={size} color={color} className={className} aria-hidden="true" />;
}
