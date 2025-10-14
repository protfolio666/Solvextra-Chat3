import { MessageCircle, Send } from "lucide-react";
import { SiWhatsapp, SiTelegram, SiInstagram, SiX } from "react-icons/si";
import { Channel } from "@shared/schema";

interface ChannelBadgeProps {
  channel: Channel;
  size?: "sm" | "md" | "lg";
}

export function ChannelBadge({ channel, size = "md" }: ChannelBadgeProps) {
  const sizeClasses = {
    sm: "w-5 h-5",
    md: "w-6 h-6",
    lg: "w-8 h-8",
  };

  const iconSizeClasses = {
    sm: "w-3 h-3",
    md: "w-3.5 h-3.5",
    lg: "w-4 h-4",
  };

  const channelConfig = {
    whatsapp: {
      icon: SiWhatsapp,
      bg: "bg-channel-whatsapp",
      label: "WhatsApp",
    },
    telegram: {
      icon: SiTelegram,
      bg: "bg-channel-telegram",
      label: "Telegram",
    },
    instagram: {
      icon: SiInstagram,
      bg: "bg-channel-instagram",
      label: "Instagram",
    },
    twitter: {
      icon: SiX,
      bg: "bg-channel-twitter",
      label: "Twitter",
    },
    website: {
      icon: MessageCircle,
      bg: "bg-channel-website",
      label: "Website",
    },
  };

  const config = channelConfig[channel];
  const Icon = config.icon;

  return (
    <div
      className={`${sizeClasses[size]} ${config.bg} rounded-full flex items-center justify-center`}
      title={config.label}
      data-testid={`badge-channel-${channel}`}
    >
      <Icon className={`${iconSizeClasses[size]} text-white`} />
    </div>
  );
}
