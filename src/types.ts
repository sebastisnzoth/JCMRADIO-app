export interface SplashAd {
  enabled: boolean;
  imageUrl: string;
  duration: number;
}

export interface StickyBanner {
  imageUrl: string;
  link: string;
}

export interface SocialLinks {
  whatsapp: string;
  instagram: string;
  tiktok: string;
  facebook: string;
}

export interface PopupAlert {
  enabled: boolean;
  title: string;
  message: string;
}

export interface QuickLink {
  label: string;
  url: string;
}

export interface AppConfig {
  splashAd: SplashAd;
  stickyBanner: StickyBanner;
  tvLink: string;
  socialLinks: SocialLinks;
  popupAlert?: PopupAlert;
  quickLinks: QuickLink[];
  authorizedAdmins: string[];
}

export interface NotificationRecord {
  id?: string;
  title: string;
  body: string;
  sentAt: string;
}

/** Shape returned by https://sp.aljania.com/cp/get_info.php?p=8120 */
export interface RadioInfo {
  title: string;       // Now playing song title
  art: string;         // Album image URL (High Quality — use directly)
  listeners: number;   // Total online listeners
  ulistener: number;   // Unique listeners
  bitrate: number;     // Stream bitrate (kbps)
  djusername: string;  // DJ username if live streaming (empty string if no DJ)
  djprofile: string;   // DJ profile picture URL if live streaming
  history: string[];   // Last 5 played song titles
}
