export type BrowserNotificationPermission = NotificationPermission | "unsupported";

export function getBrowserNotificationPermission(): BrowserNotificationPermission {
  if (!("Notification" in window)) {
    return "unsupported";
  }

  return Notification.permission;
}

export async function requestBrowserNotificationPermission(): Promise<BrowserNotificationPermission> {
  if (!("Notification" in window)) {
    return "unsupported";
  }

  return Notification.requestPermission();
}

type ReviewNotificationOptions = {
  campaignId?: string | null;
  message: string;
  onClick: () => void;
};

export function showReviewBrowserNotification({ campaignId, message, onClick }: ReviewNotificationOptions) {
  if (getBrowserNotificationPermission() !== "granted") {
    return;
  }

  const notification = new Notification("ReviewBee", {
    body: message,
    tag: campaignId ? `reviewbee-campaign-${campaignId}` : "reviewbee-campaign-reviewed",
  });

  notification.onclick = () => {
    onClick();
    notification.close();
  };
}
