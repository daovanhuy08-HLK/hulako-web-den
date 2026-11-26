// Bộ icon nét (stroke) dùng chung cho trang công khai — vẽ tay theo phong cách ảnh thiết kế, không phụ thuộc thư viện ngoài.
const P: Record<string, React.ReactNode> = {
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.6-3.6" /></>,
  chat: <path d="M4 12a8 8 0 1 1 3.3 6.5L4 20l1.2-3.6A7.9 7.9 0 0 1 4 12Z" />,
  arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
  arrowLeft: <path d="M19 12H5m6-6-6 6 6 6" />,
  chevron: <path d="m9 6 6 6-6 6" />,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  home: <><path d="M3 11 12 4l9 7" /><path d="M5 10v10h14V10" /><path d="M10 20v-5h4v5" /></>,
  shirt: <path d="M8 4 4 6.5 5.5 10 7 9.3V20h10V9.3l1.5.7L20 6.5 16 4a4 4 0 0 1-8 0Z" />,
  play: <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m10 9 5 3-5 3Z" /></>,
  playCircle: <><circle cx="12" cy="12" r="9" /><path d="m10 8.5 5 3.5-5 3.5Z" /></>,
  video: <><rect x="3" y="6" width="13" height="12" rx="2" /><path d="m16 10 5-3v10l-5-3" /></>,
  tag: <><path d="M3 12V4h8l9 9-8 8-9-9Z" /><circle cx="7.5" cy="8.5" r="1.3" /></>,
  bag: <><path d="M5 8h14l-1 12H6L5 8Z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></>,
  layers: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 13 9 5 9-5" /></>,
  building: <><rect x="4" y="3" width="10" height="18" rx="1" /><path d="M14 9h6v12h-6M7 7h2M7 11h2M7 15h2M17 13h1M17 17h1" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
  phone: <><rect x="7" y="2.5" width="10" height="19" rx="2.5" /><path d="M11 18h2" /></>,
  pin: <><path d="M12 21s-7-6.3-7-11.5a7 7 0 0 1 14 0C19 14.7 12 21 12 21Z" /><circle cx="12" cy="9.5" r="2.5" /></>,
  briefcase: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5h6v2M3 12h18" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  file: <><path d="M6 3h8l4 4v14H6V3Z" /><path d="M14 3v4h4M9 12h6M9 16h6" /></>,
  clip: <path d="m20 11-8 8a5 5 0 0 1-7-7l8.5-8.5a3.5 3.5 0 0 1 5 5L10 17a2 2 0 0 1-3-3l7.5-7.5" />,
  check: <path d="m5 12 5 5L20 7" />,
  checkCircle: <><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6" /></>,
  gift: <><rect x="3" y="8" width="18" height="4" /><path d="M5 12v9h14v-9M12 8v13M12 8S10 3 7.5 4.5 9 8 12 8Zm0 0s2-5 4.5-3.5S15 8 12 8Z" /></>,
  clapper: <><rect x="3" y="8" width="18" height="12" rx="2" /><path d="m3 8 2-4 16 0-2 4M10 12l4 2-4 2Z" /></>,
  upload: <><path d="M12 15V4m-5 5 5-5 5 5" /><path d="M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4" /></>,
  send: <path d="M21 3 3 10.5l7 3 3 7L21 3Zm-11 10.5L21 3" />,
  tools: <><path d="m14.5 6.5 3-3 3 3-3 3M17.5 3.5 9 12" /><path d="M4 20l5-5M6 4l4 4-2 2-4-4M14 14l6 6" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  tripod: <><path d="M12 3v7M12 10l-6 11M12 10l6 11M12 10v11" /><circle cx="12" cy="3.5" r="1.2" /></>,
  bulb: <><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9V16h7v-2.1A6 6 0 0 0 12 3Z" /></>,
  camera: <><rect x="4" y="5" width="12" height="9" rx="1.5" /><path d="m16 8 4-2v7l-4-2M10 14v3M6 21l4-4 4 4" /></>,
  softbox: <><path d="M4 4h9l3 8-3 8H4Z" /><path d="M16 12h3M19 12v9M16 21h6" /></>,
  list: <><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4.5" cy="6" r="1" /><circle cx="4.5" cy="12" r="1" /><circle cx="4.5" cy="18" r="1" /></>,
  image: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9.5" r="1.8" /><path d="m21 16-5-5-9 9" /></>,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  alert: <><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5M12 16.5v.01" /></>,
  wifiOff: <><path d="M2 8.5a15 15 0 0 1 4-2.4M9.5 5.2A15 15 0 0 1 22 8.5M5 12a10 10 0 0 1 3.5-2M12.5 9.1A10 10 0 0 1 19 12M8.5 15.5a5 5 0 0 1 7 0M12 19.5v.01M3 3l18 18" /></>,
  person: <><circle cx="12" cy="4.5" r="2" /><path d="M9 21v-7H7.5l1.2-6h6.6l1.2 6H15v7" /></>,
  frame: <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />,
  spark: <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" />,
  door: <><path d="M5 21V4a1 1 0 0 1 1-1h9v18" /><path d="M15 6h3v15M3 21h18M12 12h.01" /></>,
};

export type IconName = keyof typeof P;

export function Icon({ name, size = 22, className = "", stroke = 1.8 }: { name: IconName; size?: number; className?: string; stroke?: number }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" className={className}>
      {P[name]}
    </svg>
  );
}
