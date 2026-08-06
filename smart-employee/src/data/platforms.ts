import type { PlatformLink } from "./types";

/** قوالب الروابط الافتراضية للمنصات السعودية */
export function defaultPlatformLinks(): PlatformLink[] {
  const at = new Date().toISOString();
  return [
    {
      id: "plt_ejar",
      kind: "ejar",
      name: "منصة إيجار",
      portalUrl: "https://www.ejar.sa",
      apiBaseUrl: "https://api.ejar.sa/v1",
      connected: false,
      receiveNotifications: true,
      actOnBehalfEnabled: true,
      notes: "عقود الإيجار والإشعارات والتجديد",
      createdAt: at,
    },
    {
      id: "plt_electricity",
      kind: "electricity",
      name: "الشركة السعودية للكهرباء",
      portalUrl: "https://www.se.com.sa",
      apiBaseUrl: "",
      connected: false,
      receiveNotifications: true,
      actOnBehalfEnabled: true,
      notes: "فواتير الكهرباء والتنبيهات والسداد",
      createdAt: at,
    },
    {
      id: "plt_water",
      kind: "water",
      name: "شركة المياه الوطنية",
      portalUrl: "https://www.nwc.com.sa",
      apiBaseUrl: "",
      connected: false,
      receiveNotifications: true,
      actOnBehalfEnabled: true,
      notes: "فواتير المياه والتنبيهات والسداد",
      createdAt: at,
    },
  ];
}
