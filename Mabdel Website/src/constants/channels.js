import { Mail, MessageSquareText } from 'lucide-react';
import { FaLinkedin } from 'react-icons/fa';
import {
  SiGoogle,
  SiInstagram,
  SiMessenger,
  SiSnapchat,
  SiTelegram,
  SiThreads,
  SiWhatsapp,
  SiX,
} from 'react-icons/si';

// One source for how each channel looks, shared by Unified Conversation and Integrations.
// Keys are the backend's platform values - never shorten them (e.g. "facebook"), the
// API filters and replies on the exact value.
export const CHANNEL_META = {
  whatsapp: { Icon: SiWhatsapp, color: '#25D366', label: 'WhatsApp' },
  facebook_messenger: { Icon: SiMessenger, color: '#00B2FF', label: 'Messenger' },
  instagram: { Icon: SiInstagram, color: '#E4405F', label: 'Instagram' },
  email: { Icon: Mail, color: '#F59E0B', label: 'Email' },
  sms: { Icon: MessageSquareText, color: '#3B82F6', label: 'SMS' },
  telegram: { Icon: SiTelegram, color: '#229ED9', label: 'Telegram' },
  google_business: { Icon: SiGoogle, color: '#4285F4', label: 'Google Business' },
  linkedin: { Icon: FaLinkedin, color: '#0A66C2', label: 'LinkedIn' },
  twitter_x: { Icon: SiX, color: '#E7E9EA', label: 'X' },
  snapchat: { Icon: SiSnapchat, color: '#FFFC00', label: 'Snapchat' },
  threads: { Icon: SiThreads, color: '#E7E9EA', label: 'Threads' },
};

// Channels that get their own tab in Unified, in display order.
export const INBOX_CHANNELS = ['whatsapp', 'facebook_messenger', 'instagram', 'email', 'sms', 'telegram'];

// Every channel whose threads belong in Unified (mirrors the backend's CUSTOMER_PLATFORMS).
export const CUSTOMER_CHANNELS = Object.keys(CHANNEL_META);

// Meta only lets a business reply within 24 hours of the customer's last message.
export const REPLY_WINDOW_CHANNELS = ['facebook_messenger', 'instagram'];

export function channelMeta(platform) {
  return CHANNEL_META[platform] || { Icon: MessageSquareText, color: '#9333ea', label: platform || 'Chat' };
}
